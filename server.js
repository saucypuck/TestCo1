const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('./db');
const app = express();
const port = process.env.PORT || 3000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const homeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestCo1</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      width: 100vw;
    }
    form {
      display: flex;
      gap: 8px;
    }
    input[type="password"] {
      padding: 6px 10px;
      font-size: 14px;
      font-family: inherit;
    }
    button {
      padding: 6px 12px;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <form id="passwordForm" method="POST" action="/">
    <input type="password" id="password" name="password" autofocus />
    <button type="submit">Enter</button>
  </form>
  <script>
    document.getElementById('passwordForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const pwd = document.getElementById('password').value;
      if (pwd === 'test123') {
        window.location.href = '/success';
      } else {
        document.getElementById('password').value = '';
      }
    });
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(homeHtml);
});

app.post('/', (req, res) => {
  const { password } = req.body;
  if (password === 'test123') {
    return res.redirect('/success');
  }
  res.send(homeHtml);
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

function formatUsd(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

app.get('/api/home', async (req, res) => {
  try {
    const [dealsR, trendR, projectsR, opsR, attentionR, activityR, agentsR] = await Promise.all([
      db.query(`
        select
          (select coalesce(sum(value), 0) from deals where stage = 'WON') as revenue_won,
          (select coalesce(sum(value), 0) from deals where stage = 'OPEN') as pipeline_value,
          (select count(*)::int from deals where stage = 'OPEN') as open_deals,
          (select count(*)::int from deals where stage = 'WON' and closed_at >= date_trunc('month', current_date)) as closed_this_month
      `),
      db.query(`
        select
          (select coalesce(sum(value), 0) from deals where stage = 'WON'
             and closed_at >= date_trunc('month', current_date)) as this_month,
          (select coalesce(sum(value), 0) from deals where stage = 'WON'
             and closed_at >= date_trunc('month', current_date - interval '1 month')
             and closed_at < date_trunc('month', current_date)) as last_month
      `),
      db.query(`
        select p.id, p.name, p.status,
          coalesce(sum(d.value) filter (where d.stage = 'WON'), 0) as revenue,
          coalesce(sum(d.value) filter (where d.stage = 'OPEN'), 0) as pipeline,
          (select count(*)::int from jobs j where j.project_id = p.id
             and j.status in ('QUEUED', 'RUNNING')) as active_jobs
        from projects p
        left join deals d on d.project_id = p.id
        group by p.id, p.name, p.status
        order by p.name
      `),
      db.query(`
        select
          (select count(*)::int from jobs where status in ('QUEUED', 'RUNNING')) as active_jobs,
          (select count(*)::int from agents where status = 'RUNNING') as agents_running,
          (select count(*)::int from tasks where started_at >= current_date) as tasks_today,
          (select count(*)::int from tasks where status = 'ERROR' and started_at >= current_date) as errors
      `),
      db.query(`
        select t.id as task_id, t.agent_name, j.project_id, p.name as project_name,
          (select e.payload->>'message' from events e where e.task_id = t.id
             order by e.created_at desc limit 1) as message
        from tasks t
        join jobs j on j.id = t.job_id
        left join projects p on p.id = j.project_id
        where t.status = 'ERROR' and t.started_at >= now() - interval '48 hours'
        order by t.started_at desc
      `),
      db.query(`
        select e.id, e.type, e.payload, e.created_at, t.agent_name, j.project_id, p.name as project_name
        from events e
        left join tasks t on t.id = e.task_id
        left join jobs j on j.id = e.job_id
        left join projects p on p.id = j.project_id
        order by e.created_at desc
        limit 10
      `),
      db.query('select id, name from agents'),
    ]);

    const d = dealsR.rows[0];
    const trend = trendR.rows[0];
    const o = opsR.rows[0];

    const attentionByProject = {};
    attentionR.rows.forEach((row) => {
      const key = row.project_id || 'none';
      (attentionByProject[key] = attentionByProject[key] || []).push(row);
    });
    const needsAttention = [];
    Object.keys(attentionByProject).forEach((key) => {
      const rows = attentionByProject[key];
      if (rows.length > 1) {
        needsAttention.push({
          text: (rows[0].project_name || 'Unassigned') + ' has ' + rows.length + ' failed tasks',
          projectId: rows[0].project_id,
          projectName: rows[0].project_name,
        });
      } else {
        const row = rows[0];
        needsAttention.push({
          text: row.message || row.agent_name + ' reported an error',
          projectId: row.project_id,
          projectName: row.project_name,
        });
      }
    });
    const topAttention = needsAttention.slice(0, 5);
    const attentionProjectIds = new Set(needsAttention.map((a) => a.projectId).filter(Boolean));

    const agentIdByName = {};
    agentsR.rows.forEach((a) => {
      agentIdByName[a.name] = a.id;
    });

    res.json({
      business: {
        revenueWon: formatUsd(d.revenue_won),
        pipelineValue: formatUsd(d.pipeline_value),
        openDeals: d.open_deals,
        closedThisMonth: d.closed_this_month,
        trend: {
          thisMonth: formatUsd(trend.this_month),
          lastMonth: formatUsd(trend.last_month),
        },
      },
      projects: projectsR.rows.map((p) => ({
        id: p.id,
        name: p.name,
        status: attentionProjectIds.has(p.id) ? 'ATTENTION' : p.status,
        revenue: formatUsd(p.revenue),
        pipeline: formatUsd(p.pipeline),
        activeJobs: p.active_jobs,
      })),
      operations: [
        { label: 'Active Jobs', value: o.active_jobs },
        { label: 'Agents Running', value: o.agents_running },
        { label: 'Tasks Today', value: o.tasks_today },
        { label: 'Errors', value: o.errors },
      ],
      needsAttention: topAttention,
      activity: activityR.rows.map((e) => ({
        time: new Date(e.created_at).toLocaleTimeString('en-US', { hour12: false }),
        text: e.payload && e.payload.message ? e.payload.message : e.type,
        projectName: e.project_name || null,
        agentId: e.agent_name ? agentIdByName[e.agent_name] || null : null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load home data' });
  }
});

app.get('/api/agents', async (req, res) => {
  try {
    const result = await db.query('select * from agents order by name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load agents' });
  }
});

app.get('/api/agent-graph', async (req, res) => {
  try {
    const [projectsR, workflowsR, agentsR, tasksR, eventsR] = await Promise.all([
      db.query('select * from projects order by name'),
      db.query('select * from workflows order by name'),
      db.query('select * from agents order by name'),
      db.query('select * from tasks order by started_at desc nulls last limit 200'),
      db.query(`
        select e.id, e.type, e.payload, e.created_at, t.agent_name
        from events e
        left join tasks t on t.id = e.task_id
        order by e.created_at desc
        limit 200
      `),
    ]);

    const tasksByAgent = {};
    tasksR.rows.forEach((t) => {
      (tasksByAgent[t.agent_name] = tasksByAgent[t.agent_name] || []).push(t);
    });
    const eventsByAgent = {};
    eventsR.rows.forEach((e) => {
      if (!e.agent_name) return;
      (eventsByAgent[e.agent_name] = eventsByAgent[e.agent_name] || []).push(e);
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const agentsById = {};
    agentsR.rows.forEach((a) => {
      const aTasks = tasksByAgent[a.name] || [];
      const aEvents = eventsByAgent[a.name] || [];
      const runningTask = aTasks.find((t) => t.status === 'RUNNING');
      const runningEvent = runningTask
        ? aEvents.find((e) => e.payload && e.payload.message)
        : null;
      const tasksToday = aTasks.filter(
        (t) => t.started_at && new Date(t.started_at) >= startOfToday
      ).length;
      const errors = aTasks.filter(
        (t) => t.status === 'ERROR' && t.started_at && new Date(t.started_at) >= startOfToday
      ).length;

      agentsById[a.id] = {
        id: a.id,
        name: a.name,
        role: a.description,
        status: a.status,
        model: a.model,
        maxConcurrency: a.max_concurrency,
        enabled: a.enabled,
        projectId: a.project_id,
        capabilities: a.capabilities || [],
        currentTask: runningEvent ? runningEvent.payload.message : null,
        lastEvent: aEvents[0] && aEvents[0].payload ? aEvents[0].payload.message : null,
        tasksToday,
        errors,
        log: aEvents.slice(0, 5).map(
          (e) =>
            new Date(e.created_at).toLocaleTimeString('en-US', { hour12: false }) +
            '  ' +
            (e.payload && e.payload.message ? e.payload.message : e.type)
        ),
      };
    });

    const agentsByName = {};
    agentsR.rows.forEach((a) => {
      agentsByName[a.name] = agentsById[a.id];
    });

    const workflowsByProject = {};
    workflowsR.rows.forEach((w) => {
      const steps = Array.isArray(w.steps) ? w.steps : [];
      const wfAgents = steps
        .map((s) => agentsByName[s.agent])
        .filter(Boolean)
        .map((a) => ({ id: a.id, name: a.name, status: a.status }));
      (workflowsByProject[w.project_id] = workflowsByProject[w.project_id] || []).push({
        id: w.id,
        name: w.name,
        agents: wfAgents,
      });
    });

    const projects = projectsR.rows.map((p) => {
      const workflows = workflowsByProject[p.id] || [];
      const agentIdsInWorkflows = new Set();
      workflows.forEach((w) => w.agents.forEach((a) => agentIdsInWorkflows.add(a.id)));
      const otherAgents = agentsR.rows
        .filter((a) => a.project_id === p.id && !agentIdsInWorkflows.has(a.id))
        .map((a) => ({ id: a.id, name: a.name, status: a.status }));
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        workflows: workflows,
        otherAgents: otherAgents,
      };
    });

    const unassigned = agentsR.rows
      .filter((a) => !a.project_id)
      .map((a) => agentsById[a.id]);

    res.json({ projects, agents: agentsById, unassigned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load agent graph' });
  }
});

const AGENT_PATCHABLE_FIELDS = ['model', 'max_concurrency', 'enabled', 'project_id'];

app.patch('/api/agents/:id', async (req, res) => {
  try {
    const setClauses = [];
    const values = [];
    AGENT_PATCHABLE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        values.push(req.body[field]);
        setClauses.push(field + ' = $' + values.length);
      }
    });
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }
    values.push(req.params.id);
    const result = await db.query(
      'update agents set ' + setClauses.join(', ') + ' where id = $' + values.length + ' returning *',
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

app.post('/api/agents', async (req, res) => {
  try {
    const b = req.body || {};
    const result = await db.query(
      `insert into agents
        (name, description, type, status, model, max_concurrency, enabled, capabilities, project_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning *`,
      [
        b.name,
        b.description || null,
        b.type || null,
        b.status || 'IDLE',
        b.model || null,
        b.max_concurrency || 1,
        b.enabled !== undefined ? b.enabled : true,
        JSON.stringify(b.capabilities || []),
        b.project_id || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

app.delete('/api/agents/:id', async (req, res) => {
  try {
    const result = await db.query('delete from agents where id = $1 returning id', [
      req.params.id,
    ]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

app.post('/api/agents/:id/capabilities', async (req, res) => {
  try {
    const skill = (req.body.skill || '').trim();
    if (!skill) return res.status(400).json({ error: 'skill is required' });

    const current = await db.query('select capabilities from agents where id = $1', [
      req.params.id,
    ]);
    if (current.rows.length === 0) return res.status(404).json({ error: 'Agent not found' });

    const existing = current.rows[0].capabilities || [];
    if (existing.includes(skill)) return res.json(existing);

    const updated = [...existing, skill];
    const result = await db.query(
      'update agents set capabilities = $1 where id = $2 returning capabilities',
      [JSON.stringify(updated), req.params.id]
    );
    res.json(result.rows[0].capabilities);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add skill' });
  }
});

app.get('/api/projects', async (req, res) => {
  try {
    const result = await db.query(
      'select id, name, description, status from projects order by name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load projects' });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const [projectR, workflowsR, agentsR, jobsR, activityR, logsR, filesR] = await Promise.all([
      db.query('select * from projects where id = $1', [projectId]),
      db.query('select * from workflows where project_id = $1 order by name', [projectId]),
      db.query('select id, name, status from agents'),
      db.query(
        `select j.id, j.status, j.started_at, j.completed_at, w.name as workflow_name
         from jobs j
         left join workflows w on w.id = j.workflow_id
         where j.project_id = $1
         order by j.started_at desc nulls last`,
        [projectId]
      ),
      db.query(
        `select e.id, e.type, e.payload, e.created_at, t.agent_name
         from events e
         left join tasks t on t.id = e.task_id
         left join jobs j on j.id = e.job_id
         where j.project_id = $1
         order by e.created_at desc
         limit 20`,
        [projectId]
      ),
      db.query('select * from project_logs where project_id = $1 order by created_at desc limit 50', [
        projectId,
      ]),
      db.query(
        `select id, filename, content_type, size_bytes, uploaded_by, created_at
         from project_files where project_id = $1 order by created_at desc`,
        [projectId]
      ),
    ]);

    if (projectR.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    const project = projectR.rows[0];

    const agentsByName = {};
    agentsR.rows.forEach((a) => {
      agentsByName[a.name] = a;
    });

    const workflows = workflowsR.rows.map((w) => {
      const steps = Array.isArray(w.steps) ? w.steps : [];
      const wfAgents = steps
        .map((s) => agentsByName[s.agent])
        .filter(Boolean)
        .map((a) => ({ id: a.id, name: a.name, status: a.status }));
      return { id: w.id, name: w.name, agents: wfAgents };
    });

    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      details: project.details,
      status: project.status,
      workflows: workflows,
      jobs: jobsR.rows.map((j) => ({
        id: j.id,
        status: j.status,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        workflowName: j.workflow_name,
      })),
      activity: activityR.rows.map((e) => ({
        time: new Date(e.created_at).toLocaleTimeString('en-US', { hour12: false }),
        text: e.payload && e.payload.message ? e.payload.message : e.type,
        agentId: e.agent_name && agentsByName[e.agent_name] ? agentsByName[e.agent_name].id : null,
      })),
      logs: logsR.rows.map((l) => ({
        id: l.id,
        authorType: l.author_type,
        authorName: l.author_name,
        content: l.content,
        createdAt: l.created_at,
      })),
      files: filesR.rows.map((f) => ({
        id: f.id,
        filename: f.filename,
        contentType: f.content_type,
        sizeBytes: f.size_bytes,
        uploadedBy: f.uploaded_by,
        createdAt: f.created_at,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load project' });
  }
});

const PROJECT_PATCHABLE_FIELDS = ['name', 'description', 'details'];

app.patch('/api/projects/:id', async (req, res) => {
  try {
    const setClauses = [];
    const values = [];
    PROJECT_PATCHABLE_FIELDS.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        values.push(req.body[field]);
        setClauses.push(field + ' = $' + values.length);
      }
    });
    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided' });
    }
    values.push(req.params.id);
    const result = await db.query(
      'update projects set ' + setClauses.join(', ') + ' where id = $' + values.length + ' returning *',
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.post('/api/projects/:id/logs', async (req, res) => {
  try {
    const content = (req.body.content || '').trim();
    if (!content) return res.status(400).json({ error: 'content is required' });

    const result = await db.query(
      `insert into project_logs (project_id, author_type, author_name, content)
       values ($1, 'human', 'You', $2)
       returning *`,
      [req.params.id, content]
    );
    const l = result.rows[0];
    res.status(201).json({
      id: l.id,
      authorType: l.author_type,
      authorName: l.author_name,
      content: l.content,
      createdAt: l.created_at,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add log entry' });
  }
});

app.post('/api/projects/:id/files', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is larger than the 5MB limit' });
      }
      console.error(err);
      return res.status(400).json({ error: 'Upload failed' });
    }
    if (!req.file) return res.status(400).json({ error: 'file is required' });

    try {
      const result = await db.query(
        `insert into project_files (project_id, filename, content_type, size_bytes, data, uploaded_by)
         values ($1, $2, $3, $4, $5, 'You')
         returning id, filename, content_type, size_bytes, uploaded_by, created_at`,
        [req.params.id, req.file.originalname, req.file.mimetype, req.file.size, req.file.buffer]
      );
      const f = result.rows[0];
      res.status(201).json({
        id: f.id,
        filename: f.filename,
        contentType: f.content_type,
        sizeBytes: f.size_bytes,
        uploadedBy: f.uploaded_by,
        createdAt: f.created_at,
      });
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Failed to save file' });
    }
  });
});

app.get('/api/projects/:id/files/:fileId', async (req, res) => {
  try {
    const result = await db.query(
      'select filename, content_type, data from project_files where id = $1 and project_id = $2',
      [req.params.fileId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    const f = result.rows[0];
    res.set('Content-Type', f.content_type || 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename="' + f.filename.replace(/"/g, '') + '"');
    res.send(f.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

app.delete('/api/projects/:id/files/:fileId', async (req, res) => {
  try {
    const result = await db.query(
      'delete from project_files where id = $1 and project_id = $2 returning id',
      [req.params.fileId, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'File not found' });
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const result = await db.query('select * from jobs order by started_at desc nulls last');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load jobs' });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const result = await db.query('select * from jobs where id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Job not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load job' });
  }
});

app.get('/api/jobs/:id/events', async (req, res) => {
  try {
    const result = await db.query(
      'select * from events where job_id = $1 order by created_at asc',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load job events' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

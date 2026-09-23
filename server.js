const express = require('express');
const path = require('path');
const db = require('./db');
const app = express();
const port = process.env.PORT || 3000;

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

app.get('/api/command-center', async (req, res) => {
  try {
    const stats = await db.query(`
      select
        (select count(*)::int from jobs where status in ('QUEUED', 'RUNNING')) as active_jobs,
        (select count(*)::int from agents where status = 'RUNNING') as agents_running,
        (select count(*)::int from tasks where started_at >= current_date) as tasks_today,
        (select count(*)::int from tasks where status = 'ERROR' and started_at >= current_date) as errors
    `);
    const activity = await db.query(`
      select id, type, payload, created_at
      from events
      order by created_at desc
      limit 10
    `);
    const row = stats.rows[0];
    res.json({
      stats: [
        { label: 'Active Jobs', value: row.active_jobs },
        { label: 'Agents Running', value: row.agents_running },
        { label: 'Tasks Today', value: row.tasks_today },
        { label: 'Errors', value: row.errors },
      ],
      activity: activity.rows.map((e) => ({
        time: new Date(e.created_at).toLocaleTimeString('en-US', { hour12: false }),
        text: e.payload && e.payload.message ? e.payload.message : e.type,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load command center data' });
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

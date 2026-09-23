(function () {
  var DATA = window.MOCK_DATA; // still used by the Projects tab only

  // ---- Tabs ----
  var tabs = document.querySelectorAll('.tab');
  var views = document.querySelectorAll('.view');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-view');
      tabs.forEach(function (t) { t.classList.toggle('active', t === tab); });
      views.forEach(function (v) { v.classList.toggle('active', v.id === target); });
    });
  });

  // ---- Shared helpers ----
  function statusClass(status) {
    return (status || 'idle').toLowerCase();
  }

  function statCardsHtml(stats) {
    return stats.map(function (s) {
      return '<div class="stat-card"><div class="value">' + s.value +
        '</div><div class="label">' + s.label + '</div></div>';
    }).join('');
  }

  // ---- Home (live, via /api/home) ----
  function renderHome() {
    var businessEl = document.getElementById('business-stats');
    var opsEl = document.getElementById('ops-stats');
    var feedEl = document.getElementById('activity-feed');
    businessEl.innerHTML = '<div class="panel">Loading…</div>';
    opsEl.innerHTML = '';
    feedEl.innerHTML = '';

    fetch('/api/home')
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        businessEl.innerHTML = statCardsHtml(data.business);
        opsEl.innerHTML = statCardsHtml(data.operations);
        feedEl.innerHTML = data.activity.length
          ? data.activity.map(function (a) {
              return '<li><span class="time">' + a.time + '</span><span>' + a.text + '</span></li>';
            }).join('')
          : '<li>No activity yet.</li>';
      })
      .catch(function () {
        businessEl.innerHTML = '<div class="panel">Couldn\'t load — is the API configured?</div>';
      });
  }

  // ---- Projects (mock data — unchanged) ----
  function mockAgentNodeHtml(agentId) {
    var agent = DATA.agents[agentId];
    if (!agent) return '';
    return '<button class="agent-node" data-mock-agent-id="' + agent.id + '">' +
      '<span class="status-dot ' + statusClass(agent.status) + '"></span>' +
      agent.name + '</button>';
  }

  function renderProjectsList() {
    var listEl = document.getElementById('projects-list');
    listEl.innerHTML = DATA.projects.map(function (p) {
      return '<button class="project-card" data-project-id="' + p.id + '">' +
        '<div class="name">' + p.name + '</div>' +
        '<div class="desc">' + p.description + '</div>' +
        '<span class="status-badge ' + statusClass(p.status) + '">' + p.status + '</span>' +
        '</button>';
    }).join('');

    listEl.querySelectorAll('.project-card').forEach(function (card) {
      card.addEventListener('click', function () {
        showProjectDetail(card.getAttribute('data-project-id'));
      });
    });
  }

  function showProjectDetail(projectId) {
    var project = DATA.projects.find(function (p) { return p.id === projectId; });
    if (!project) return;

    var listEl = document.getElementById('projects-list');
    var detailEl = document.getElementById('project-detail');
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');

    var workflowsHtml = project.workflowIds.map(function (wfId) {
      var wf = DATA.workflows[wfId];
      var stepsHtml = wf.steps.map(mockAgentNodeHtml).join('<span class="arrow">&rarr;</span>');
      return '<div class="workflow-block">' +
        '<div class="wf-name">' + wf.name + '</div>' +
        '<div class="workflow-steps">' + stepsHtml + '</div>' +
        '</div>';
    }).join('');

    var agentsHtml = project.agentIds.map(mockAgentNodeHtml).join(' ');

    detailEl.innerHTML =
      '<button class="back-link" id="back-to-projects">&larr; All projects</button>' +
      '<div class="project-detail-header">' +
      '<span class="name">' + project.name + '</span>' +
      '<span class="status-badge ' + statusClass(project.status) + '">' + project.status + '</span>' +
      '</div>' +
      '<div class="project-detail-desc">' + project.description + '</div>' +
      '<div class="section-label">Workflows</div>' +
      workflowsHtml +
      '<div class="section-label">Agents</div>' +
      '<div>' + agentsHtml + '</div>';

    document.getElementById('back-to-projects').addEventListener('click', function () {
      detailEl.classList.add('hidden');
      listEl.classList.remove('hidden');
    });

    detailEl.querySelectorAll('.agent-node[data-mock-agent-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        openMockAgentDetail(node.getAttribute('data-mock-agent-id'));
      });
    });
  }

  // ---- Agents (live, via /api/agent-graph) ----
  var agentGraphCache = null;

  function realAgentNodeHtml(agent) {
    return '<button class="agent-node" data-agent-id="' + agent.id + '">' +
      '<span class="status-dot ' + statusClass(agent.status) + '"></span>' +
      agent.name + '</button>';
  }

  function renderAgents() {
    var treeEl = document.getElementById('graph-tree');
    treeEl.innerHTML = '<div class="panel">Loading…</div>';

    fetch('/api/agent-graph')
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        agentGraphCache = data;

        treeEl.innerHTML = data.projects.map(function (project) {
          var workflowsHtml = project.workflows.map(function (wf) {
            var agentsHtml = wf.agents.map(realAgentNodeHtml).join('');
            return '<div class="graph-workflow">' +
              '<div class="wf-name">' + wf.name + '</div>' +
              '<div class="graph-agents">' + agentsHtml + '</div>' +
              '</div>';
          }).join('');

          return '<div class="graph-project">' +
            '<div class="proj-name">' + project.name +
            ' <span class="status-badge ' + statusClass(project.status) + '">' + project.status + '</span></div>' +
            workflowsHtml +
            '</div>';
        }).join('');

        treeEl.querySelectorAll('.agent-node[data-agent-id]').forEach(function (node) {
          node.addEventListener('click', function () {
            openRealAgentDetail(node.getAttribute('data-agent-id'));
          });
        });
      })
      .catch(function () {
        treeEl.innerHTML = '<div class="panel">Couldn\'t load — is the API configured?</div>';
      });
  }

  // ---- Agent detail panel (shared DOM, two render paths) ----
  var panel = document.getElementById('detail-panel');
  var backdrop = document.getElementById('detail-backdrop');
  var content = document.getElementById('detail-content');

  function openMockAgentDetail(agentId) {
    var agent = DATA.agents[agentId];
    if (!agent) return;

    var toolsHtml = agent.tools.map(function (t) {
      return '<span class="tool-chip">' + t + '</span>';
    }).join('');

    var logHtml = agent.log.length
      ? agent.log.map(function (l) { return '<div>' + l + '</div>'; }).join('')
      : '<div>No recent activity.</div>';

    content.innerHTML =
      '<div class="detail-title">' + agent.name + '</div>' +
      '<div class="detail-role">' + agent.role + ' &middot; <span class="status-badge ' +
        statusClass(agent.status) + '">' + agent.status + '</span></div>' +
      '<div class="detail-field"><div class="k">Current task</div><div class="v">' +
        (agent.currentTask || '&mdash;') + '</div></div>' +
      '<div class="detail-field"><div class="k">Started</div><div class="v">' +
        (agent.startedAgo || '&mdash;') + '</div></div>' +
      '<div class="detail-field"><div class="k">Last event</div><div class="v">' +
        (agent.lastEvent || '&mdash;') + '</div></div>' +
      '<div class="detail-field"><div class="k">Tasks today</div><div class="v">' +
        agent.tasksToday + '</div></div>' +
      '<div class="detail-field"><div class="k">Errors</div><div class="v">' +
        agent.errors + '</div></div>' +
      '<div class="detail-field"><div class="k">Tools</div><div class="detail-tools">' +
        toolsHtml + '</div></div>' +
      '<div class="detail-field"><div class="k">Log</div><div class="detail-log">' +
        logHtml + '</div></div>' +
      '<div class="detail-controls">' +
      '<button disabled title="Available once the job queue lands (Phase 2+)">Pause</button>' +
      '<button disabled title="Available once the job queue lands (Phase 2+)">Restart</button>' +
      '<button disabled title="Available once the job queue lands (Phase 2+)">Run Manually</button>' +
      '<button disabled title="Available once the job queue lands (Phase 2+)">Edit Configuration</button>' +
      '</div>' +
      '<div class="detail-controls-note">Controls are read-only in this phase &mdash; see docs/AGENT_OS_PLAN.md.</div>';

    panel.classList.remove('hidden');
    backdrop.classList.remove('hidden');
  }

  function openRealAgentDetail(agentId) {
    if (!agentGraphCache) return;
    var agent = agentGraphCache.agents[agentId];
    if (!agent) return;
    renderRealAgentDetail(agent);
    panel.classList.remove('hidden');
    backdrop.classList.remove('hidden');
  }

  function renderRealAgentDetail(agent) {
    var skillsHtml = (agent.capabilities || []).map(function (s) {
      return '<span class="tool-chip">' + s + '</span>';
    }).join('') || '<span class="v">No skills yet.</span>';

    var logHtml = agent.log.length
      ? agent.log.map(function (l) { return '<div>' + l + '</div>'; }).join('')
      : '<div>No recent activity.</div>';

    content.innerHTML =
      '<div class="detail-title">' + agent.name + '</div>' +
      '<div class="detail-role">' + (agent.role || '') + ' &middot; <span class="status-badge ' +
        statusClass(agent.status) + '">' + agent.status + '</span></div>' +

      '<div class="detail-field"><div class="k">Current task</div><div class="v">' +
        (agent.currentTask || '&mdash;') + '</div></div>' +
      '<div class="detail-field"><div class="k">Last event</div><div class="v">' +
        (agent.lastEvent || '&mdash;') + '</div></div>' +
      '<div class="detail-field"><div class="k">Tasks today</div><div class="v">' +
        agent.tasksToday + '</div></div>' +
      '<div class="detail-field"><div class="k">Errors</div><div class="v">' +
        agent.errors + '</div></div>' +

      '<div class="detail-field"><div class="k">Skills</div><div class="detail-tools" id="skills-chips">' +
        skillsHtml + '</div>' +
        '<div class="skill-add-row">' +
        '<input type="text" id="skill-input" placeholder="Add a skill…" />' +
        '<button id="skill-add-btn">Add</button>' +
        '</div></div>' +

      '<div class="detail-field"><div class="k">Configuration</div>' +
        '<div class="config-form">' +
        '<label>Model<input type="text" id="cfg-model" value="' + (agent.model || '') + '" placeholder="e.g. claude-sonnet-5" /></label>' +
        '<label>Max concurrency<input type="number" id="cfg-concurrency" min="1" value="' + agent.maxConcurrency + '" /></label>' +
        '<label class="cfg-checkbox"><input type="checkbox" id="cfg-enabled" ' + (agent.enabled ? 'checked' : '') + ' /> Enabled</label>' +
        '<button id="cfg-save-btn">Save</button>' +
        '<span id="cfg-save-status" class="cfg-save-status"></span>' +
        '</div></div>' +

      '<div class="detail-field"><div class="k">Log</div><div class="detail-log">' +
        logHtml + '</div></div>' +

      '<div class="detail-controls">' +
      '<button disabled title="Available once the job queue lands (Phase 2+)">Pause</button>' +
      '<button disabled title="Available once the job queue lands (Phase 2+)">Restart</button>' +
      '<button disabled title="Available once the job queue lands (Phase 2+)">Run Manually</button>' +
      '</div>' +
      '<div class="detail-controls-note">Pause/Restart/Run Manually activate once the job queue lands (Phase 2+).</div>';

    document.getElementById('skill-add-btn').addEventListener('click', function () {
      addSkill(agent.id);
    });
    document.getElementById('skill-input').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') addSkill(agent.id);
    });
    document.getElementById('cfg-save-btn').addEventListener('click', function () {
      saveConfig(agent.id);
    });
  }

  function addSkill(agentId) {
    var input = document.getElementById('skill-input');
    var skill = input.value.trim();
    if (!skill) return;

    fetch('/api/agents/' + agentId + '/capabilities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill: skill }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (capabilities) {
        agentGraphCache.agents[agentId].capabilities = capabilities;
        input.value = '';
        renderRealAgentDetail(agentGraphCache.agents[agentId]);
      })
      .catch(function () {
        alert('Could not add skill — is the API configured?');
      });
  }

  function saveConfig(agentId) {
    var statusEl = document.getElementById('cfg-save-status');
    var body = {
      model: document.getElementById('cfg-model').value.trim() || null,
      max_concurrency: parseInt(document.getElementById('cfg-concurrency').value, 10) || 1,
      enabled: document.getElementById('cfg-enabled').checked,
    };

    statusEl.textContent = 'Saving…';
    fetch('/api/agents/' + agentId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (updated) {
        var agent = agentGraphCache.agents[agentId];
        agent.model = updated.model;
        agent.maxConcurrency = updated.max_concurrency;
        agent.enabled = updated.enabled;
        statusEl.textContent = 'Saved.';
      })
      .catch(function () {
        statusEl.textContent = 'Failed to save.';
      });
  }

  function closeAgentDetail() {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
  }

  document.getElementById('detail-close').addEventListener('click', closeAgentDetail);
  backdrop.addEventListener('click', closeAgentDetail);

  // ---- Init ----
  renderHome();
  renderProjectsList();
  renderAgents();
})();

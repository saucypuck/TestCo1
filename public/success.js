(function () {
  var DATA = window.MOCK_DATA;

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

  // ---- Command Center (live, via /api/command-center) ----
  function renderCommandCenter() {
    var statsEl = document.getElementById('stats');
    var feedEl = document.getElementById('activity-feed');
    statsEl.innerHTML = '<div class="panel">Loading…</div>';
    feedEl.innerHTML = '';

    fetch('/api/command-center')
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        statsEl.innerHTML = data.stats.map(function (s) {
          return '<div class="stat-card"><div class="value">' + s.value +
            '</div><div class="label">' + s.label + '</div></div>';
        }).join('');

        feedEl.innerHTML = data.activity.length
          ? data.activity.map(function (a) {
              return '<li><span class="time">' + a.time + '</span><span>' + a.text + '</span></li>';
            }).join('')
          : '<li>No activity yet.</li>';
      })
      .catch(function () {
        statsEl.innerHTML = '<div class="panel">Couldn\'t load — is the API configured?</div>';
      });
  }

  // ---- Shared helpers ----
  function statusClass(status) {
    return (status || 'idle').toLowerCase();
  }

  function agentNodeHtml(agentId) {
    var agent = DATA.agents[agentId];
    if (!agent) return '';
    return '<button class="agent-node" data-agent-id="' + agent.id + '">' +
      '<span class="status-dot ' + statusClass(agent.status) + '"></span>' +
      agent.name + '</button>';
  }

  // ---- Projects ----
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
      var stepsHtml = wf.steps.map(agentNodeHtml).join('<span class="arrow">&rarr;</span>');
      return '<div class="workflow-block">' +
        '<div class="wf-name">' + wf.name + '</div>' +
        '<div class="workflow-steps">' + stepsHtml + '</div>' +
        '</div>';
    }).join('');

    var agentsHtml = project.agentIds.map(agentNodeHtml).join(' ');

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

    bindAgentNodes(detailEl);
  }

  // ---- Agent Graph ----
  function renderAgentGraph() {
    var treeEl = document.getElementById('graph-tree');
    treeEl.innerHTML = DATA.projects.map(function (project) {
      var workflowsHtml = project.workflowIds.map(function (wfId) {
        var wf = DATA.workflows[wfId];
        var agentsHtml = wf.steps.map(agentNodeHtml).join('');
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

    bindAgentNodes(treeEl);
  }

  // ---- Agent detail panel ----
  var panel = document.getElementById('detail-panel');
  var backdrop = document.getElementById('detail-backdrop');
  var content = document.getElementById('detail-content');

  function bindAgentNodes(root) {
    root.querySelectorAll('.agent-node').forEach(function (node) {
      node.addEventListener('click', function () {
        openAgentDetail(node.getAttribute('data-agent-id'));
      });
    });
  }

  function openAgentDetail(agentId) {
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

  function closeAgentDetail() {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
  }

  document.getElementById('detail-close').addEventListener('click', closeAgentDetail);
  backdrop.addEventListener('click', closeAgentDetail);

  // ---- Init ----
  renderCommandCenter();
  renderProjectsList();
  renderAgentGraph();
})();

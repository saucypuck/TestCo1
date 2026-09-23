(function () {
  var DATA = window.MOCK_DATA; // still used by the Projects tab only

  // ---- Tabs ----
  var tabs = document.querySelectorAll('.tab');
  var views = document.querySelectorAll('.view');

  function activateTab(viewId) {
    tabs.forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === viewId);
    });
    views.forEach(function (v) {
      v.classList.toggle('active', v.id === viewId);
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      activateTab(tab.getAttribute('data-view'));
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
    var trendEl = document.getElementById('business-trend');
    var projectsEl = document.getElementById('home-projects');
    var opsEl = document.getElementById('ops-stats');
    var attentionEl = document.getElementById('needs-attention');
    var feedEl = document.getElementById('activity-feed');

    businessEl.innerHTML = '<div class="panel">Loading…</div>';
    trendEl.innerHTML = '';
    projectsEl.innerHTML = '';
    opsEl.innerHTML = '';
    attentionEl.innerHTML = '';
    feedEl.innerHTML = '';

    fetch('/api/home')
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        businessEl.innerHTML = statCardsHtml([
          { label: 'Revenue (Won)', value: data.business.revenueWon },
          { label: 'Pipeline Value', value: data.business.pipelineValue },
          { label: 'Open Deals', value: data.business.openDeals },
          { label: 'Closed This Month', value: data.business.closedThisMonth },
        ]);
        trendEl.textContent = 'This month ' + data.business.trend.thisMonth +
          ' · Last month ' + data.business.trend.lastMonth;

        projectsEl.innerHTML = data.projects.map(function (p) {
          return '<button class="project-row" data-project-id="' + p.id + '">' +
            '<div class="project-row-left">' +
              '<span class="status-dot ' + statusClass(p.status) + '"></span>' + p.name +
            '</div>' +
            '<div class="project-row-right">' +
              '<span><span class="metric-value">' + p.revenue + '</span> revenue</span>' +
              '<span><span class="metric-value">' + p.pipeline + '</span> pipeline</span>' +
              '<span><span class="metric-value">' + p.activeJobs + '</span> job' +
                (p.activeJobs === 1 ? '' : 's') + '</span>' +
              '<span class="status-badge ' + statusClass(p.status) + '">' + p.status + '</span>' +
            '</div>' +
            '</button>';
        }).join('');
        projectsEl.querySelectorAll('.project-row').forEach(function (row) {
          row.addEventListener('click', function () {
            goToProject(row.getAttribute('data-project-id'));
          });
        });

        opsEl.innerHTML = data.operations.map(function (s) {
          var clickable = s.label === 'Agents Running';
          return '<div class="stat-card' + (clickable ? ' clickable-card' : '') + '"' +
            (clickable ? ' data-goto-agents="1"' : '') + '>' +
            '<div class="value">' + s.value + '</div><div class="label">' + s.label + '</div></div>';
        }).join('');
        var agentsCard = opsEl.querySelector('[data-goto-agents]');
        if (agentsCard) {
          agentsCard.addEventListener('click', function () { activateTab('agents'); });
        }

        attentionEl.innerHTML = data.needsAttention.length
          ? '<ul class="attention-list">' + data.needsAttention.map(function (a) {
              return '<li class="attention-item" data-project-id="' + (a.projectId || '') + '">' +
                '<span class="icon">⚠</span><span>' + a.text + '</span></li>';
            }).join('') + '</ul>'
          : '<div class="attention-clear">All clear — nothing needs attention.</div>';
        attentionEl.querySelectorAll('.attention-item').forEach(function (item) {
          var pid = item.getAttribute('data-project-id');
          if (!pid) return;
          item.addEventListener('click', function () { goToProject(pid); });
        });

        feedEl.innerHTML = data.activity.length
          ? data.activity.map(function (a) {
              var clickable = !!a.agentId;
              return '<li' + (clickable ? ' class="clickable" data-agent-id="' + a.agentId + '"' : '') + '>' +
                '<span class="time">' + a.time + '</span><span>' + a.text +
                (a.projectName ? '<span class="project-tag">· ' + a.projectName + '</span>' : '') +
                '</span></li>';
            }).join('')
          : '<li>No activity yet.</li>';
        feedEl.querySelectorAll('li.clickable').forEach(function (li) {
          li.addEventListener('click', function () {
            goToAgent(li.getAttribute('data-agent-id'));
          });
        });
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
  var agentGraphRenderPromise = null;

  function agentCardHtml(agent) {
    return '<div class="agent-card' + (agent.enabled ? '' : ' agent-disabled') +
      '" data-agent-id="' + agent.id + '">' +
      '<div class="agent-card-body" data-agent-open="' + agent.id + '">' +
        '<div class="agent-card-top">' +
          '<span class="status-dot ' + statusClass(agent.status) + '"></span>' +
          '<span class="agent-card-name">' + agent.name + '</span>' +
        '</div>' +
        '<div class="agent-card-role">' + (agent.role || '&mdash;') + '</div>' +
        '<span class="status-badge ' + statusClass(agent.status) + '">' + agent.status +
          (agent.enabled ? '' : ' · OFF') + '</span>' +
      '</div>' +
      '<div class="agent-card-actions">' +
        '<button class="agent-action" data-action="toggle" title="' +
          (agent.enabled ? 'Disable' : 'Enable') + '">' + (agent.enabled ? 'Disable' : 'Enable') + '</button>' +
        '<button class="agent-action" data-action="copy" title="Duplicate this agent">Copy</button>' +
        '<button class="agent-action agent-action-danger" data-action="delete" title="Delete this agent">Delete</button>' +
      '</div>' +
    '</div>';
  }

  function bindAgentCardActions(root) {
    root.querySelectorAll('.agent-card').forEach(function (card) {
      var agentId = card.getAttribute('data-agent-id');
      var openTarget = card.querySelector('[data-agent-open]');
      if (openTarget) {
        openTarget.addEventListener('click', function () {
          openRealAgentDetail(agentId);
        });
      }
      card.querySelectorAll('.agent-action').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var action = btn.getAttribute('data-action');
          var agent = agentGraphCache.agents[agentId];
          if (!agent) return;
          if (action === 'toggle') toggleAgentEnabled(agent);
          if (action === 'copy') copyAgent(agent);
          if (action === 'delete') deleteAgent(agent);
        });
      });
    });
  }

  function loadAndRenderAgents() {
    var treeEl = document.getElementById('graph-tree');
    treeEl.innerHTML = '<div class="panel">Loading…</div>';

    return fetch('/api/agent-graph')
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (data) {
        agentGraphCache = data;

        var treeHtml = data.projects.map(function (project) {
          var workflowsHtml = project.workflows.map(function (wf) {
            var agentsHtml = wf.agents
              .map(function (a) { return agentCardHtml(agentGraphCache.agents[a.id]); })
              .join('');
            return '<div class="graph-workflow">' +
              '<div class="wf-name">' + wf.name + '</div>' +
              '<div class="graph-agents">' + agentsHtml + '</div>' +
              '</div>';
          }).join('');

          var otherAgentsHtml = '';
          if (project.otherAgents && project.otherAgents.length) {
            var otherCards = project.otherAgents
              .map(function (a) { return agentCardHtml(agentGraphCache.agents[a.id]); })
              .join('');
            otherAgentsHtml = '<div class="graph-workflow">' +
              '<div class="wf-name">Other agents in this project</div>' +
              '<div class="graph-agents">' + otherCards + '</div>' +
              '</div>';
          }

          return '<div class="graph-project" data-project-id="' + project.id + '">' +
            '<div class="proj-name">' + project.name +
            ' <span class="status-badge ' + statusClass(project.status) + '">' + project.status + '</span></div>' +
            workflowsHtml +
            otherAgentsHtml +
            '</div>';
        }).join('');

        var unassignedHtml = '';
        if (data.unassigned && data.unassigned.length) {
          unassignedHtml = '<div class="graph-project graph-unassigned">' +
            '<div class="proj-name">Unassigned Agents</div>' +
            '<div class="graph-agents">' +
              data.unassigned.map(agentCardHtml).join('') +
            '</div>' +
          '</div>';
        }

        treeEl.innerHTML = treeHtml + unassignedHtml;
        bindAgentCardActions(treeEl);

        return data;
      })
      .catch(function (err) {
        treeEl.innerHTML = '<div class="panel">Couldn\'t load — is the API configured?</div>';
        throw err;
      });
  }

  function ensureAgentsRendered() {
    if (!agentGraphRenderPromise) agentGraphRenderPromise = loadAndRenderAgents();
    return agentGraphRenderPromise;
  }

  function reloadAgents() {
    agentGraphRenderPromise = null;
    return ensureAgentsRendered();
  }

  function renderAgents() {
    ensureAgentsRendered();
  }

  function toggleAgentEnabled(agent) {
    fetch('/api/agents/' + agent.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !agent.enabled }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function () { reloadAgents(); })
      .catch(function () { alert('Could not update agent — is the API configured?'); });
  }

  function copyAgent(agent) {
    fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: agent.name + ' (Copy)',
        description: agent.role,
        status: 'IDLE',
        model: agent.model,
        max_concurrency: agent.maxConcurrency,
        enabled: agent.enabled,
        capabilities: agent.capabilities,
        project_id: agent.projectId,
      }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function () { reloadAgents(); })
      .catch(function () { alert('Could not copy agent — is the API configured?'); });
  }

  function agentUsedInWorkflow(agentId) {
    if (!agentGraphCache) return false;
    return agentGraphCache.projects.some(function (p) {
      return p.workflows.some(function (wf) {
        return wf.agents.some(function (a) { return a.id === agentId; });
      });
    });
  }

  function deleteAgent(agent) {
    var warning = agentUsedInWorkflow(agent.id)
      ? ' This agent is used in at least one workflow — removing it will leave that step unresolved.'
      : '';
    if (!confirm('Delete ' + agent.name + '?' + warning + ' This cannot be undone.')) return;

    fetch('/api/agents/' + agent.id, { method: 'DELETE' })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function () {
        closeAgentDetail();
        reloadAgents();
      })
      .catch(function () { alert('Could not delete agent — is the API configured?'); });
  }

  // ---- Home → Agents navigation ----
  function goToProject(projectId) {
    activateTab('agents');
    ensureAgentsRendered().then(function () {
      var el = document.querySelector('.graph-project[data-project-id="' + projectId + '"]');
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight');
      setTimeout(function () { el.classList.remove('highlight'); }, 1500);
    });
  }

  function goToAgent(agentId) {
    if (!agentId) return;
    activateTab('agents');
    ensureAgentsRendered().then(function () {
      openRealAgentDetail(agentId);
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

  function projectSelectHtml(currentProjectId) {
    var options = '<option value=""' + (!currentProjectId ? ' selected' : '') + '>Unassigned</option>';
    (agentGraphCache.projects || []).forEach(function (p) {
      options += '<option value="' + p.id + '"' +
        (p.id === currentProjectId ? ' selected' : '') + '>' + p.name + '</option>';
    });
    return '<select id="cfg-project">' + options + '</select>';
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
        '<label>Project' + projectSelectHtml(agent.projectId) + '</label>' +
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
    var projectValue = document.getElementById('cfg-project').value;
    var body = {
      model: document.getElementById('cfg-model').value.trim() || null,
      max_concurrency: parseInt(document.getElementById('cfg-concurrency').value, 10) || 1,
      enabled: document.getElementById('cfg-enabled').checked,
      project_id: projectValue || null,
    };
    var projectChanged = body.project_id !== agentGraphCache.agents[agentId].projectId;

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
        agent.projectId = updated.project_id;
        statusEl.textContent = 'Saved.';
        if (projectChanged) reloadAgents();
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

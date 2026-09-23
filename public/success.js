(function () {
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

  // ---- Projects (live, via /api/projects) ----
  function renderProjectsList() {
    var listEl = document.getElementById('projects-list');
    listEl.innerHTML = '<div class="panel">Loading…</div>';

    fetch('/api/projects')
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (projects) {
        listEl.innerHTML = projects.map(function (p) {
          return '<button class="project-card" data-project-id="' + p.id + '">' +
            '<div class="name">' + p.name + '</div>' +
            '<div class="desc">' + (p.description || '') + '</div>' +
            '<span class="status-badge ' + statusClass(p.status) + '">' + p.status + '</span>' +
            '</button>';
        }).join('');

        listEl.querySelectorAll('.project-card').forEach(function (card) {
          card.addEventListener('click', function () {
            showProjectDetail(card.getAttribute('data-project-id'));
          });
        });
      })
      .catch(function () {
        listEl.innerHTML = '<div class="panel">Couldn\'t load — is the API configured?</div>';
      });
  }

  function projectAgentChipHtml(agent) {
    return '<span class="agent-node" data-agent-id="' + agent.id + '">' +
      '<span class="status-dot ' + statusClass(agent.status) + '"></span>' +
      agent.name + '</span>';
  }

  function showProjectDetail(projectId) {
    var listEl = document.getElementById('projects-list');
    var detailEl = document.getElementById('project-detail');
    listEl.classList.add('hidden');
    detailEl.classList.remove('hidden');
    detailEl.innerHTML = '<button class="back-link" id="back-to-projects">&larr; All projects</button>' +
      '<div class="panel">Loading…</div>';
    document.getElementById('back-to-projects').addEventListener('click', function () {
      detailEl.classList.add('hidden');
      listEl.classList.remove('hidden');
    });

    fetch('/api/projects/' + projectId)
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (project) {
        renderProjectDetail(project, listEl, detailEl);
      })
      .catch(function () {
        detailEl.innerHTML = '<button class="back-link" id="back-to-projects">&larr; All projects</button>' +
          '<div class="panel">Couldn\'t load — is the API configured?</div>';
        document.getElementById('back-to-projects').addEventListener('click', function () {
          detailEl.classList.add('hidden');
          listEl.classList.remove('hidden');
        });
      });
  }

  function formatFileSize(bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function renderProjectDetail(project, listEl, detailEl) {
    var workflowsHtml = project.workflows.length
      ? project.workflows.map(function (wf) {
          var agentsHtml = wf.agents.map(projectAgentChipHtml).join('');
          return '<div class="workflow-block">' +
            '<div class="wf-name">' + wf.name + '</div>' +
            '<div class="workflow-steps">' + agentsHtml + '</div>' +
            '</div>';
        }).join('')
      : '<div class="v">No workflows yet.</div>';

    var jobsHtml = project.jobs.length
      ? '<ul class="job-list">' + project.jobs.map(function (j) {
          return '<li><span class="status-badge ' + statusClass(j.status) + '">' + j.status + '</span>' +
            ' <span>' + (j.workflowName || 'Job') + '</span></li>';
        }).join('') + '</ul>'
      : '<div class="v">No jobs yet.</div>';

    var activityHtml = project.activity.length
      ? project.activity.map(function (a) {
          var clickable = !!a.agentId;
          return '<li' + (clickable ? ' class="clickable" data-agent-id="' + a.agentId + '"' : '') + '>' +
            '<span class="time">' + a.time + '</span><span>' + a.text + '</span></li>';
        }).join('')
      : '<li>No activity yet.</li>';

    var logsHtml = project.logs.length
      ? project.logs.map(function (l) {
          return '<div class="log-entry">' +
            '<div class="log-entry-meta">' +
              '<span class="tool-chip">' + (l.authorName || l.authorType) + '</span>' +
              '<span class="time">' + new Date(l.createdAt).toLocaleString() + '</span>' +
            '</div>' +
            '<div class="log-entry-content">' + l.content + '</div>' +
            '</div>';
        }).join('')
      : '<div class="v">No log entries yet.</div>';

    var filesHtml = project.files.length
      ? '<ul class="file-list">' + project.files.map(function (f) {
          return '<li data-file-id="' + f.id + '">' +
            '<div class="file-info">' +
              '<span class="file-name">' + f.filename + '</span>' +
              '<span class="file-meta">' + formatFileSize(f.sizeBytes) + ' &middot; ' +
                (f.uploadedBy || 'Unknown') + ' &middot; ' + new Date(f.createdAt).toLocaleDateString() +
              '</span>' +
            '</div>' +
            '<div class="file-actions">' +
              '<a class="agent-action" href="/api/projects/' + project.id + '/files/' + f.id + '">Download</a>' +
              '<button class="agent-action agent-action-danger" data-delete-file="' + f.id + '">Delete</button>' +
            '</div>' +
            '</li>';
        }).join('') + '</ul>'
      : '<div class="v">No files yet.</div>';

    detailEl.innerHTML =
      '<button class="back-link" id="back-to-projects">&larr; All projects</button>' +

      '<div class="project-detail-header">' +
      '<input type="text" id="proj-name-input" class="proj-name-input" value="' +
        project.name.replace(/"/g, '&quot;') + '" />' +
      '<span class="status-badge ' + statusClass(project.status) + '">' + project.status + '</span>' +
      '</div>' +
      '<textarea id="proj-desc-input" class="proj-desc-input" placeholder="Short description…">' +
        (project.description || '') + '</textarea>' +
      '<div class="proj-save-row">' +
        '<button id="proj-header-save">Save name &amp; description</button>' +
        '<span id="proj-header-save-status" class="cfg-save-status"></span>' +
      '</div>' +

      '<div class="section-label">Project Details</div>' +
      '<div class="panel">' +
        '<textarea id="proj-details-input" class="proj-details-input" placeholder="Industry, opportunity, instructions for agents working this project…">' +
          (project.details || '') + '</textarea>' +
        '<div class="proj-save-row">' +
          '<button id="proj-details-save">Save details</button>' +
          '<span id="proj-details-save-status" class="cfg-save-status"></span>' +
        '</div>' +
      '</div>' +

      '<div class="section-label">Stage Status</div>' +
      '<div class="panel">' +
        '<div class="v" style="margin-bottom:8px;">Workflows</div>' +
        workflowsHtml +
        '<div class="v" style="margin:12px 0 8px;">Jobs</div>' +
        jobsHtml +
      '</div>' +

      '<div class="section-label">Activity</div>' +
      '<div class="panel"><ul class="activity-feed">' + activityHtml + '</ul></div>' +

      '<div class="section-label">Log</div>' +
      '<div class="panel">' +
        '<div id="proj-logs">' + logsHtml + '</div>' +
        '<div class="log-add-row">' +
          '<textarea id="proj-log-input" placeholder="Add a note…"></textarea>' +
          '<button id="proj-log-add-btn">Post</button>' +
        '</div>' +
      '</div>' +

      '<div class="section-label">Files</div>' +
      '<div class="panel">' +
        '<div id="proj-files">' + filesHtml + '</div>' +
        '<div class="file-add-row">' +
          '<input type="file" id="proj-file-input" />' +
          '<button id="proj-file-upload-btn">Upload</button>' +
          '<span id="proj-file-upload-status" class="cfg-save-status"></span>' +
        '</div>' +
        '<div class="detail-controls-note">Max 5MB per file.</div>' +
      '</div>';

    document.getElementById('back-to-projects').addEventListener('click', function () {
      detailEl.classList.add('hidden');
      listEl.classList.remove('hidden');
    });

    detailEl.querySelectorAll('.agent-node[data-agent-id]').forEach(function (node) {
      node.addEventListener('click', function () {
        goToAgent(node.getAttribute('data-agent-id'));
      });
    });
    detailEl.querySelectorAll('li.clickable[data-agent-id]').forEach(function (li) {
      li.addEventListener('click', function () {
        goToAgent(li.getAttribute('data-agent-id'));
      });
    });

    document.getElementById('proj-header-save').addEventListener('click', function () {
      saveProjectField(project.id, {
        name: document.getElementById('proj-name-input').value.trim(),
        description: document.getElementById('proj-desc-input').value.trim(),
      }, 'proj-header-save-status');
    });
    document.getElementById('proj-details-save').addEventListener('click', function () {
      saveProjectField(project.id, {
        details: document.getElementById('proj-details-input').value,
      }, 'proj-details-save-status');
    });
    document.getElementById('proj-log-add-btn').addEventListener('click', function () {
      addProjectLog(project.id);
    });
    document.getElementById('proj-file-upload-btn').addEventListener('click', function () {
      uploadProjectFile(project.id);
    });
    detailEl.querySelectorAll('[data-delete-file]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteProjectFile(project.id, btn.getAttribute('data-delete-file'));
      });
    });
  }

  function saveProjectField(projectId, fields, statusElId) {
    var statusEl = document.getElementById(statusElId);
    statusEl.textContent = 'Saving…';
    fetch('/api/projects/' + projectId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function () {
        statusEl.textContent = 'Saved.';
        if ('name' in fields) {
          renderProjectsList();
          renderHome();
          reloadAgents();
        }
      })
      .catch(function () {
        statusEl.textContent = 'Failed to save.';
      });
  }

  function addProjectLog(projectId) {
    var input = document.getElementById('proj-log-input');
    var content = input.value.trim();
    if (!content) return;

    fetch('/api/projects/' + projectId + '/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content }),
    })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function (entry) {
        input.value = '';
        var logsEl = document.getElementById('proj-logs');
        var emptyState = logsEl.querySelector('.v');
        if (emptyState) logsEl.innerHTML = '';
        var entryHtml = '<div class="log-entry">' +
          '<div class="log-entry-meta">' +
            '<span class="tool-chip">' + entry.authorName + '</span>' +
            '<span class="time">' + new Date(entry.createdAt).toLocaleString() + '</span>' +
          '</div>' +
          '<div class="log-entry-content">' + entry.content + '</div>' +
          '</div>';
        logsEl.insertAdjacentHTML('afterbegin', entryHtml);
      })
      .catch(function () {
        alert('Could not post log entry — is the API configured?');
      });
  }

  function uploadProjectFile(projectId) {
    var input = document.getElementById('proj-file-input');
    var statusEl = document.getElementById('proj-file-upload-status');
    var file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      statusEl.textContent = 'File is larger than 5MB.';
      return;
    }

    var formData = new FormData();
    formData.append('file', file);

    statusEl.textContent = 'Uploading…';
    fetch('/api/projects/' + projectId + '/files', { method: 'POST', body: formData })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || 'Upload failed'); });
        return r.json();
      })
      .then(function (f) {
        statusEl.textContent = '';
        input.value = '';
        var filesEl = document.getElementById('proj-files');
        var emptyState = filesEl.querySelector('.v');
        if (emptyState) filesEl.innerHTML = '<ul class="file-list"></ul>';
        var list = filesEl.querySelector('.file-list');
        var li = document.createElement('li');
        li.setAttribute('data-file-id', f.id);
        li.innerHTML = '<div class="file-info">' +
            '<span class="file-name">' + f.filename + '</span>' +
            '<span class="file-meta">' + formatFileSize(f.sizeBytes) + ' &middot; ' +
              f.uploadedBy + ' &middot; ' + new Date(f.createdAt).toLocaleDateString() +
            '</span>' +
          '</div>' +
          '<div class="file-actions">' +
            '<a class="agent-action" href="/api/projects/' + projectId + '/files/' + f.id + '">Download</a>' +
            '<button class="agent-action agent-action-danger" data-delete-file="' + f.id + '">Delete</button>' +
          '</div>';
        list.appendChild(li);
        li.querySelector('[data-delete-file]').addEventListener('click', function () {
          deleteProjectFile(projectId, f.id);
        });
      })
      .catch(function (err) {
        statusEl.textContent = err.message || 'Upload failed.';
      });
  }

  function deleteProjectFile(projectId, fileId) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    fetch('/api/projects/' + projectId + '/files/' + fileId, { method: 'DELETE' })
      .then(function (r) {
        if (!r.ok) throw new Error('Request failed: ' + r.status);
        return r.json();
      })
      .then(function () {
        var li = document.querySelector('#proj-files li[data-file-id="' + fileId + '"]');
        if (li) li.remove();
      })
      .catch(function () {
        alert('Could not delete file — is the API configured?');
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
            otherAgentsHtml = '<div class="graph-workflow graph-workflow-top">' +
              '<div class="wf-name">Project Leadership</div>' +
              '<div class="graph-agents">' + otherCards + '</div>' +
              '</div>';
          }

          return '<details class="graph-project" data-project-id="' + project.id + '">' +
            '<summary class="proj-name">' + project.name +
            ' <span class="status-badge ' + statusClass(project.status) + '">' + project.status + '</span></summary>' +
            '<div class="graph-project-body">' +
            otherAgentsHtml +
            workflowsHtml +
            '</div>' +
            '</details>';
        }).join('');

        var unassignedHtml = '';
        if (data.unassigned && data.unassigned.length) {
          unassignedHtml = '<details class="graph-project graph-unassigned">' +
            '<summary class="proj-name">Unassigned Agents</summary>' +
            '<div class="graph-project-body">' +
            '<div class="graph-agents">' +
              data.unassigned.map(agentCardHtml).join('') +
            '</div>' +
            '</div>' +
          '</details>';
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
      el.open = true;
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

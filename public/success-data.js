// Mock data for the CEO Terminal dashboard shell (Phase 0 — no backend yet).
// Shapes here mirror the agents/workflows/projects/jobs/events model in
// docs/AGENT_OS_PLAN.md so Phase 1.5 can swap this out for real API calls
// without changing the rendering code.

// Command Center now comes from /api/command-center (Phase 1). The
// Projects and Agent Graph views below are still mock data — they go live
// in Phase 1.5 once the Projects UI and its API exist.
window.MOCK_DATA = {
  projects: [
    {
      id: 'project-a',
      name: 'Project A',
      status: 'ACTIVE',
      description: 'Example project — research, qualify, and act on a list of targets.',
      workflowIds: ['workflow-a1'],
      agentIds: ['agent-1', 'agent-2', 'agent-3'],
    },
    {
      id: 'project-b',
      name: 'Project B',
      status: 'ACTIVE',
      description: 'Example project — outreach and follow-up pipeline.',
      workflowIds: ['workflow-b1'],
      agentIds: ['agent-3', 'agent-4', 'agent-5'],
    },
    {
      id: 'project-c',
      name: 'Project C',
      status: 'IDLE',
      description: 'Example project — not currently running any jobs.',
      workflowIds: ['workflow-c1'],
      agentIds: ['agent-6'],
    },
  ],

  workflows: {
    'workflow-a1': {
      id: 'workflow-a1',
      name: 'Workflow A1',
      projectId: 'project-a',
      steps: ['agent-1', 'agent-2', 'agent-3'],
    },
    'workflow-b1': {
      id: 'workflow-b1',
      name: 'Workflow B1',
      projectId: 'project-b',
      steps: ['agent-3', 'agent-4', 'agent-5'],
    },
    'workflow-c1': {
      id: 'workflow-c1',
      name: 'Workflow C1',
      projectId: 'project-c',
      steps: ['agent-6'],
    },
  },

  agents: {
    'agent-1': {
      id: 'agent-1',
      name: 'Agent 1',
      role: 'Research',
      status: 'RUNNING',
      currentTask: 'Gathering source records for target #482',
      startedAgo: '2m 14s ago',
      lastEvent: 'Found 17 matching records',
      tasksToday: 143,
      errors: 0,
      tools: ['Web Search', 'Database'],
      log: [
        '10:44:21  Started',
        '10:44:23  Retrieved source list',
        '10:44:24  Filtered to 17 matches',
      ],
    },
    'agent-2': {
      id: 'agent-2',
      name: 'Agent 2',
      role: 'Qualification',
      status: 'RUNNING',
      currentTask: 'Scoring target #482',
      startedAgo: '41s ago',
      lastEvent: 'Applied scoring rules',
      tasksToday: 121,
      errors: 1,
      tools: ['Database'],
      log: [
        '10:45:02  Started',
        '10:45:05  Loaded scoring rules',
        '10:45:07  Rate limited, retrying',
      ],
    },
    'agent-3': {
      id: 'agent-3',
      name: 'Agent 3',
      role: 'Analysis',
      status: 'RUNNING',
      currentTask: 'Calculating estimated yield for #18392',
      startedAgo: '3m 02s ago',
      lastEvent: 'Calculated estimated yield',
      tasksToday: 98,
      errors: 0,
      tools: ['Database', 'Web Search'],
      log: [
        '10:44:21  Started',
        '10:44:23  Retrieved record',
        '10:44:24  Retrieved comps',
        '10:44:27  Calculated yield',
      ],
    },
    'agent-4': {
      id: 'agent-4',
      name: 'Agent 4',
      role: 'Outreach',
      status: 'IDLE',
      currentTask: null,
      startedAgo: null,
      lastEvent: 'Completed outreach batch',
      tasksToday: 56,
      errors: 0,
      tools: ['Email', 'CRM'],
      log: [
        '10:41:40  Started batch',
        '10:41:55  Completed outreach batch',
      ],
    },
    'agent-5': {
      id: 'agent-5',
      name: 'Agent 5',
      role: 'Follow-up',
      status: 'QUEUED',
      currentTask: 'Waiting for outreach batch to complete',
      startedAgo: null,
      lastEvent: null,
      tasksToday: 12,
      errors: 0,
      tools: ['Email', 'CRM'],
      log: [
        '10:41:55  Queued',
      ],
    },
    'agent-6': {
      id: 'agent-6',
      name: 'Agent 6',
      role: 'Research',
      status: 'IDLE',
      currentTask: null,
      startedAgo: null,
      lastEvent: null,
      tasksToday: 0,
      errors: 0,
      tools: ['Web Search'],
      log: [],
    },
  },
};

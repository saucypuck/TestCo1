# CEO Terminal / Agent OS — Gameplan

Status: planning doc, not yet implemented.
Scope: turn the `/success` page (currently a static "success" label) into a live
command center for multiple agents, without touching the password gate on `/`.

## Guiding principles

- Agents are **capabilities**. Workflows **combine** capabilities. Projects
  **group** workflows and agents by initiative. Jobs are a **project's
  workflow, running**. None of those layers should be hard-wired to each
  other — they talk through a shared DB + job queue, never directly. Resist
  the urge to have Agent A call Agent B's code directly, or to give the
  dashboard agent-specific UI instead of generic project/job/event views.
- **Git is the source of code truth. The database is the source of
  operational truth.** Implementation, instructions, and tool code live in
  Git and change via deploy. Whether an agent is enabled, which model it
  uses, its concurrency limit, which project it belongs to, and whether a
  workflow is active all live in the DB and change without a code deploy.
  This split is what lets the terminal be a *control* plane, not just a
  read-only view of what got deployed.
- The command center is an operations tool, not a monitoring dashboard: you
  should be able to see what every agent/workflow/project is doing *and* act
  on it (pause, retry, run manually, edit configuration) from the same
  screen.

## Current state (baseline)

- Single Render **Web Service** (`testco1`), Node/Express, free plan.
- No database, no queue, no auth beyond the client-side `test123` gate.
- `server.js` serves two static HTML strings for `/` and `/success`.

Keep the stack Node/TypeScript throughout (API, worker, dashboard) rather than
introducing Python — one language, one deploy pipeline, and Express is already
in place. Individual agents can still shell out to Python/other tools later if
a specific capability needs it; that's a tool-layer detail, not an
architecture decision.

## The three primary views

The dashboard should be built around these from the start (even the Phase 0
mock version), not around a flat agent list:

1. **Command Center** — the CEO-level overview: active jobs, agents running,
   tasks today, errors, plus a live activity feed across all projects.
2. **Projects** — one row per project (`PROPERTY ACQUISITION`, `AFFILIATE
   OUTREACH`, ...) with a status (active/idle). Click one to see its
   workflows, its agents, its jobs, and its activity in isolation.
3. **Agent Graph** — a live org chart: `Project → Workflow → Agent → Task →
   Events`, each node showing real-time state (status, current task, started
   N ago, last event, tasks today, errors). Clicking a node drills into that
   agent/workflow/job's detail view.

Detail views and the controls they expose (wired up progressively — read-only
first, actions later):

- **Agent**: status, version, capabilities, instructions, tools,
  configuration, recent jobs, errors, logs — with `Pause`, `Restart`, `Edit
  Configuration`, `View Code`, `View Logs`, `Test`, `Run Manually`.
- **Workflow**: steps, agents, configuration, recent executions, performance
  — with `Run`, `Pause`, `Edit`, `Duplicate`.
- **Job**: current step, agent, inputs, outputs, events, errors, timeline —
  with `Pause`, `Resume`, `Cancel`, `Retry`.

## Phases

### Phase 0 — Dashboard shell (no backend yet)

Replace the static `/success` response with a real page: static/mock data,
laid out around the three primary views above (Command Center numbers +
activity feed; a couple of mock Projects; a mock Agent Graph for one
project). No DB, no API — just proves out the UI/IA and gives something to
demo immediately. Building the shell around Projects/Agent Graph now avoids
redoing the layout in Phase 1.5.

Files touched: `server.js` (or split the success route into a `public/`
static bundle / React page once it's no longer trivial).

### Phase 1 — Persistence + Control API

- Add a Render **PostgreSQL** instance.
- Schema: `agents`, `jobs`, `tasks`, `events`, `workflows` (see table shapes
  below).
- Extend the existing Express app into the **control API**:
  `GET /api/agents`, `GET /api/jobs`, `GET /api/jobs/:id`,
  `GET /api/jobs/:id/events`.
- Dashboard (Phase 0 shell) switches from mock data to these endpoints.

At this size, keep API + dashboard as **one Render web service**. Don't split
yet.

### Phase 1.5 — Projects + Agent Graph

- Add a `projects` table (id, name, description, status, configuration,
  created_at).
- Add `project_id` to `workflows`, and an optional `project_agents` join
  table for agents explicitly associated with a project (agents can still be
  shared across projects — that's the point).
- API: `GET /api/projects`, `GET /api/projects/:id` (its workflows, agents,
  jobs, activity).
- Build the **Projects** and **Agent Graph** views for real against this
  data, replacing the Phase 0 mocks. Agent Graph nodes read live status from
  `agents`/`tasks`/`events` — same data Phase 1's job views already use, just
  reorganized as a graph instead of a list.
- Controls stay read-only in this phase (views + drill-down only); wiring up
  `Pause` / `Run Manually` / `Retry` etc. happens once the job queue and
  worker exist (Phase 2+), since those actions need something on the other
  end to act on.

This phase is primarily UI + one new table — it doesn't change the
agent/workflow/job/event model from Phase 1, it groups it.

### Phase 2 — Job queue + worker

- Add a Render **Background Worker** service (`agent-worker`).
- Start the queue as **Postgres-backed** (a `jobs` table with a `status`
  column and `SELECT ... FOR UPDATE SKIP LOCKED`) — skip Redis until there's
  an actual throughput/latency reason for it. One fewer service to run and
  pay for on free/starter tiers.
- Worker polls for queued jobs, executes workflow steps in order, writes an
  `events` row per step transition (`research.started`,
  `research.completed`, etc.).
- This is also where `Run Manually`, `Cancel`, and `Retry` become real: those
  actions just enqueue/update a `jobs` row, which the worker already knows
  how to pick up.

### Phase 3 — Common agent interface + registry

- Define one TypeScript interface every agent implements:
  ```ts
  interface Agent {
    name: string;
    capabilities(): string[];
    run(task: Task, context: Context): Promise<Result>;
    health(): Promise<HealthStatus>;
  }
  ```
- Each agent lives under `agent-runtime/agents/<name>/` as a module — not a
  separate Render service.
- Registering an agent = adding a row to the `agents` table (name,
  description, capabilities, version, status, `enabled`, `model`,
  `max_concurrency`, `project_id`) + the module export. Code defines *what
  the agent can do*; the DB row defines *whether/how it's currently allowed
  to run* — which is what makes `Pause Agent` and `Edit Configuration` work
  without a redeploy.
- The worker looks agents up by name from the registry, so it never
  hard-codes which agents exist.

### Phase 4 — Tool layer

- Separate "how an agent reasons" from "what an agent can touch."
  `agent-runtime/tools/` holds shared, credential-holding wrappers: web
  search, browser, email, CRM, DB, MCP. Agents import tools; tools never
  import agents.
- This is what makes swapping a provider (e.g. one email API for another)
  a one-file change instead of a hunt through every agent.

### Phase 5 — Workflows as data

- `workflows` table stores step lists as JSON:
  ```json
  { "name": "property_lead_acquisition",
    "project_id": "...",
    "steps": [{"agent": "lead_finder"}, {"agent": "property_researcher"},
              {"agent": "qualification"}, {"agent": "outreach"},
              {"agent": "followup"}] }
  ```
- Worker reads a workflow, runs each step's agent in order, one `jobs` row
  per run, one `tasks` row per step. New workflows are new DB rows, not new
  code. `enabled` on a workflow row is what backs the `Pause`/`Run` controls
  from the detail view.

### Phase 6 — Live event stream to the dashboard

- Add Server-Sent Events (`GET /api/jobs/:id/stream`) from the control API
  reading new `events` rows — simplest option on Render, no extra
  infrastructure (WebSockets work too but SSE is enough for one-directional
  status updates).
- Command Center, Projects, and Agent Graph views all subscribe and update
  live (per-agent status, last action, timestamps) instead of polling.

### Phase 7 — Extract only what needs scaling

- Default: all agents run inside `agent-worker`.
- If one agent (e.g. `outreach`) becomes resource-heavy, flaky, or needs
  different dependencies, pull it into its own Render service
  (`outreach-worker`) that reads from the same job queue. Everything else
  stays put. This is a scaling decision made later with evidence, not a
  starting assumption.

### Phase 8 — Optional: visual workflow editor

- Only after Phases 0–6 are solid. A drag/connect UI that writes the same
  JSON shape from Phase 5 into `workflows`. Pure UI sugar over data that
  already exists — no rush.

## Render footprint by phase

| Phase | Services |
|---|---|
| 0–1.5 | 1 Web Service (dashboard+API) |
| 2   | + 1 Background Worker, + 1 Postgres |
| 3–6 | same (agents/tools/workflows/events/projects live in code + DB rows, not new services) |
| 7   | + extra worker services, only for the specific agent(s) that need isolation |
| —   | Redis: add only when the Postgres-backed queue actually becomes a bottleneck |

## Table shapes (Phase 1 + 1.5)

```
projects      id, name, description, status, configuration (jsonb), created_at
agents        id, name, description, type, status, enabled, model, max_concurrency, version, capabilities (jsonb), configuration (jsonb), project_id (nullable), last_heartbeat, created_at
workflows     id, name, project_id, enabled, steps (jsonb), created_at
jobs          id, workflow_id, project_id, status, started_at, completed_at
tasks         id, job_id, agent_name, status, started_at, completed_at
events        id, job_id, task_id, type, payload (jsonb), created_at
```

`agents.project_id` is nullable on purpose — agents can be shared across
projects (e.g. a `research_agent` used by both `PROPERTY ACQUISITION` and
`AFFILIATE OUTREACH`); `project_agents` (join table) can replace the FK later
if an agent ends up belonging to more than one project at a time.

## Immediate next step

Phase 0 (dashboard shell) can be built right now on top of the current
Express app with zero new infrastructure — build its layout around Command
Center / Projects / Agent Graph from the start so Phase 1.5 is a data swap,
not a redesign.

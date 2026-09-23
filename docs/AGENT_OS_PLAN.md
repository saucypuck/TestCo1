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

## Current state (as of Home/Agents rework)

- Single Render **Web Service** (`testco1`), Node/Express, free plan.
- **Supabase Postgres** (project `testco1`, id `iqpwpkravswicaqrbygq`) — a
  dedicated project, deliberately separate from any other Supabase project
  on the account. Connected via a plain `pg` `DATABASE_URL` (not the
  Supabase SDK), so the code isn't tied to Supabase specifically. RLS is
  enabled on every table (the app connects as `postgres`, which bypasses
  RLS; it only blocks the public REST/anon access this app doesn't use).
- No queue yet, no auth beyond the client-side `test123` gate (also true of
  `/api/*` — no server-side auth yet, see the security note in the
  "Home/Agents rework" history below).
- Tabs are now **Home**, **Projects**, **Agents** (renamed from "Command
  Center"/"Agent Graph" partway through — see below).
- **Home** and **Agents** are live against Supabase. **Projects** is still
  mock data (`public/success-data.js`) — deliberately left alone until its
  own real feature (see "Projects: per-project knowledge base" below).

Keep the stack Node/TypeScript throughout (API, worker, dashboard) rather than
introducing Python — one language, one deploy pipeline, and Express is already
in place. Individual agents can still shell out to Python/other tools later if
a specific capability needs it; that's a tool-layer detail, not an
architecture decision.

## The three primary views

The dashboard is built around these three tabs, not a flat agent list:

1. **Home** (originally "Command Center") — the CEO-level overview: business
   metrics (revenue won, pipeline value, open deals, deals closed this
   month — from a `deals` table) plus agent-ops metrics (active jobs, agents
   running, tasks today, errors), plus a live activity feed. Live since the
   Home/Agents rework.
2. **Projects** — one row per project, click to see its workflows/agents.
   Still mock data on purpose: the plan is for this tab to eventually hold
   per-project **`.md` instructions** — industry context, the opportunity,
   whatever an agent needs to know to work a project competently — readable
   by both humans and agents. Not scoped/built yet; capturing the intent
   here so it isn't lost. Likely shape when it happens: a `project_docs` (or
   similar) table/storage bucket holding markdown per project, surfaced both
   in this tab and to agents at run time as context.
3. **Agents** (originally "Agent Graph") — a live org chart: `Project →
   Workflow → Agent`, each node showing real-time state (status, current
   task, last event, tasks today, errors) sourced from `agents`/`tasks`/
   `events`. Clicking a node opens a detail panel where you can view/add the
   agent's **skills** (`agents.capabilities`) and edit its **configuration**
   (`model`, `max_concurrency`, `enabled`) — both real, persisted writes.

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

### Phase 0 — Dashboard shell (shipped)

Replaced the static `/success` response with a real page: static/mock data,
laid out around the three primary views (stat cards + activity feed; a
couple of mock Projects; a mock org-chart view for one project). No DB, no
API — just proved out the UI/IA. Files: `public/success.html/.css/.js`,
`public/success-data.js`.

### Phase 1 — Persistence + Control API (shipped, on Supabase not Render PG)

- Supabase Postgres project (see "Current state" above), not Render's own
  Postgres — this session had tools to provision/migrate Supabase directly;
  Render Postgres would have needed manual dashboard steps with no way to
  automate them from here. Connected generically via `DATABASE_URL` + `pg`,
  so this isn't a hard lock-in to Supabase specifically.
- Schema: `agents`, `jobs`, `tasks`, `events`, `workflows`, `projects`,
  `deals` (see table shapes below — `projects` and `deals` landed slightly
  ahead of their originally-planned phases since the Home/Agents rework
  needed them immediately).
- Control API: `GET /api/home`, `GET /api/agents`, `GET /api/agent-graph`,
  `GET /api/jobs`, `GET /api/jobs/:id`, `GET /api/jobs/:id/events`,
  `PATCH /api/agents/:id`, `POST /api/agents/:id/capabilities`.
- One Render web service serves both the dashboard and this API — no split.

### Phase 1.5 — Projects + Agent Graph (partially shipped)

- `projects` table exists and is seeded (see Phase 1). The **Agents** tab
  (`GET /api/agent-graph`) is fully live against `projects` → `workflows` →
  `agents`/`tasks`/`events`.
- The **Projects** tab itself is still mock — intentionally not wired to
  `projects` yet, since its real purpose (per-project `.md` knowledge base,
  see "The three primary views" above) isn't built. When that happens, this
  tab will read from `projects` for real at the same time.
- Agent controls beyond viewing are partially live: `Edit Configuration`
  and adding a skill are real writes now (ahead of Phase 3's original
  timeline for this). `Pause` / `Restart` / `Run Manually` are still
  disabled — those need the job queue/worker (Phase 2).

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
- Home, Projects, and Agents views all subscribe and update live (per-agent
  status, last action, timestamps) instead of polling.

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

## Table shapes (Phase 1 + 1.5, as actually created on Supabase)

```
projects      id, name, description, status, configuration (jsonb), created_at
agents        id, name, description, type, status, enabled, model, max_concurrency, version, capabilities (jsonb), configuration (jsonb), project_id (nullable), last_heartbeat, created_at
workflows     id, name, project_id, enabled, steps (jsonb), created_at
jobs          id, workflow_id, project_id, status, started_at, completed_at
tasks         id, job_id, agent_name, status, started_at, completed_at
events        id, job_id, task_id, type, payload (jsonb), created_at
deals         id, name, stage (OPEN/WON/LOST), value (numeric), project_id, agent_name, created_at, closed_at
```

`agents.project_id` is nullable on purpose — agents can be shared across
projects; `project_agents` (join table) can replace the FK later if an agent
ends up belonging to more than one project at a time.

`deals` backs Home's business metrics (revenue won, pipeline value, open
deals, closed this month). Currently seeded placeholder data — nothing
writes to it yet since no agent is closing real deals (that starts to
become real once Phase 2's worker exists and an outreach/sales-type agent
runs for real).

## Immediate next step

Phase 2 — job queue + worker — is the next unblocked step: it's what turns
`currentTask`/`tasksToday`/`errors` on the Agents tab, the activity feed on
Home, and eventually `deals`, from seeded placeholder rows into numbers a
real agent produced. `Pause` / `Restart` / `Run Manually` also only become
meaningful once something is actually running to act on.

# TestCo1

Minimal Node/Express site deployed on Render (`https://testco1.onrender.com`,
service `srv-dakmhfbm8hqs73f48780`). Deploys automatically on push to `main`
via `render.yaml`.

- `/` — password gate (`test123`, hardcoded in `server.js`), client + server
  side check.
- `/success` — post-login page. This is being built out into a "CEO
  Terminal" agent command center; see below.

## Active plan: CEO Terminal / Agent OS

Full architecture and phased gameplan: [docs/AGENT_OS_PLAN.md](docs/AGENT_OS_PLAN.md).

Read that doc before making structural changes to `/success`, adding
agents/workflows/jobs infrastructure, or introducing new Render services —
it defines the phase sequence (dashboard shell → Postgres/control API →
Projects/Agent Graph → job queue/worker → agent registry → tool layer →
workflows-as-data → live events → selective extraction) and the two rules to
protect as it grows:

1. Agents/workflows/projects/jobs talk through a shared DB + job queue, never
   directly to each other.
2. Git is the source of code truth; the database is the source of
   operational truth (enabled/disabled, config, model, project assignment —
   all DB, not code).

Keep the login page (`/`) unchanged unless explicitly asked.

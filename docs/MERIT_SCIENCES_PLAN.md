# Merit Sciences — Agent Org Tree & Chief of Staff Design

Status: research + architecture only, per your instruction — no code, no new
agents/projects created yet. This is the design to review before I build it
into TestCo1's `agents`/`workflows`/`projects` schema.

## 1. What this system is (restated narrowly)

Two acquisition tracks, one shared engine, one objective: **completed
qualified signups** — Track A (affiliate, `/affiliate`) and Track B
(physician portal, `/practitioners`). Everything below exists only to move
those two numbers. Diagnostic metrics (opens, clicks, replies) are inputs to
a bottleneck-diagnosis loop, never the target themselves.

## 2. Site verification (fetched directly today)

**Homepage**: 32 compounds in stock, licensed US compounding facility (San
Antonio), tested by ILS Laboratories (ISO/IEC 17025 accredited), QR-code →
public COA library per lot, fentanyl-screened every batch, ≥99% HPLC purity,
48hr dispatch, from $0.17/mg. 95 certificates published.

**Affiliate page** (`/affiliate`) — matches your campaign doc exactly: flat
20% commission on every order including reorders forever, no tiers, no
approval queue (live in 60 seconds), monthly PayPal payout at $50 min after
a 30-day refund window, 15% affiliate self-purchase discount, custom
discount code + referral link. FAQ explicitly denies MLM/pyramid structure
and states the brand-only promotion rule.

**Practitioner page** (`/practitioners`) — matches your doc: license + NPI
verification (~1 business day, checked against state + NPPES records), no
minimums, no contracts, account pricing hidden until verified, full 8-point
release panel (identity, purity, net content, heavy metals, sterility,
endotoxin, particulate matter, fentanyl) published per lot before purchase.
Notably mentions **acetate vs. TFA** as a differentiator not in your doc —
"we pay for the acetate exchange most discount sources skip... it shows up
in the assay, not the invoice" — a concrete, verifiable claim worth testing
as a proof point for the sourcing-skeptic segment.

## 3. Regulatory grounding (new research)

Fetched current FDA/state enforcement analysis (Frier Levitt, April 2026 CDER
warning letter batch). Confirms and sharpens what your outreach research
already assumed:

- Enforcement targets **vendors/distributors**, not end buyers — specifically
  "high-volume sterile compounding operations that appear to function more
  like manufacturers than traditional pharmacies."
- **RUO labeling does not shield a seller** — the FDA infers intended use
  from surrounding marketing context (semaglutide/tirzepatide/retatrutide
  and BPC-157 were named targets in the April 2026 letters).
- State boards are pulling in "clinics or terminal distributors of dangerous
  drugs" authority, not just pharmacy-specific power.
- Enforcement is described as **selective but escalating** — current
  non-enforcement of a given seller is lag, not safety.

This validates the existing risk-mitigation/necessity framing in your v6
sequence (documentation transparency, independent lab, licensed facility) —
it's a genuine differentiator against the enforcement pattern, not just a
trust signal. It also validates the affiliate program's brand-only rule as
real risk management, not boilerplate — Amino Asylum's exposure came from
consumer-facing results claims, which is exactly the failure mode Tier 1/2
targeting (practitioner-audience affiliates only) is designed to avoid.

## 4. Architecture research (new)

Your instructions (section 18) ask me to check for existing frameworks
before building from scratch. Confirmed: **research → score → personalize →
outreach → CRM-sync**, orchestrated as a directed graph (LangGraph or
equivalent), is an established, multiple-times-implemented OSS pattern —
e.g. `kaymen99/sales-outreach-automation-langgraph` (research/qualification/
outreach nodes, HubSpot/Airtable/Sheets + Gmail). None of the examples found
plug into Instantly + Seamless specifically, and license terms on the
closest match are unclear, so the recommendation is **adopt the pattern, not
the code**: the five-stage pipeline shape below is that validated shape,
built fresh against your actual tools (Instantly, Seamless, TestCo1's own
Postgres) rather than forked from an unrelated stack.

## 5. Current live state (pulled directly from Instantly just now — more
current than the pasted register, which is 12 days old)

| Campaign | Status | Leads | Sent | Replies (uniq) | Clicks (uniq) | Bounced | Opportunities |
|---|---|---|---|---|---|---|---|
| Arm C (3-variant opener) | Active, healthy | 969 | 2,944 | 30 (26) | 124 (51) | 14 | **6 / $6,000** |
| Arm A (v6 control) | Active | 162 | 806 | 3 (3) | 2 (2) | 3 | 0 |
| Arm B (proof ladder) | Active | 169 | 641 | 2 (2) | 21 (6) | 4 | 0 |
| Production v6 | **Paused** | 653 | 265 | 1 (1) | 2 (2) | 4 | 0 |
| Affiliate Tier 1 | Active | 32 | 75 | 0 | 0 | 2 | 0 |
| Affiliate Tier 2 | Active | 49 | 171 | 0 (0, but 1 automatic) | 3 (3) | 0 | 0 |

Sending infrastructure: **50 mailboxes across 10 domains**, all warmup score
100, 20/day per mailbox (Arm C alone is provisioned to 640/day on its
share). Arm C's sending-status diagnostic right now is healthy —
"follow_up_delay_not_met" with 283 follow-ups correctly waiting out their
cadence, 494/640 sent today, no action needed.

**Three findings that change the register's picture:**

1. **Blocker 1 ("no conversion visibility") is partially resolved.** Instantly
   is now tracking 12 "opportunities" workspace-wide worth $12,000, 6 of
   them ($6,000) on Arm C specifically. I don't know whether these are
   auto-detected from replies or manually tagged — worth confirming — but
   this is a real signal the 2026-09-11 register didn't have.
2. **Arm C has pulled decisively ahead** (969 leads, 512 completed the full
   sequence, real pipeline value) while Arm A and Arm B remain near-dead
   controls. Per your own experimentation rule (section 11: exploit winners,
   keep some exploration), continued flat three-way opener testing on
   openers is past its useful life — this matches what your own hypothesis
   backlog already concluded (#6/#11 converging, persona > copy). Capacity
   should shift toward the queued segmentation hypotheses (#9 medical
   directors vs. owners, #12 men's health/TRT vs. med spas), not more
   opener variants.
3. **The affiliate tracks are the real bottleneck, not the practitioner
   track.** 246 emails sent across both tiers, zero replies. That's not "not
   enough volume yet" — Arm C got its first replies well under that send
   count. This points at targeting or message-market fit, not send volume,
   and is exactly the kind of signal section 2's bottleneck-diagnosis loop
   should be built to catch and act on automatically rather than just
   report.

Open question for you: is the scheduled task's permission-mode blocker (Blocker
0 in the register — couldn't write, had to be switched to "act without
asking") actually fixed? The lead growth on Arm C since 9/11 suggests
something has been sourcing/loading successfully, but I can't confirm from
here whether that's the scheduled run or manual work.

## 6. Proposed agent org tree

```
                    CHIEF OF STAFF
                 (Acquisition Controller)
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   TRACK A            TRACK B          SHARED AGENTS
  (Affiliate)      (Physician Portal)  (both tracks)
        │                 │                 │
  ┌─────┼─────┐     ┌─────┼─────┐    ┌──────┼──────┐
  │     │     │     │     │     │    │      │      │
Disc- Resr- Out-  Disc- Resr- Out-  Reply  Exper-  Attrib
overy  ch/   reach over  ch/   reach  &     iment   & KPI
      Score              Score       Follow-       + Comp-
                                      up            liance
```

**Chief of Staff (Acquisition Controller)** — the one agent with no single
task, only the decision loop (instructions section 22, mapped to a real
implementation, not a personality prompt):

1. Pull current KPIs (signups, opportunities, replies, clicks) per track,
   from Instantly + TestCo1's `deals`/`jobs` tables.
2. Compare against configurable daily/weekly targets.
3. Rank the gap: which track, which stage of the funnel (discovery → research
   → outreach → reply → signup), is the binding constraint right now.
4. Generate 2-3 candidate explanations (targeting, message, offer framing,
   volume, deliverability — the bottleneck list from instructions section 2).
5. Select the highest-expected-value action and dispatch it to the relevant
   agent(s) below — e.g. right now: "affiliate tracks are reply-starved at
   real volume → dispatch Affiliate Research & Scoring Agent to audit the
   last 80 contacted leads against the Tier 1/2 ICP criteria before
   Affiliate Discovery sources more."
6. Log the decision, the reasoning, and the result to `project_logs`
   (already built — this is exactly what that table is for).

This agent is deliberately thin on "doing" and heavy on "deciding" — it's
the one place the daily KPI-pacing rule (section 20) and the
exploit-vs-explore allocation rule (section 11/21) actually live in code,
not spread across every other agent.

**Track A / Track B agents** (mirrored pair, separate ICPs and sources per
your section 17 rule — never mixed):

- **Discovery Agent** — self-generating prospect sourcing (Seamless queries
  + web research per instructions section 7). Track A sources
  practitioner-audience creators/agencies (the existing Tier 1/2 logic).
  Track B sources physicians/practices by specialty × geography (the
  existing "medical weight loss / HRT / med spa / wellness clinic, by
  state" query axes already measured in the register).
- **Research & Scoring Agent** — enriches + scores signup probability per
  instructions sections 6, 15, 16 (economically-scaled research depth,
  evidence-based scoring, not demographics alone).
- **Outreach Agent** — owns the Instantly campaign(s) for that track:
  sequence selection/variant assignment, sends, and the House Rules for copy
  (no em dashes, no AI-jargon, no emoji, signed "Chris," grounded-only
  personalization — already well specified in your sequence docs).

**Shared agents** (one instance, used by both tracks — this is the "share
infrastructure, separate logic" split from section 17):

- **Reply & Follow-up Agent** — classifies every reply (positive / negative
  / unsubscribe / objection / interested-but-delayed / wrong person / OOO /
  unclear, per section 13) and adapts follow-up per classification. Track-
  agnostic logic, track-specific sequences.
- **Experimentation Agent** — owns the experiment registry (section 10):
  hypothesis → control/treatment → primary/secondary KPIs → decision →
  next action. Currently-open items (medical director vs. owner, men's
  health/TRT vs. med spas) become the first real rows once this exists.
- **Attribution & Analytics Agent** — KPI tracking and signup attribution
  (section 12): which source, campaign, message, sequence, sender, and
  experiment produced each signup. Feeds the Chief of Staff's decision loop
  directly.
- **Compliance & Suppression Agent** — the one agent with veto power, not
  just advisory output: enforces suppression/unsubscribe lists, blocks
  contact with anyone flagged, and is the deterministic-code (not AI, per
  section 27) gate every send passes through.

## 7. Tool layer (instructions section 5, TestCo1's own Phase 4 concept)

| Tool | Used by | Notes |
|---|---|---|
| Instantly API v2 / MCP | Outreach, Reply & Follow-up | Already connected in this session — campaigns, leads, analytics, accounts all queried live above. |
| Seamless.AI API / MCP | Discovery, Research & Scoring | Already connected — 1,000 credits/day + existing enriched database. |
| Web research (search + browser) | Discovery, Research & Scoring | meritsciences.com verified directly above as a working example of this pattern. |
| TestCo1 Postgres (`deals`, `project_logs`, future `experiments`/`prospects` tables) | Chief of Staff, Attribution, Experimentation | This is where "operational truth" lives per the existing Git=code/DB=operational-truth principle. |

Per instructions section 27: deterministic code for KPI math, suppression,
scheduling, dedup, attribution, rate limits; AI reasoning for research,
scoring, hypothesis generation, personalization, and the Chief of Staff's
bottleneck diagnosis. This maps directly onto the existing TestCo1 pattern
of "code defines what an agent can do, the DB row defines whether/how it's
currently allowed to run."

## 8. How this lands in TestCo1's existing schema (not built yet)

- New `projects` row: **Merit Sciences**, with `details` populated from this
  doc's sections 1-5 (exactly what the Projects tab's Details field is for).
- Two `workflows`: **Affiliate Acquisition** and **Physician Portal
  Acquisition**, `project_id` = Merit Sciences.
- 11 `agents` rows: the tree above, `project_id` = Merit Sciences,
  `capabilities` seeded from the tool table, shared agents referenced by
  both workflows' `steps`.
- The existing `Copy` action on the Agents tab is literally how a "Track A
  Discovery Agent" becomes a "Track B Discovery Agent" starting point once
  we build — clone, retarget, done.

## 9. Status: org tree built (2026-09-23)

The structure in section 6-8 is now live in TestCo1 — a real `projects` row
(Merit Sciences, `details` populated with sections 1-5 above), the two
`workflows`, and all 11 `agents` rows, verified rendering correctly on
Home/Projects/Agents in production. `jobs`/`activity`/`logs`/`files` are
intentionally empty — nothing is executing yet, so nothing was fabricated.

**Not built yet, and each is a separate, higher-stakes decision**: any real
code behind these agents (Instantly/Seamless writes, actual research/
scoring/send logic), the autonomous daily loop, the scheduler, and the
experiment/hypothesis engine. That's the full 30-section system — it acts on
real prospects and real campaigns, and deserves its own plan, likely broken
into stages (e.g. read-only Attribution & Analytics first, since it's pure
observability; Compliance & Suppression next, since it's a deterministic
safety gate; Discovery/Research/Outreach last, since those are the ones that
actually contact people).

Still open from section 5: whether Instantly's tracked opportunities are
auto-detected or manual, and whether the scheduled task's permission-mode
blocker from the 2026-09-11 register is actually fixed. Worth resolving
before any agent gets real write access to Instantly.

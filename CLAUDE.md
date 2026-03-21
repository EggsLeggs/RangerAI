# RangerAI

autonomous wildlife monitoring that identifies species, detects threats, and alerts rangers in real time.

---

## what we are building

RangerAI is a multi-agent AI system for wildlife conservation monitoring. it ingests camera trap imagery and citizen science data from public APIs, classifies species using a vision model, scores sightings for threat severity, and dispatches real-time alerts to rangers and conservation teams. all agent outputs pass through Civic guardrails to prevent prompt injection, block unsafe tool calls, and audit every external API interaction.

the project is being built for the **AI London hackathon**, entering four tracks simultaneously:

- **AI Agents** (main track) - judged on autonomy, usefulness, technical depth, creativity
- **Vibe Coding** (main track) - judged on what was shipped, speed and ambition, how effectively AI tools were used, creativity
- **Civic Guardrails** (partner challenge) - judged on meaningful integration of Civic safety layer into an AI agent
- **Creative AI** (main track, partial) - the illustrated report feature contributes here; generation is core to the output not bolted on

---

## architecture

four agents run in sequence, connected by an event bus. all guardrail calls go via the civic-mcp server:

```text
iNaturalist API ──┐
                  ├── ingest agent ──► vision agent ──► threat agent ──► alert agent
GBIF API ─────────┘                        │                  │               │
                                           └──────────────────┴───────────────┘
                                                              │
                                                      civic-mcp server
                                                   (inspect_input / inspect_output
                                                    / audit_log via MCP protocol)
```

### ingest agent
- polls iNaturalist `/v1/observations` and GBIF `/v1/occurrence/search` every 5 minutes via node-cron
- deduplicates by observation id + source
- maintains a FIFO in-memory queue (cap 500 items)
- emits `agent:new-sightings` event downstream

### vision + classification agent
- sends image URLs to GPT-4o via Vercel AI SDK with a structured prompt requesting species name, confidence (0-1), and invasive species flag
- uses Zod schema for structured output - classification result is always parseable, never freeform text
- cross-references returned species against iNaturalist `/v1/taxa` for taxon_id validation
- routes low-confidence (<0.6) or unknown species to `needs_review`
- **civic**: calls `inspect_output` on civic-mcp server before passing result downstream

### threat detection agent
- looks up species conservation status via IUCN Red List API v4 (`/api/v4/taxa/scientific_name`, then `/api/v4/assessment/{id}` for category and range)
- validates sighting location against expected species range (IUCN polygons or bounding boxes)
- scores each sighting 0-100 based on out-of-range, nocturnal timing, human clustering near endangered species, and invasive species first appearance
- classifies severity as `CRITICAL` (score ≥80 or CR/EN species out of range), `WARNING` (50-79 or invasive), or `INFO`
- **civic**: calls `inspect_input` on civic-mcp server before each external API call, rejecting if injection patterns detected

### alert agent
- formats human-readable alert messages (separate templates for SMS and webhook)
- POSTs structured `Alert` JSON to dashboard webhook, retrying up to 3x on failure
- sends email via Resend for `CRITICAL` alerts only (stubs to console.log without creds)
- generates on-demand **illustrated conservation field reports** - AI-generated species illustrations, narrative summary, threat breakdown, map embed, sighting frequency charts. saved to `/reports` as styled HTML. generation is the core of this feature, not a wrapper
- **civic**: calls `inspect_input` on civic-mcp server before dispatch - blocks injected instructions in species names or observer notes

---

## data sources

| source | api | used for |
|---|---|---|
| iNaturalist | `https://api.inaturalist.org/v1` | research-grade observations with photos |
| GBIF | `https://api.gbif.org/v1` | occurrence records by bounding box |
| IUCN Red List | `https://api.iucnredlist.org/api/v4` | conservation status + range data |
| Resend | Email API | critical alert dispatch |

---

## shared types

defined in `@rangerai/shared`, imported by all agents:

```typescript
Sighting         // raw observation from ingest (id, source, imageUrl, lat, lng, timestamp)
ClassifiedSighting // sighting + species, confidence, invasiveFlag, taxonId
ThreatLevel      // enum: CRITICAL | WARNING | INFO | NEEDS_REVIEW
ScoredSighting   // classified + anomalyScore, threatLevel, iucnStatus, inRange
Alert            // scored + formattedMessage, dispatchedAt, dispatchMethod
GuardrailResult  // input/output, blocked: boolean, reason?: string
AgentEvent       // type, payload, timestamp - used on the event bus
```

---

## repo structure

```text
RangerAI/
├── packages/
│   ├── shared/          # types, constants, event bus
│   ├── ingest-agent/    # iNaturalist + GBIF polling
│   ├── vision-agent/    # GPT-4o classification via Vercel AI SDK
│   ├── threat-agent/    # IUCN scoring + severity
│   ├── alert-agent/     # formatting + dispatch + illustrated reports
│   ├── civic-mcp/       # MCP server exposing Civic guardrail tools
│   └── dashboard/       # Next.js 16 App Router UI
├── reports/             # generated illustrated conservation field reports (HTML) - gitignored
├── scripts/
│   ├── seed.ts          # demo data generator - run with: bun scripts/seed.ts
│   └── smoke-test.ts    # end-to-end pipeline check - run with: bun scripts/smoke-test.ts
├── .env.example
├── .gitignore           # includes: node_modules, .env, reports/
├── package.json         # bun workspace root
└── CLAUDE.md
```

---

## environment variables

```bash
# data sources
INATURALIST_API_KEY=
GBIF_TOKEN=
IUCN_TOKEN=

# vision model + illustrated reports (GPT-4o and DALL-E 3 both use this key)
OPENAI_API_KEY=

# guardrails
CIVIC_API_KEY=
MCP_PORT=3001

# alert dispatch
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
TWILIO_TO_NUMBER=

# dashboard
WEBHOOK_URL=http://localhost:3000/api/alerts
```

---

## tech stack

| concern | choice | notes |
|---|---|---|
| language | TypeScript + Node 20 | first-class ecosystem, Claude Code strength |
| monorepo | bun workspaces | fast, built-in TS runner, no separate tsx needed |
| agents | EventEmitter + plain async functions | no framework needed, easy to debug live |
| LLM calls | Vercel AI SDK + GPT-4o | structured output via Zod, streaming, clean API |
| guardrails | Civic SDK via MCP server | see civic-mcp section below |
| dashboard | Next.js 16 App Router | SSE alerts, file-based routing |
| realtime | SSE via Route Handler | no WebSocket server needed for one-directional alerts |
| map | Leaflet | lightweight, no API token required |
| styling | Tailwind + custom theme | fast iteration, custom forest palette via theme config |
| reports | DALL-E 3 + HTML template | species illustrations + narrative text, no PDF lib needed |
| email alerts | Resend SDK with stub fallback | falls back to console.log without creds |
| data | in-memory + optional SQLite | no DB setup cost, `better-sqlite3` only if persistence needed |
| dev runner | bun + concurrently | bun runs TypeScript natively, no compile step |

### why no agent framework

LangChain and LangGraph are not needed here. four sequential agents with a clear pipeline is a straightforward event emitter pattern. plain async functions are faster to build, easier to debug during a live demo, and show judges you understand what you actually need rather than hiding complexity behind a framework.

### civic MCP server

instead of calling the Civic SDK directly from each agent, we expose Civic as a local MCP server (`packages/civic-mcp`). agents call it via the MCP protocol, and Claude Code can also invoke it during development.

the server exposes three tools:

```text
inspect_input(payload: string) - check incoming data before an agent processes it
inspect_output(payload: string) - check outgoing data before it passes downstream
audit_log() - return session audit: calls made, blocks triggered
```

benefits:
- guardrail layer is independently addressable and auditable
- can be swapped or extended without touching agent code
- directly demonstrates the optional MCP criterion in the Civic challenge brief
- Claude Code can call Civic tools natively during development sessions
- OAuth 2 scope can gate which agents are permitted to call which tools

this is the architectural story for the Civic pitch: guardrails are not bolted on, they are a first-class service in the pipeline.

---

## dashboard UI

Next.js app with a dark forest aesthetic. key components:

- **topbar** - RangerAI logo, live status indicator, zone count
- **map panel** - Leaflet map with colour-coded sighting pins (red=critical, amber=warning, green=info). click pin for species detail. no API token required
- **alert feed** - live-updating list sorted by severity then time. colour-coded cards with species, location, timestamp, severity badge
- **species detail drawer** - slides in on alert click. shows species photo, IUCN status badge, confidence score, observation history, raw classification output
- **guardrail strip** - persistent footer showing Civic active status, total tool calls audited, injections blocked this session

design direction: dark forest greens (`#1a3a2a` base), warm amber alerts, Space Grotesk for UI text, Caveat cursive for field-notes labels. nothing should look like a generic AI dashboard.

---

## milestones

| milestone | scope |
|---|---|
| 0 | repo setup - monorepo, types, env config |
| 1 | ingest agent - iNaturalist, GBIF, queue, cron |
| 2 | vision agent - GPT-4o, taxonomy cross-ref, civic output inspection |
| 3 | threat agent - IUCN, range validation, anomaly scoring, civic tool guard |
| 4 | alert agent - formatter, webhook, SMS, civic injection block, reports |
| 5 | dashboard - scaffold, alert feed, map, guardrail strip, detail drawer |
| 6 | demo + submission - seed data, smoke test, README, pitch deck |

run `bash create-issues.sh` from repo root to recreate them. note: the script uses `gh` cli - bun does not affect this.

---

## hackathon judging fit

### AI Agents track
judging criteria: autonomy, usefulness, technical depth, creativity.

- autonomy: runs end-to-end without human prompting - ingest to alert fires automatically, recovers from API errors, makes decisions across tools and services without being told every step
- usefulness: real conservation orgs lack affordable real-time monitoring tooling - someone would actually use this
- technical depth: multi-agent pipeline, vision model, geospatial cross-reference, error recovery, multi-step reasoning across four agents
- creativity: conservation angle is rare at AI hackathons - emotional differentiation from the field of agent productivity tools

### Vibe Coding track
judging criteria: what you shipped (does it work, is it polished), speed and ambition, how effectively AI tools were used in development, creativity of the idea.

- the entire project is built using AI-assisted development - Claude Code for architecture and implementation, Cursor for iteration
- track is explicitly about the process as much as the output - document AI usage throughout, including prompts used, decisions made with AI, and how fast we went from zero to shipped
- this track does not require AI to be integrated within the application - being judged on the output of the build and how we got there
- keep a brief dev log of notable AI-assisted moments to reference in the pitch deck

### Civic Guardrails partner challenge
judging criteria: meaningful Civic integration, creative or real-world use case, reliable and safe agent operation.

- without guardrails, the vision agent could leak sensitive observer data, make unsafe tool calls, or be manipulated via injected species names
- Civic inspects all vision agent outputs before they pass downstream
- Civic guards every external tool call in the threat agent (IUCN, geospatial APIs)
- Civic blocks prompt injection in species names and observer notes before alert dispatch
- guardrail strip in dashboard shows live audit counts - visual proof for judges
- prize: Apple ecosystem prizes and credits for top three teams

### Creative AI track (partial)
judging criteria: output quality, user experience, originality, technical execution of generative models.

- the illustrated conservation field report is the specific feature that qualifies here
- AI generation is the core of the report - not a feature bolted on but the reason the report exists
- report includes: AI-generated species illustration, narrative summary written by the model, threat analysis, sighting map, frequency breakdown
- output format is styled HTML, designed to look like a real field document a ranger would print or share
- if pushed for time, this feature is lower priority than the core agent pipeline - but if shipped it is a strong demo moment

### 3-minute pitch structure
problem → live iNaturalist data → alert firing on map → Civic strip showing blocked injection → illustrated report generated on demand → what this becomes post-hackathon

---

## coding conventions

- lowercase commit messages
- no `Co-Authored-By: Claude` trailer in commit messages
- typescript throughout, strict mode
- discriminated unions and type guards preferred over class hierarchies
- prefer hyphens over em-dashes in comments/docs
- keep responses and descriptions concise
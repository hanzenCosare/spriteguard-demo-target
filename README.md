# PulseMetrics

**PulseMetrics** is a self-contained, interactive mock SaaS dashboard for AI API usage analytics, billing, API key management, and team administration. It also serves as a clean, realistic repository target for demonstrating **SpriteGuard** pull-request security analysis.

> **Demonstration Disclaimer:** PulseMetrics is a demonstration application. All users, records, billing data, API keys, and payment interactions are fictional. The application does not process real payments, authenticate production credentials, or transmit telemetry to external services. In-memory demo records reset whenever the server restarts.

---

## Features

- **Overview Dashboard** — Date-range selector (`24h`, `7d`, `30d`, `90d`), four KPI cards with inline SVG sparklines, interactive SVG usage time-series chart with hover tooltips, model usage breakdown, clickable recent activity audit trail, and CSV export.
- **Usage & Analytics** — Six aggregate metrics, metric-switching timeline chart (Requests / Tokens / Estimated cost), filterable/searchable/sortable model breakdown table, and downloadable CSV report generation.
- **API Keys** — Workspace key summary, modal-driven fictional test key generation (`pm_test_` prefix) with one-time reveal and copy controls, key detail inspection, search/status filtering, and custom confirmation revocation.
- **Billing & Plans** — Active subscription summary, Monthly / Annual pricing toggle backed by a shared plan configuration, Free / Pro / Enterprise plan comparison, local mock checkout initialization and confirmation flow, and downloadable mock invoice statements.
- **Team Management** — Seat usage meter tied to the active subscription plan, member role management, member detail views, validated mock invitations with duplicate/seat-limit enforcement, and confirmation modals for destructive actions.
- **Workspace Settings** — General workspace configuration, profile management, five working notification toggles, security preferences, and mock active session list that persist in the local mock backend.

---

## Technology Stack

- **Backend:** Node.js, Express.js (CommonJS), Node.js built-in modules (`crypto`, `http`, `path`)
- **Frontend:** HTML5, modular CSS3 design tokens and stylesheets, Vanilla JavaScript (native browser ES modules), Fetch API, inline SVG visualizations
- **Testing:** Node.js built-in `assert` and `http` smoke + API behavior test suites
- **Storage:** Deterministic in-memory mock data store on the backend (`src/services/mockStore.js`) and `localStorage` for lightweight browser UI preferences (no database required)

---

## Project Structure

```text
.
├── package.json
├── package-lock.json
├── README.md
├── .gitignore
├── public/
│   ├── index.html
│   └── assets/
│       ├── css/          # Modular tokens, layout, components, tables, charts, modals, toast, responsive
│       └── js/
│           ├── app.js
│           ├── core/     # router, state, events, formatters
│           ├── api/      # centralized Fetch client
│           ├── components/ # sidebar, header, modal, toast, dropdown, data-table, chart, stat-card, loading
│           ├── views/    # overview, usage, api-keys, billing, team, settings
│           └── data/     # navigation config & SVG icon set
├── src/
│   ├── server.js
│   ├── app.js
│   ├── routes/           # health, dashboard, usage, keys, billing, team, settings
│   ├── services/         # mockStore, payment
│   └── middleware/       # notFound, errorHandler
└── test/
    ├── smoke.test.js
    └── api.test.js
```

---

## Installation & Development

```bash
npm install
npm start
```

By default, the server starts at:

```text
http://localhost:3000
```

You can override the port with the `PORT` environment variable:

```bash
PORT=4000 npm start
```

> **Note:** Refreshing the page preserves backend mock changes while the server stays running, whereas restarting `node src/server.js` resets in-memory demo records back to the deterministic seed state.

---

## Running Tests

```bash
npm test
```

`npm test` executes `node test/smoke.test.js`, which runs the backend smoke test suite and the API behavior test suite (`test/api.test.js`) against an ephemeral local HTTP port without requiring external credentials or network access.

---

## Mock API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Service health check (`{ "status": "ok", "service": "pulsemetrics" }`) |
| `GET` | `/api/dashboard/summary?range=30d` | Dashboard KPIs, sparklines, and workspace summary |
| `GET` | `/api/dashboard/activity` | Recent workspace activity events |
| `GET` | `/api/usage/summary?range=30d` | Aggregate request, token, cost, and error rate metrics |
| `GET` | `/api/usage/timeseries?range=30d&model=all` | Time-series dataset for charts |
| `GET` | `/api/usage/models?range=30d` | Per-model usage breakdown |
| `GET` | `/api/usage/export?range=30d&model=all` | Downloadable CSV report generated from mock data |
| `GET` | `/api/keys` | List all fictional API keys and summary counts |
| `POST` | `/api/keys` | Generate a fictional `pm_test_` API key |
| `GET` | `/api/keys/:id` | Retrieve details for a single mock key |
| `POST` | `/api/keys/:id/revoke` | Revoke an active mock key |
| `GET` | `/api/billing/summary` | Current mock subscription and quota status |
| `GET` | `/api/billing/plans` | Canonical pricing plan definitions |
| `GET` | `/api/billing/history` | Fictional invoice history |
| `GET` | `/api/billing/invoices/:id/download` | Download a mock invoice text statement |
| `POST` | `/api/billing/checkout` | Initialize a local mock checkout session |
| `POST` | `/api/billing/checkout/confirm` | Confirm a mock checkout session and update subscription |
| `GET` | `/api/team` | List workspace members, pending invitations, and seat summary |
| `POST` | `/api/team/invitations` | Create a validated mock invitation |
| `POST` | `/api/team/:id/role` | Update a workspace member's role |
| `DELETE` | `/api/team/:id` | Remove a member or cancel a pending invitation |
| `GET` | `/api/settings` | Fetch workspace and profile settings |
| `PATCH` | `/api/settings` | Validate and save updated mock settings |

---

## Mock Checkout Flow

Clicking **Upgrade to Pro** in **Billing & Plans** calls `POST /api/billing/checkout` with the chosen billing period (`monthly` or `annual`). The backend creates an in-memory checkout session (`cs_demo_...`) via `src/services/payment.js` and opens an internal confirmation modal. Confirming calls `POST /api/billing/checkout/confirm`, which updates the workspace subscription, refreshes seat limits, appends a new `Paid` mock invoice, and records an activity log entry. Card inputs are never requested and are explicitly rejected by the API.

---

## Git Branches & SpriteGuard Security Demo

This repository uses a two-branch structure for controlled security demonstrations:

1. **`main` (Clean Base Branch)** — Contains the complete, clean PulseMetrics mock SaaS application without any intentional vulnerability fixtures or hardcoded canary strings.
2. **`feat/pro-billing-telemetry` (Feature / Demo Branch)** — Branches from `main` and adds local simulated billing telemetry, synthetic runtime security events, and two **intentionally insecure, strictly non-executable** static analysis fixtures under `src/demo-fixtures/` so SpriteGuard can demonstrate pull-request detection of hardcoded fallback credentials and suspicious telemetry patterns.

### Security Fixture Isolation

On `feat/pro-billing-telemetry`, the static vulnerability fixtures are isolated in `src/demo-fixtures/` and are **never imported, required, dynamically loaded, or executed** by the application or test suite. Runtime security events are generated purely in memory by a local demo simulator without issuing outbound network calls or leaking real environment variables.

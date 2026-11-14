# MouManTAI Recovery+ (SUC)

**AI Supply-to-Plate Recovery Intelligence** — a restaurant operations tool that turns a supplier disruption
message (WhatsApp, Outlook email or Telegram) into an assessed impact, two recovery strategies
(Plan A: external supplier recovery, Plan B: internal stock/menu/prep recovery), a versioned approval and a
verified outcome.

> **Current status — Phase 1 (project foundation only).**
> The app is a navigation shell with empty pages. There are **no** real messaging integrations, no message
> understanding, no restaurant data, no recovery logic, no approvals and no backend yet.

## Technology stack

| Area | Choice |
|---|---|
| Frontend | React 19, Vite 8, TypeScript 5.9, React Router 7 |
| Icons | lucide-react |
| Styling | Plain CSS with design tokens (`frontend/src/styles/tokens.css`) |
| Tests | Vitest + Testing Library (jsdom) |
| Backend | Reserved — minimal Live Message Bridge, not yet implemented (`backend/README.md`) |

No database, AI model, solver, payment or messaging SDK is installed.

## Getting started

Requires Node.js 20+ (tested with Node 24).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

| Command (in `frontend/`) | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run the test suite once |
| `npm run build` | Typecheck and production build to `dist/` |
| `npm run preview` | Serve the production build |

No backend or external service is needed to run the frontend.

## Folder architecture

```
MouManTAI_SUC/
├── frontend/
│   ├── public/                    static assets served as-is
│   ├── src/
│   │   ├── app/                   App root, central route table (router.tsx), providers/
│   │   ├── layouts/               MainLayout (header + navigation + <Outlet/>)
│   │   ├── components/
│   │   │   ├── layout/            AppHeader, Navigation, PageContainer
│   │   │   ├── ui/                (future) reusable primitives: buttons, tables, badges
│   │   │   └── shared/            (future) cross-feature composites
│   │   ├── pages/                 one route-level component per page (titles only for now)
│   │   ├── features/              (future) feature business modules: messaging, incidents, recovery, …
│   │   ├── services/
│   │   │   ├── api/               (future) Live Message Bridge client
│   │   │   ├── mock/              (future) simulated business services
│   │   │   └── adapters/          (future) live vs mock integration boundary
│   │   ├── data/fixtures/         (future) synthetic restaurant datasets, clearly labelled
│   │   ├── store/                 (future) shared application state
│   │   ├── types/                 (future) TypeScript domain contracts
│   │   ├── hooks/ utils/ assets/
│   │   ├── constants/             navigation.ts — single source of nav items and page titles
│   │   └── styles/                tokens.css (design tokens), global.css (shell styles)
│   └── tests/                     routing and navigation tests
├── backend/                       reserved for the Live Message Bridge (README only)
├── docs/
│   ├── architecture/              approved architecture and UI/UX blueprint
│   ├── requirements/              Recovery+ requirements specification v1.0
│   └── development/               (future) developer guides
└── scripts/                       (future) dev and demo scripts
```

Empty future folders hold a `.gitkeep` only; no placeholder code.

## Routes

| Path | Page |
|---|---|
| `/` | redirects to `/overview` |
| `/overview` | Overview |
| `/inbox` | Unified Supplier Inbox |
| `/message-intelligence` | Message Intelligence |
| `/incidents` | Incidents |
| `/impact` | Impact Explorer |
| `/recovery/plan-a` | Plan A — Supplier Recovery |
| `/recovery/plan-b` | Plan B — Internal Recovery |
| `/prep-planning` | Prep Planning |
| `/recovery/compare` | Recovery Comparison |
| `/approvals` | Approvals |
| `/execution` | Execution |
| `/outcomes` | Outcomes |
| `/decision-memory` | Decision Memory |
| `/channels` | Channel Connections |
| `/settings` | Settings |
| anything else | Page not found |

To add a page: add an entry to `frontend/src/constants/navigation.ts` and map its path in
`frontend/src/app/router.tsx`. A test fails if the two drift apart.

## Development phases

| Phase | Scope |
|---|---|
| **1 — Foundation (current)** | Repository structure, app shell, routing, empty pages |
| 2 — Inbox & message understanding | Unified inbox UI, event schema, rule-based extraction, supplier/PO verification, incidents |
| 3 — Live message connections | Minimal bridge: Telegram, Outlook, WhatsApp inbound |
| 4 — Restaurant recovery | Impact explorer, Plan A, Plan B (allocation, menu, prep) on synthetic data |
| 5 — Decisions & outcomes | Comparison, approval, simulated execution, outcome verification, decision memory |
| 6 — QA & demo | End-to-end tests, offline fallback, rehearsal |

Provider account setup (Telegram, Outlook, WhatsApp) is recommended in parallel with Phase 1–2 because
it carries the largest unknowns. See `docs/architecture/` for details.

## Honesty notes

- No real integrations or recovery functionality exist yet.
- When added, simulated or rule-based behaviour will be labelled as such in the UI; no FeedMe API access is assumed.
- No code from the earlier MouManTAI repository is used.

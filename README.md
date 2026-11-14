# MouManTAI (SUC)

**Team:** NJHL — Wong Jia Hui · Bong Zi Shan · Lee Mei Shuet · Loh Su Ting · Gan Rui En

[🌐 Live Demo](https://frontend-blue-pi-70ejij1ipo.vercel.app) · [🖥️ HTML Presentation](https://htmlpreview.github.io/?https://github.com/jiahui-1101/MouManTAI_SUC/blob/main/presentation/moumantai-presentation.html) · [📄 PDF Slides](presentation/moumantai-presentation.pdf)

**AI Supply-to-Plate Recovery Intelligence** — a restaurant operations tool that turns a supplier disruption
message (WhatsApp, Outlook email or Telegram) into an assessed impact, two recovery strategies
(Plan A: external supplier recovery, Plan B: internal stock/menu/prep recovery), a versioned approval and a
verified outcome.

**Current status:** The FeedMe-inspired MouManTAI prototype includes a shared Portal shell and three
populated Happy Potato demo pages: Overview, Incidents and Impact Explorer. Use **Supplier disruption demo**
on Overview to simulate a supplier report, verify it, assess impact, recount stock and reset the scenario.
Plan A, Plan B and Prep Planning also have demo views. Live messaging, FeedMe connectivity and the
end-to-end recovery-to-outcome workflow are pending.

See the [Portal design guide](docs/design/FEEDME_PORTAL_ALIGNMENT.md) and
[P2 integration notes](docs/development/P2_impact_foundation.md).

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

Requires Node.js 20.19+ on the Node 20 release line, or Node.js 22.12+ (tested with Node 24).

```bash
cd frontend
npm ci
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
│   │   │   ├── ui/                shared Portal presentation primitives and styles
│   │   │   └── shared/            (future) cross-feature composites
│   │   ├── pages/                 route components, including the three operational demo pages
│   │   ├── features/              incident and impact presentation and domain logic
│   │   ├── services/
│   │   │   ├── api/               (future) Live Message Bridge client
│   │   │   ├── mock/              synthetic restaurant state, selectors and demo actions
│   │   │   └── adapters/          (future) live vs mock integration boundary
│   │   ├── data/fixtures/         synthetic Happy Potato dataset
│   │   ├── store/                 (future) shared application state
│   │   ├── types/                 TypeScript domain contracts
│   │   ├── hooks/ utils/ assets/
│   │   ├── constants/             navigation.ts — single source of nav items and page titles
│   │   └── styles/                tokens.css (design tokens), global.css (shell styles)
│   └── tests/                     shell, shared UI and P2 regression tests
├── backend/                       reserved for the Live Message Bridge (README only)
├── docs/
│   ├── design/                    FeedMe Portal alignment
│   └── development/               P2 interface notes
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
| **1 — Foundation (available)** | Repository structure, Portal shell and routing |
| 2 — Inbox & message understanding | Unified inbox UI, event schema, rule-based extraction, supplier/PO verification, incidents |
| 3 — Live message connections | Minimal bridge: Telegram, Outlook, WhatsApp inbound |
| 4 — Restaurant recovery (partial) | Synthetic incident, impact, Plan A, Plan B and prep planning views available. |
| 5 — Decisions & outcomes | Comparison, approval, simulated execution, outcome verification, decision memory |
| 6 — QA & demo | End-to-end tests, offline fallback, rehearsal |

## Honesty notes

- MouManTAI is an independent hackathon concept inspired by FeedMe Portal.
- Operational data and channel events are synthetic. The demo runs locally in the browser.

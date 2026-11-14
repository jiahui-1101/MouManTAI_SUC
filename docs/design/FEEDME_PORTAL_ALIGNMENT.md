# FeedMe Portal alignment

MouManTAI is a FeedMe-inspired hackathon prototype for the synthetic Happy Potato demo outlet. This guide describes the project's own design system.

The public FeedMe homepage uses Inter and the orange `#FF7823` in its theme metadata and button styles. The POS features page describes FeedMe Portal as the merchant management surface. The Recovery+ spacing, layout, components and semantic colors are project choices. [FeedMe homepage](https://feedme.ai/) · [FeedMe POS features](https://feedme.ai/pos/feature)

## Tokens and typography

| Role | Token and use |
|---|---|
| Brand accent | `--brand-primary` (`#FF7823`) for decorative highlights |
| Primary actions | `--action-primary` (`#AD4808`) and `--action-primary-hover` (`#8C3806`) with white text |
| Active navigation | `--nav-active-text` on `--nav-active-bg`, with current-page semantics |
| Canvas and panels | `--page-background` (`#F7F8FA`), white `--surface-primary` and subtle borders |
| Status | Green success, amber warning, red danger, blue info, grey neutral, purple simulated and teal live provenance. Pair color with a meaningful label. |
| Stock and supply | Slate `--viz-physical` for physical stock and a patterned blue fill for planned incoming. Retain labels and quantities for both. |
| Focus | A solid two-pixel outline using `--focus-color` (`#943A04`) |

Inter (400–700) serves both body and headings. Offline, the interface uses the local system sans-serif stack and the numeric font stack uses a local monospace fallback. The demo runs with a light color scheme.

## Layout and shared components

- The sticky top bar uses the **MouManTAI** logo and a right-aligned **Outlet: Happy Potato** label with the logo from [Happy Potato’s website](https://www.happypotato.com.my/). P2 pages retain their synthetic-data indicators.
- Above 1023 px, the white 232 px sidebar provides group disclosures. Arriving at a route opens its group. At 1023 px and below, the 60 px icon rail exposes every route with named links. At 560 px and below, the header uses a compact stacked layout.
- Keep page headings in `PageContainer`. Use `Button`, `StatusBadge`, `DataPanel`, `SectionHeader`, `AlertBanner`, `EmptyState` and `Tabs` for compatible new screens. Existing P2 presentation shares the semantic colors and follows its own feature layout.
- Table and dialog classes provide presentation. Supply captions and header associations for tables and manage dialog focus, Escape and focus return. Use a named, keyboard-reachable scroll region where content needs horizontal scrolling.
- P2 stacks its workspace below 1280 px and simplifies KPIs and detail grids at 720 px and below. Verify populated states, including graph selection, filters and drawers, at the small end of the range.

## Accessibility and workstream boundaries

- Verify normal text contrast at 4.5:1 and large text or applicable non-text controls at 3:1. The primary action measures 5.66:1, its hover state 7.83:1, active navigation 5.53:1 and the focus outline 7.33:1 on white.
- Preserve visible focus and the skip-to-content link. Desktop disclosures support Enter and Space. Shared horizontal tabs use arrow keys, Home and End, with linked tabpanels and one active tab in the Tab order.
- Keep the shared route names stable. P1 owns messaging and channels, P2 owns operations and impact, P3/P4 own the recovery plans, and P5 owns decisions and outcomes. Keep state, calculations and provenance outside presentation primitives.
- Exercise every newly populated route with a keyboard and at narrow, tablet and desktop widths. Preserve synthetic and simulated labels and the distinction between supplier claims and physical receipt.

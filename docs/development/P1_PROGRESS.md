# P1 Progress — Mock Messaging and Channels

## Status

**Milestone:** Deterministic mock-message rule extraction complete

**Branch:** `feature/p1-mock-messaging` (created from `main`)

**Implementation:** Parser increment complete; UI/store work not started

## Authoritative inputs

Read in this order and copied unchanged into `docs/requirements/`:

1. `00_SHARED_HappyPotato_Mock_Data_and_Contracts.md` — single source of truth for IDs, quantities, labels, and event flow.
2. `P1_HappyPotato_Messaging_and_Channels_Requirements.md` — P1 UI and interaction requirements, subject to the user's mock-only scope override.

The user's scope override takes precedence where the documents discuss real or replayed provider connectivity.

## Fixed implementation scope

- Build a 100% offline React/Vite experience using only the shared Happy Potato mock data.
- Treat WhatsApp, Outlook, and Telegram as display/filter metadata; they are not connections.
- Use `SIMULATED_CHANNEL` for mock inbound messages and preserve the canonical synthetic provider IDs.
- Implement the mock-relevant portions of `/inbox`, `/message-intelligence`, `/channels`, and `/settings` only.
- Preserve immutable raw message text, rule extraction, evidence spans, sender/PO review, deduplication, incident correlation, and explicit human confirmation.
- Fail closed for unverified or unresolved messages; never infer an ETA from “We will update you tomorrow.”
- Keep one `HP-INC-001` disruption when distinct channel messages refer to the same verified PO event; never multiply the 20 kg shortage.
- Publish/dispatch the shared `INCIDENT_VERIFIED` handoff for downstream consumers without implementing P2–P5 calculations or UI.

## Explicit exclusions

- No WhatsApp, Outlook, Telegram, or Gmail connections.
- No APIs, OAuth, webhooks, backend bridge, polling, SSE, SDKs, credentials, provider diagnostics, or network access.
- No `LIVE_CHANNEL` or `REPLAY_CHANNEL` behavior.
- No live/mock adapter boundary or future-integration preparation.
- No provider setup workflow or claims that any channel is connected.
- No second fixture, store, incident, PO, recipe, or quantity source.
- No modifications to teammate-owned P2–P5 pages or shared shell/navigation/router/tokens without integration approval.

## Canonical P1 contract to preserve

- Locked message IDs: `HP-MSG-WA-001`, `HP-MSG-OL-001`, `HP-MSG-TG-001`.
- Purchase order: `HP-PO-1042`; ingredient: `HP-ING-CHICKEN`; incident: `HP-INC-001`; supplier: `HP-SUP-001`.
- Expected quantity: `20.000 kg`; claimed delivery today: `0.000 kg`; PO shortfall: `20.000 kg`.
- Incident type: `UNAVAILABLE`; ETA: `UNKNOWN`; extraction method: `RULE_EXTRACTION`.
- Initial snapshot: `HP-SNAP-001`, revision `1`; PO begins `OPEN`; incident begins pending verification.
- Business data remains `SYNTHETIC_BUSINESS`; calculations/actions/evidence retain their shared simulated provenance labels.
- Event flow owned by P1: `MESSAGE_RECEIVED` → `MESSAGE_EXTRACTION_REVIEWED` → `INCIDENT_VERIFIED`.

## Existing architecture findings

- Frontend stack: React 19, Vite 8, TypeScript 5.9, React Router 7, plain CSS tokens, Vitest/Testing Library.
- P1 routes already exist as empty `PageContainer` pages: `/inbox`, `/message-intelligence`, `/channels`, `/settings`.
- The central router, navigation, layout components, and global style tokens are shared foundation code and require no setup changes.
- No messaging feature modules, fixtures, shared store, domain contracts, backend, or external SDKs currently exist.
- The implementation should stay in P1-owned page and feature directories while consuming the integrator-owned shared fixture/store/contracts when available.

## Integration requirements

- Integrator/shared-data owner must provide one importable canonical Happy Potato fixture and shared typed state/actions; P1 must not duplicate it.
- Required shared types/actions: `InboundMessage`, `MessageExtraction`, `Incident`, `MESSAGE_RECEIVED`, `MESSAGE_EXTRACTION_REVIEWED`, `INCIDENT_VERIFIED`, and `DEMO_RESET` (offline state only).
- P1's verified incident payload must carry `HP-INC-001`, `HP-PO-1042`, `HP-ING-CHICKEN`, `claimedShortfallKgMilli=20000`, and the correlated `messageIds`.
- Deduplication key remains `(channel, channelAccountId, providerMessageId)` for simulated events.
- P2 owns impact calculations. P1 may identify the matched PO/menu context but must not independently calculate stock or downstream recovery totals.
- Shared-state availability is an implementation dependency; coordinate schema changes before adding fields.

## Planned P1 milestones

- [x] Create and switch to `feature/p1-mock-messaging` from `main`.
- [x] Read shared contract before P1 requirements.
- [x] Copy both source requirement documents into `docs/requirements/`.
- [x] Inspect current React/Vite architecture and P1 route ownership.
- [x] Record mock-only scope, invariants, exclusions, and integration dependencies.
- [x] Implement the canonical supplier/PO parser registry required for P1 extraction.
- [x] Extract the locked message with exact raw-text evidence spans and immutable raw text.
- [x] Fail closed for unsupported/ambiguous text and block unknown-sender auto-verification.
- [x] Add focused tests for canonical values, ETA handling, evidence spans, stock separation, and review gates.
- [ ] Implement canonical P1 mock contracts/fixtures only after shared ownership is confirmed.
- [ ] Implement and test offline inbox behavior.
- [ ] Implement and test rule extraction and review behavior.
- [ ] Implement and test display-only channel/settings behavior.
- [x] Run full tests, typecheck, and production build for the parser milestone.

## Latest verification

- `npm test`: 28 tests passed across 2 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed with Vite 8.3.8.
- No dependencies or external services were added.
- Parser scope is deterministic and offline; no AI model or API call exists.

# P1 Progress — Mock Messaging and Channels

## Status

**Milestone:** Continuity Check PASS — P1 mock messaging verified against shared DemoState; ready for Prompt 3

**Branch:** `feature/p1-mock-messaging` (created from `main`)

**Implementation:** Parser, polished `/inbox`, mock-only `/channels`, mock-only `/settings`, and real offline mock-state operations complete; continuity verified

## Continuity Check (Prompt 2 Verification)

- **Centralized store integrity:** Verified `src/store/demoStore.ts` remains the single central demo store. `src/features/messaging/inboxStore.ts` remains a strict re-export facade with zero independent state or subscriptions.
- **Fixture integrity:** Verified `src/data/fixtures/happyPotato.ts` remains the single canonical source of business fixture data. No duplicate business fixtures, schemas, or secondary stores exist.
- **Mock-state operations:** Confirmed `ingestMockMessage`, idempotent deduplication on `(channel, channelAccountId, providerMessageId)`, dynamic duplicate count, unlinked initial fixtures, and dynamic stage derivation are verified.
- **Test & Build Verification:** 51 tests across 7 test files pass; TypeScript typecheck and Vite production build pass without errors.

## Offline mock-state operations (supersedes fake message states)

- **Actual `ingestMockMessage` action:** Defined and implemented in `src/store/demoStore.ts` and re-exported via `src/features/messaging/inboxStore.ts`. Ingests canonical Shared MD envelopes (`CANONICAL_MOCK_ENVELOPES`) into the central demo state.
- **Idempotent deduplication:** Deduplication key `(channel, channelAccountId, providerMessageId)` prevents repeated provider events from creating duplicate message records.
- **Dynamic duplicate counter:** `suppressedDuplicateCount` begins at 0 on reset/scenario load and derives purely from actual duplicate ingestion events—never a hardcoded seed.
- **Three distinct channel records:** `HP-MSG-WA-001` (WhatsApp), `HP-MSG-OL-001` (Outlook), and `HP-MSG-TG-001` (Telegram) remain three separate records across simulated sources.
- **No prelinked / preverified initial state:** All prelinked or preverified status removed from initial fixtures. Specifically, `HP-MSG-TG-001`, `HP-MSG-WA-001`, and `HP-MSG-OL-001` all start unlinked with stage `PARSED`.
- **Derived processing stages:** Processing stages (`PARSED` → `REVIEW_PENDING` → `LINKED`, or `UNVERIFIED` / `UNMATCHED`) dynamically derive from parsing result, review history, and verified incident correlation.
- **Scenario loading and reset via shared DemoState:** `loadFixture` ("CORE_CHANNELS", "REVIEW_STATES", "EMPTY") and `reset` clean review history, reset duplicate count to 0, reset incident state to `PENDING_VERIFICATION`, and derive clean message stages.
- **Immediate reactivity:** Changes to mock state immediately update `/inbox`, `/channels`, and `/settings` via React `useSyncExternalStore`.
- **Preserved UI:** Search, filters, arrow-key navigation, responsive split-screen view, and accessibility announcements preserved intact.
- **Strictly simulated provenance:** All messages retain `SIMULATED_CHANNEL`.

## Central shared state migration

- Authorized centralized implementation lives in `src/store/demoStore.ts`; `features/messaging/inboxStore.ts` is a re-export facade, with no independent state or subscriptions.
- `src/data/fixtures/happyPotato.ts` contains the Shared MD canonical business fixture: suppliers, inventory, PO, recipes, forecasts, confirmed orders, offers, resources and snapshot metadata. Canonical message fixtures live alongside the centralized store.
- DemoState includes the pending HP-INC-001, HP-SNAP-001 revision 1, OPEN HP-PO-1042 and accepted chicken stock 10000. No seeded message is initially linked as verified.
- Typed MESSAGE_RECEIVED, MESSAGE_EXTRACTION_REVIEWED, INCIDENT_VERIFIED and DEMO_RESET events update the same subscribed state. Review versions retain original parsed evidence; verification requires safe reviewed messages and correlates them to one incident.
- Shared exports: selectActiveIncident, selectMessagesForIncident, selectOperationalSnapshot, useDemoState and demoStore. Snapshot fingerprint uses deterministic FNV-1a over canonical fixture JSON, explicitly labelled fnv1a32 (not SHA-256). Message review/verification leaves snapshot identity and quantities unchanged.
- Published state and original evidence are recursively frozen. Incoming message records are cloned, duplicate envelope keys suppressed, and ID collisions rejected.
- Acceptance verified: a subscribed selector test consumer sees P1 facade review/verification immediately, three distinct messages and one 20000 shortfall. P1 facade and shared store return the identical state object.
- Validation: 51 tests across 7 files pass; typecheck and build pass.
- Remaining: Message Intelligence review UI, human correction fields, actual P2–P5 consumers and their business workflows are not implemented by this task. Shared test-consumer acceptance is PASS; actual downstream integration remains BLOCKED until those modules consume these exports. Earlier audit entries are historical and must not be read as current shared-interface status.

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
- [x] Implement the canonical P1 inbox contract/fixture from the shared mock-data document.
- [x] Implement and test offline inbox behavior: channel filters/counts, search, selection/read state, empty state, immutable detail, provenance, processing timeline, incident correlation, unverified/unmatched messages, duplicate suppression, and Message Intelligence navigation.
- [x] Implement actual mock-state operations: real offline ingestMockMessage, idempotent deduplication, dynamic duplicate counting, derived stages, and DemoState reset.
- [x] Implement and test rule extraction and review behavior (Prompt 3: `/message-intelligence`).
- [x] Implement and test mock-only channel/settings behavior.
- [x] Run full tests, typecheck, and production build for the parser milestone.

## Latest verification

- `npm test`: 51 tests passed across 7 test files (`tests/mockMessagingOfflineState.test.tsx` added).
- `npm run typecheck`: passed with zero errors.
- `npm run build`: passed with Vite 8.3.8 in 1.75s.
- No dependencies or external services were added.
- Scope remains 100% deterministic, offline, and mock-only.

## Audit coverage

- P1-FR01 PASS — channel filters/counts tested.
- P1-FR02 PASS — sender/subject/PO/content search reads fixture fields.
- P1-FR03 PASS — channel, simulated provenance, timestamps and stages rendered.
- P1-FR04 PASS — immutable original detail and masked synthetic identifiers.
- P1-FR05 PASS — shared DemoState manages read, selection, and review state.
- P1-FR06 PASS — distinct messages exist; linking occurs via reviewed correlation.
- P1-FR07 PASS — empty, mock loading/error recovery, and real deduplication tested.
- P1-FR08 PASS — polite atomic message/unread count notification; selection does not auto-navigate.
- P1-FR09 PASS — responsive styles, native buttons and tested arrow-key focus/selection.
- P1-FR10 PASS — visual timeline backed by actual review and linking events.
- P1-T01 PASS — canonical parser values covered by tests.
- P1-T02 OUT_OF_SCOPE — real provider envelopes excluded.
- P1-T03 PASS — actual duplicate ingestion test and deduplication verified.
- P1-T04 PASS — three distinct canonical messages preserved; single-incident correlation verified.
- P1-T05 PASS — unknown and wrong-PO suppliers cannot verify in parser.
- P1-T06 PASS — update promise retains UNKNOWN ETA.
- P1-T07 PASS — unsupported text resolves to human-review state without fabricated fields.
- P1-T09 PASS — channel filtering tests pass.
- P1-T10 OUT_OF_SCOPE — bridge excluded; local mock loading/error/retry covered separately.
- P1-T11 OUT_OF_SCOPE — replay channel excluded.

## Prompt 3 milestone — Message Intelligence & human review (2026-11-14)

- `/message-intelligence?message=ID` loads the message from the shared DemoState; empty (no param), missing-message, loading and error states implemented.
- Immutable original text side-by-side with structured extraction; evidence spans highlighted with exact `start/end` offsets (verified against raw text).
- Shows supplier, PO with `MATCHED/UNVERIFIED/CONFLICT/UNRESOLVED`, incident type, expected, delivered claim, derived shortfall, ETA (`UNKNOWN` kept) and verification reasons.
- Human review form (`features/messaging/messageReview.ts`): validates nonnegative numbers, kg/g conversion, rejects `L`, PO registry + PO/supplier relationship, claim > expected, UNAVAILABLE/PARTIAL_DELIVERY contradictions and ETA format.
- Save Correction appends an immutable `HUMAN_CORRECTION` version (actor `Demo operator (demo-reviewer-01)`, timestamp, `changedFields`, note) to `DemoState.extractionHistory`. Version 1 `RULE_EXTRACTION` is derived deterministically from the rule extractor and never mutated; raw text untouched.
- Changed fields lose their source span and are listed in `humanAssertedFields`, shown as “Human assertion · no source span”.
- Decisions: Save, Reject, Mark unresolved (reason required), Reopen (save after reject), Confirm. Confirm appends a `VERIFIED` version then dispatches existing `MESSAGE_EXTRACTION_REVIEWED` and `INCIDENT_VERIFIED` (contracts unchanged).
- Confirm disabled with explicit reasons: unverified/mismatched sender (candidate supplier edits cannot override identity), unmatched PO, unresolved/no evidence, rejected/unresolved latest decision, shortfall conflicting with `HP-INC-001` 20.000 kg, unsaved edits. Store re-checks blockers and throws.
- Review history lists all versions with keyboard navigation (↑/↓/Home/End) and read-only viewing of previous versions; Esc discards unsaved edits. History persists across navigation via shared state.
- Tests: `tests/messageIntelligence.test.tsx` (9 tests). Navigation test now excludes the implemented page from the empty-page check.
- Verification: `vitest` 59/59 passed, `tsc -b --noEmit` passed, `vite build` passed (run in a Linux copy because local `node_modules` are Windows binaries).
- Push: not completed from this session — no GitHub credentials available; push `feature/p1-mock-messaging` manually.

## Prompt 4 milestone — Incident verification & cross-channel correlation (2026-11-14)

- Incident `HP-INC-001` in shared DemoState now carries `supplierId HP-SUP-001`, `type UNAVAILABLE`, `snapshotId HP-SNAP-001` rev 1, `verifiedAtIso` and `handoff {target /impact, status}`.
- `confirmExtractionReview` (first safe message) and `linkMessageToIncident` (later channels) share one atomic commit: CONFIRMED version + review record + `incident.messageIds` + derived `linkedIncidentId`/stage, single emit. `INCIDENT_VERIFIED` reducer is idempotent; repeated confirm/link return `ALREADY_LINKED` without changing state.
- Linking requires a verified incident, explicit "Link to existing incident" → "Confirm link", and passes `incidentLinkBlockers` (sender identity, PO, supplier, incident type, shortfall, evidence, unresolved/rejected review).
- `claimedShortfallKgMilli` stays 20000 for 1–3 linked messages; accepted chicken stock stays 10.000 kg from the shared snapshot; P1 performs no inventory/impact calculation.
- Handoff: `NOT_PUBLISHED` → `AWAITING_P2_CONSUMER` on verification; only `acknowledgeIncidentHandoff()` (for the P2 consumer) sets `ACKNOWLEDGED_BY_P2`. UI never claims impact was calculated before that. Link to `/impact` shown once verified.
- Inbox and Message Intelligence status/timeline read the real incident (`IncidentHandoff` panel, inbox correlation line).
- Tests: `tests/incidentCorrelation.test.tsx` (mandatory reset → WA confirm → OL/TG link → 3 messages/1 incident/20000 → reset pending; idempotency; incompatible links; handoff ack). 63/63 tests, typecheck and build pass.
- Push: blocked from this session (GitHub push not permitted); push `feature/p1-mock-messaging` from a local terminal.

## Prompt 5 milestone — P3/P5 evidence handoffs (2026-11-14)

- Added exact `HP-MSG-OL-OFFER` (HP-SUP-002, Outlook) via new `SUPPLIER_OFFER` fixture; `InboxMessage.kind` distinguishes `DISRUPTION_REPORT` / `SUPPLIER_OFFER`.
- `parseMockSupplierOffer` grounds 15 kg chilled chicken, RM16/kg, RM15 freight, stated ETA 10:15, conditional — with exact spans; fail-closed otherwise.
- `demoStore.reviewSupplierOffer` (qualify/reject/unresolved, reason required, idempotent) appends `HUMAN_REVIEW` versions; qualification blocked for non-approved senders. Offers cannot link to incidents; `business.supplierOffers` (HP-OFFER-002) and stock never change.
- Read-only, deep-frozen selectors: `selectSupplierOfferEvidence` (P3), `selectMessageEvidence`, `selectIncidentEvidence` (P5), all with explicit non-authorization/non-receipt/non-success limits.
- UI: offer review workspace in Message Intelligence, offer note in Inbox, Audit evidence panel on every message.
- Contract: `docs/development/P1_EVIDENCE_API.md`. Tests: `evidenceHandoff.test.tsx`, `offerEvidenceUi.test.tsx`; 69/69 tests, typecheck, build pass.
- Remaining dependency: P2/P3/P5 consumer pages are not built; they must read these selectors (see API doc).
- Push: still blocked from this session; push from a local terminal.

## Final P1 QA and UI interaction audit (2026-11-14)

Verification: `npm test` 85/85 (13 files), `npm run typecheck` pass, `npm run build` pass. Real-browser (Chromium/Playwright) journeys on iPhone 13, 820px tablet and 1440px desktop: no horizontal overflow on any P1 page, zero runtime errors, keyboard-only confirm/link works. Tests run in a Linux copy because local `node_modules` are Windows binaries.

### Fixes from QA
- Typed `INCIDENT_VERIFIED` / `MESSAGE_EXTRACTION_REVIEWED` events now recorded in `state.publishedEvents` (`selectPublishedEvents`) with message IDs and `HP-SNAP-001` rev 1 (P1-FR15).
- Message Intelligence overflowed 91px on mobile — fixed.
- Offer review history rendered dead `<button>`s — now non-interactive items.
- Message Intelligence loading state had no exit — added "Finish mock loading".
- Opening a message directly in Message Intelligence now marks it read/selected in shared state (consistency with Inbox).
- Channels mock loading/error buttons gave no feedback on that page — now shows state, "Clear mock state" and "View in Inbox".

### Interactive control checklist (tests: `p1UiAudit.test.tsx`, `p1FinalQa.test.tsx`, existing suites)
| ID | Page · control | Result |
|---|---|---|
| C-01 | Inbox · All/WhatsApp/Outlook/Telegram filters + counts | PASS |
| C-02 | Inbox · search box + no-results state | PASS |
| C-03 | Inbox · message card click (select + read in DemoState) | PASS |
| C-04 | Inbox · ArrowUp/ArrowDown card navigation + focus | PASS |
| C-05 | Inbox · "Open in Message Intelligence" link | PASS |
| C-06 | Inbox · "Finish mock loading" | PASS |
| C-07 | Inbox · "Retry local fixture" | PASS |
| C-08 | Inbox · empty state "Choose a demo scenario" link | PASS |
| C-09 | Inbox · "Impact Explorer" link (only after verification) | PASS |
| C-10 | MI · message picker links (no `?message`) | PASS |
| C-11 | MI · missing message "Back to inbox" | PASS |
| C-12 | MI · loading finish / error retry / empty "Load a demo scenario" | PASS |
| C-13 | MI · supplier, PO, incident type, qty, unit, ETA, ETA time, note inputs | PASS |
| C-14 | MI · Confirm disabled while dirty, with reason | PASS |
| C-15 | MI · Save correction validation errors (nothing saved) | PASS |
| C-16 | MI · Confirm blocked on contradiction/unsafe identity/unmatched PO/unresolved | PASS |
| C-17 | MI · Discard edits button + Esc | PASS |
| C-18 | MI · Save with no change refused | PASS |
| C-19 | MI · history version buttons + ↑/↓/Home/End | PASS |
| C-20 | MI · "View latest" | PASS |
| C-21 | MI · Reject / Mark unresolved (reason required) | PASS |
| C-22 | MI · reopen via save, Confirm & verify incident, form locks after | PASS |
| C-23 | MI · Link to existing incident → Cancel / Confirm link | PASS |
| C-24 | MI · incident handoff panel + "Open Impact Explorer" | PASS |
| C-25 | MI · audit evidence panel + "Back to inbox" | PASS |
| C-26 | MI offer · Qualify / Reject offer / Mark unresolved (reason required) | PASS |
| C-27 | MI offer · review history (read-only list) | PASS |
| C-28 | MI offer · "Plan A" link | PASS |
| C-29 | Channels · 4 scenario buttons (aria-pressed) | PASS |
| C-30 | Channels · Reset shared demo | PASS |
| C-31 | Channels · Show mock loading / error in Inbox | PASS |
| C-32 | Channels · Clear mock state / View in Inbox | PASS |
| C-33 | Settings · Show unread first toggle → Inbox ordering | PASS |
| C-34 | Settings · Show processing timeline toggle → Inbox | PASS |
| C-35 | Settings · Reset demo | PASS |
| C-36 | Sidebar · Inbox, Message Intelligence, Channels, Settings links | PASS |

### End-to-end journeys
| Journey | Result |
|---|---|
| Inbox → MI → confirm WA → link OL + TG → one HP-INC-001, 3 messages, 20 kg, stock 10 kg | PASS (jsdom + real browser) |
| Human correction → versioned HUMAN_CORRECTION, raw unchanged, unsafe confirm blocked | PASS |
| Reject/unresolved → reopen → confirm | PASS |
| Ingest → duplicate suppressed → scenario switch → reset to pending | PASS |
| Spoof / unknown sender / unmatched PO never verify | PASS |
| Supplier offer scenario → Inbox → MI → qualify → P3 selector | PASS |
| Navigation away/back preserves reviews, evidence and incident | PASS |
| Keyboard-only and mobile journeys | PASS |

### Requirement audit
- P1-FR01–FR19: PASS (FR15 now includes published snapshot reference; FR19 links to P2 without computing totals).
- P1-T01, T03–T09, T12: PASS. P1-T02, T10, T11: OUT_OF_SCOPE (real provider envelopes, live bridge, replay channel — excluded by mock-only scope; simulated loading/error/retry covered).
- Architecture: one `useSyncExternalStore` store; only `demoStore.ts` imports the business fixture; HP-OFFER-002 defined once; dependencies limited to react, react-dom, react-router-dom, lucide-react; no fetch/WebSocket/OAuth/webhook/provider SDK (enforced by test).

### Remaining external dependencies (not P1-owned)
- P2 `/impact`, P3 `/recovery/plan-a`, P5 pages are empty; they do not yet consume `selectActiveIncident`, `selectPublishedEvents`, `selectSupplierOfferEvidence`, `selectIncidentEvidence`/`selectMessageEvidence`, or call `acknowledgeIncidentHandoff()`. Handoff therefore correctly shows "awaiting P2 consumer".
- Push to GitHub must be done from a local terminal (blocked from the agent environment).

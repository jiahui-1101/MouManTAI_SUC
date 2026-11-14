# P1 Progress — Mock Messaging and Channels

## Status

**Milestone:** Final QA — P1 incomplete; review and team handoff pending

**Branch:** `feature/p1-mock-messaging` (created from `main`)

**Implementation:** Parser, polished `/inbox`, mock-only `/channels`, and mock-only `/settings` complete

## Central shared state migration (supersedes earlier missing-interface findings)

- Authorized centralized implementation now lives in `src/store/demoStore.ts`; `features/messaging/inboxStore.ts` is a re-export facade, with no independent state or subscriptions.
- `src/data/fixtures/happyPotato.ts` contains the Shared MD canonical business fixture: suppliers, inventory, PO, recipes, forecasts, confirmed orders, offers, resources and snapshot metadata. Existing canonical message fixtures now live alongside the centralized store.
- DemoState includes the pending HP-INC-001, HP-SNAP-001 revision 1, OPEN HP-PO-1042 and accepted chicken stock 10000. No seeded message is initially linked as verified.
- Typed MESSAGE_RECEIVED, MESSAGE_EXTRACTION_REVIEWED, INCIDENT_VERIFIED and DEMO_RESET events update the same subscribed state. Review versions retain original parsed evidence; verification requires safe reviewed messages and correlates them to one incident.
- Shared exports: selectActiveIncident, selectMessagesForIncident, selectOperationalSnapshot, useDemoState and demoStore. Snapshot fingerprint uses deterministic FNV-1a over canonical fixture JSON, explicitly labelled fnv1a32 (not SHA-256). Message review/verification leaves snapshot identity and quantities unchanged.
- Published state and original evidence are recursively frozen. Incoming message records are cloned, duplicate envelope keys suppressed, and ID collisions rejected.
- Acceptance verified: a subscribed selector test consumer sees P1 facade review/verification immediately, three distinct messages and one 20000 shortfall. P1 facade and shared store return the identical state object.
- Validation: 46 tests across 6 files pass; typecheck and build pass.
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
- [ ] Implement and test rule extraction and review behavior.
- [x] Implement and test mock-only channel/settings behavior.
- [x] Run full tests, typecheck, and production build for the parser milestone.

## Inbox implementation notes

- `/inbox` renders the three canonical shared messages: `HP-MSG-WA-001`, `HP-MSG-OL-001`, and `HP-MSG-TG-001`.
- Canonical alternative-state fixtures `HP-MSG-SPOOF` and `HP-MSG-UNKNOWN` visibly exercise unverified-sender and unmatched-message handling.
- All messages are explicitly labelled `SIMULATED_CHANNEL`; the UI states that no channels are connected.
- The shared module store owns selection and read state so message state survives component-local interactions.
- Search covers the demo-safe sender, Outlook subject, `HP-PO-1042`, and immutable message text.
- Detail shows synthetic sender identity, masked provider ID, exact fixture timestamp, immutable original evidence, canonical rule result, unknown ETA, linked-incident state, and the single `HP-INC-001` correlation rule.
- Duplicate-provider-event suppression is represented by shared state and disclosed in the inbox; suppressed records are not inserted as messages or incidents.
- The selected shared message navigates to `/message-intelligence` with its canonical message ID.
- Desktop split view collapses to a stacked tablet/mobile layout while preserving keyboard-accessible controls.
- No provider SDK, network integration, OAuth, API, credential, or backend work was added.

## Channels and settings implementation notes

- `/channels` presents WhatsApp, Outlook, and Telegram strictly as synthetic fixture sources with shared-store message counts, last fixture event, provenance, and available canonical scenarios.
- Demo controls load the three-channel, review-state, or empty fixture into the existing shared inbox store and can reset the shared demo state.
- `/settings` presents all four fictional suppliers from the shared registry and the canonical deterministic extraction summary.
- In-memory preferences control unread-first ordering and processing-timeline visibility in `/inbox`; reset restores fixtures, read state, and defaults.
- Registered suppliers that are not assigned to `HP-PO-1042` remain blocked from verifying its canonical message.
- No connection status, OAuth, webhook, provider API, credential field, live-message control, or simulation API was added.

## Latest verification

- `npm test`: 44 tests passed across 5 test files.
- `npm run typecheck`: passed.
- `npm run build`: passed with Vite 8.3.8.
- No dependencies or external services were added.
- Parser and inbox scope is deterministic and offline; no AI model or API call exists.

## Final QA audit (2026-11-14)

### Requirement coverage after mock-state/accessibility increment

PASS means verified within the agreed offline scope, not downstream integration acceptance.

- P1-FR01 PASS — channel filters/counts tested.
- P1-FR02 PASS — sender/subject/PO/content search reads fixture fields.
- P1-FR03 PASS — channel, simulated provenance, timestamps and stages rendered.
- P1-FR04 PASS — immutable original detail and masked synthetic identifiers.
- P1-FR05 BLOCKED — one P1 module store manages read/selection; reviewed state and team DemoState are absent.
- P1-FR06 BLOCKED — distinct messages exist; seeded link metadata is not explicit reviewed correlation.
- P1-FR07 BLOCKED — empty, mock loading/error recovery and unverified/unmatched UI work; duplicate counter remains seeded rather than actual deduplication. Provider connection errors OUT_OF_SCOPE.
- P1-FR08 PASS — polite atomic message/unread count notification; selection does not auto-navigate.
- P1-FR09 PASS — responsive styles, native buttons and tested arrow-key focus/selection. Physical viewport QA remains recommended.
- P1-FR10 BLOCKED — visual timeline exists, but reviewed/linked stages are not backed by review events.
- P1-FR11 BLOCKED — Message Intelligence original/extraction evidence grid absent.
- P1-FR12 BLOCKED — parser matches canonical PO/sender, but review conflict UI absent.
- P1-FR13 BLOCKED — editable validated review candidates absent.
- P1-FR14 BLOCKED — parser rejects unsafe senders; confirmation UI absent.
- P1-FR15 BLOCKED — no approved shared INCIDENT_VERIFIED reducer/snapshot interface.
- P1-FR16 BLOCKED — raw source preserved; immutable versioned human-review history absent.
- P1-FR17 PASS — deterministic RULE_EXTRACTION/UNRESOLVED labels, no AI claims.
- P1-FR18 BLOCKED — no actual existing shared incident to explicitly link secondary messages to; seeded IDs cannot substitute for it.
- P1-FR19 BLOCKED — shared impacted-menu selector/context and P2 consumer absent.
- P1-T01 PASS — canonical parser values covered by tests.
- P1-T02 OUT_OF_SCOPE — real provider envelopes excluded.
- P1-T03 BLOCKED — actual duplicate ingestion test/interface absent; displayed counter is not proof.
- P1-T04 BLOCKED — three distinct canonical messages preserved; reviewed single-incident correlation absent.
- P1-T05 PASS — unknown and wrong-PO suppliers cannot verify in parser.
- P1-T06 PASS — update promise retains UNKNOWN ETA.
- P1-T07 PASS — unsupported text resolves to human-review state without fabricated fields.
- P1-T08 BLOCKED — human edits/version audit not implemented.
- P1-T09 PASS — channel filtering tests pass.
- P1-T10 OUT_OF_SCOPE — bridge excluded; local mock loading/error/retry covered separately.
- P1-T11 OUT_OF_SCOPE — replay channel excluded.
- P1-T12 BLOCKED — keyboard selection/focus regression passes and responsive CSS exists; actual mobile/tablet overflow verification not performed.

### Shared interface and handoff dependencies

- Typed mock data interface PASS locally: InboxMessage, InboxState and DemoFixtureId describe the existing single P1 store. This is not claimed to be the integrator-owned DemoState.
- Explicit canonical seed/reset PASS: Channels loads predefined fixture subsets; Settings reset restores fixture/read/preferences. Loading/error controls are local presentation states only.
- P1 → P3 offer handoff BLOCKED: Shared MD defines optional HP-MSG-OL-OFFER, but it is not in the implemented fixture and no P3 evidence consumer exists. Do not invent a second offer store.
- P1 → P5 evidence/history handoff BLOCKED: original fixture text exists, but versioned review history and P5 evidence consumer do not.
- SAME shared DemoState verification BLOCKED: P2–P5 routes remain placeholders; no common business snapshot/incident reducer/selectors exist to verify. Integration approval is required before defining or changing those shared contracts.
- No parallel store, shared contract changes, downstream implementation changes, provider code or network infrastructure were introduced in this increment.

- Inbox, Channels and Settings render and their covered interactions pass. Fixed the empty-fixture Inbox crash with a regression test and a link back to scenario loading.
- Message Intelligence remains an empty route: navigation works, but extraction review, human edits, evidence version history and confirmation are NOT implemented. P1 is not complete.
- Parser tests verify 20,000 milli-kg expected, zero claimed, 20,000 shortfall and UNKNOWN ETA, preserving original text and evidence spans.
- The three canonical channel messages remain separate records. Their incident correlation is presentation metadata only: no actual shared Incident entity or reducer exists. The seeded linked status is not evidence of human verification.
- Duplicate suppression is a seeded counter, not a tested event-ingestion deduplication implementation.
- Messaging uses one module store and fixture array, but the full integrator-owned shared business fixture/store is absent. Rule-summary quantities and Inbox display quantities are still independently repeated; the single-source requirement is not fully satisfied.
- No runtime HP-SNAP-001 snapshot exists in this branch. No snapshot or canonical business quantities were changed by this QA fix; snapshot preservation cannot be tested until the shared interface exists.
- INCIDENT_VERIFIED dispatch, shared incident state, review history and P2 selector are absent. Impact Explorer is an empty page. A P1 → shared incident → P2 integration test cannot honestly be added against an existing interface.
- Team integration must provide the canonical shared snapshot/PO/inventory/incident types, reducer and P2 selector. P1 then needs reviewed extraction versions, explicit correlation/verification and the typed event handoff before the cross-part acceptance test can pass. Do not create another P1 incident or inventory store to substitute for that interface.
- Source inspection found no provider network calls, OAuth implementation, live channel mode or connection setup. Credential-related words occur only in explanatory mock-boundary text.
- Git diff against main contains no changes to P2–P5 page implementations, shared layout, navigation, router or design tokens. QA changed only the P1 Inbox, its tests and this progress document.

# Shared state integration (P1 ↔ P2 → P3 / P4 / P5)

Offline mock only: no provider APIs, OAuth, webhooks or backend.

## Ownership
| Data | Authority | Access |
|---|---|---|
| Snapshot `HP-SNAP-001` (lots, POs, menus, recipes, orders, forecasts, supplier claims), business `Incident`, impacts | P2 `services/mock/restaurantStore.ts` (`RestaurantState`) | `useRestaurantStore()`, or `DemoState.restaurant` (same object reference, never copied) |
| Canonical seed + supplier offers `HP-OFFER-002/003` | `data/fixtures/happyPotato.ts` (single fixture) | imports |
| Messages, extraction versions, reviews, offer qualifications, P1 verification record + handoff, published events | P1 `store/demoStore.ts` | `useDemoState()` + P1 selectors |

The P1 `incident` record (`selectActiveIncident`) is the verification/correlation ledger for the same ID `HP-INC-001`; its `messageIds` always equal the P2 incident's. Business status/claims come from P2 (`selectBusinessIncident`).

## Event flow
1. P1 Confirm / Link (`confirmExtractionReview`, `linkMessageToIncident`, or `INCIDENT_VERIFIED` dispatch) → `applyVerifiedSupplierMessage` (P2 production reducer `recordSupplierIncident`). First verification records one supplier claim (snapshot rev +1); further channels only append message IDs. Physical lots never change.
2. P2 store change → demoStore mirror subscription updates `DemoState.restaurant` and emits once (no write-back → no loop).
3. P2 `assessImpactAction` produces a current `ASSESSED`/`BREACH_RISK` impact → P1 handoff becomes `ACKNOWLEDGED_BY_P2` automatically. Manual `acknowledgeIncidentHandoff()` is refused without such an impact.
4. P3 `/recovery/plan-a`: `integration/planAShared.ts#selectPlanAInputRead` → `adaptPlanAInputs` → `PlanAWorkspace`. Offer `HP-OFFER-002` evidence: canonical business quote by default; if `HP-MSG-OL-OFFER` exists, its P1 qualification decides (`UNREVIEWED/UNRESOLVED`→`UNVERIFIED`, `REJECTED`→`REJECTED`, `QUALIFIED_CONDITIONAL`→`SYNTHETIC_DEMO_APPROVED` + message evidenceRef). Availability stays `UNCONFIRMED`. Scenario `HP-SC-A-001`, version = snapshot revision + offer decisions.
5. P4 `/recovery/plan-b`: `integration/planBShared.ts#selectPlanBInput` maps P2 `buildP4Handoff` + snapshot to the P4 engine. What-if slider is local, keyed by fingerprint.
6. P5: `integration/p5Evidence.ts#selectP5IncidentDossier` (P1 incident/message/offer evidence, P2 `buildP5Handoff`, P1 events). Read-only.

## Reset / scenario / freshness
- P1 reset, `DEMO_RESET` or scenario switch → also resets P2 (guarded).
- P2 reset (P2 demo controls) → P1 incident, reviews and evidence reset; active fixture kept.
- Any snapshot change (e.g. recount) makes the P2 impact stale: P1 handoff panel shows STALE, Plan A returns to pending, Plan B shows STALE until P2 reassesses.

## Handoff status
- P1→P2: integrated (production reducer, both directions of reset, real acknowledgement).
- P1/P2→P3: integrated for inputs, comparison, eligibility and conditional preview/drafts. **Blocked:** `SCENARIO_A_READY` publication — no root storage/acknowledgement exists, so no publisher is passed and P3 shows its pending state.
- P1/P2→P4: integrated for Plan B. Prep batch schedule/holding assumption remain P4-owned planning data (`plan-b/preview.ts` batches); `/prep-planning` still uses the P4 preview.
- P1→P5: read-only adapter only. P5 pages are placeholders; approval, execution, goods-receipt evidence and outcomes are for the P5 owner.

## Known contract gaps
- P2 `assessIncidentImpact` refreshes `Incident.snapshotFingerprint` only on first assessment; the Plan A adapter uses the current authoritative impact's fingerprint after a reassessment.
- P2 demo controls still offer test-mode `simulateSupplierReport`, which bypasses P1 review (P2-owned; not used by the integration).

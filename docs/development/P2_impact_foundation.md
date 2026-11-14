# P2 Stage 1 — Data & Impact Foundation (interface notes)

All business data is **synthetic** (`SYNTHETIC_BUSINESS`, "Happy Potato • Demo data"), not Happy Potato's real
recipes, sales or stock. No FeedMe connection, no solver: calculations are `SIMULATED_CALCULATION`.
The [shared Happy Potato contract](https://github.com/jiahui-1101/MouManTAI_SUC/blob/703a710/docs/requirements/00_SHARED_HappyPotato_Mock_Data_and_Contracts.md)
(SUC-SHARED-01 v1.0) specifies the canonical quantities.

## Files

| Path | Role | Owner |
|---|---|---|
| `frontend/src/types/{common,restaurant,index}.ts` | Shared contracts | Integration lead (P2 drafted) |
| `frontend/src/utils/{quantity,time,fingerprint,snapshot}.ts` | Integer grams/sen, `HH:MM`, deterministic fingerprint | Shared |
| `frontend/src/data/fixtures/happyPotato.ts` | Canonical seed `HP-SNAP-001` r1 (before message) | Shared fixture |
| `frontend/src/features/impact/calculations.ts` | Pure calculation functions | P2 |
| `frontend/src/features/impact/assessImpact.ts` | `ImpactAssessment` / `ImpactSummary` generation | P2 |
| `frontend/src/services/mock/restaurantState.ts` | Pure state transitions + selectors (store slice, not a store) | P2 → integrator wires into `DemoState` |

## Contract additions needing review (marked "P2 addition" in code)

`RecipeVersion`/`RecipeComponent` (BOM is the per-portion source; `MenuItem.chickenKgMilli` is derived from it),
`Reservation`, `SupplierClaim`, `OperationalSnapshot.{recipes,reservations,supplierClaims}`, `InventoryLot.quarantined`,
`PurchaseOrder.expectedKgMilli: number | null`, `Incident.supplierId`, `ImpactAssessment`, `IngredientPosition`,
`DataQualityIssue`, `Supplier`, `Ingredient`, `Tenant`, `Outlet`.

## Integration boundary

```ts
const s0 = createInitialRestaurantState();                 // DEMO_RESET / seed
const s1 = recordSupplierIncident(s0, report);              // from P1: INCIDENT_REPORTED / INCIDENT_VERIFIED
const s2 = assessIncidentImpact(s1, "HP-INC-001");          // IMPACT_ASSESSED
const s3 = reviseSnapshot(s2, reason, draft => { ... });    // SNAPSHOT_CHANGED (new revision + fingerprint)
selectCurrentImpact(s3, "HP-INC-001");                      // null once stale
isImpactStale(s3, "HP-INC-001");                            // true after a material change
```

Rules enforced:

- A `PENDING` report creates a `PENDING_VERIFICATION` incident and leaves the snapshot untouched; impact = `PENDING_VERIFICATION`, `summary: null`.
- One supplier claim per PO. Further messages (other channels, redeliveries) only link `messageIds`; no extra subtraction.
- Messages never change physical lots. Claimed incoming is reported separately, never counted as available.
- Snapshot fingerprint covers material content only (`fnv1a64:` change-detection hash, not SHA-256). No-op revisions are ignored; in-place mutation is detected by `verifySnapshotFreshness`.
- Missing/unapproved/mismatched BOM, missing PO quantity or unit mismatch → `UNKNOWN` with reasons. Confirmed deficit → `BREACH_RISK`; confirmed orders are never dropped.
- `feasibilityOfConfirmed` is `CONDITIONAL` when ingredient-sufficient (P2 does not schedule production), `UNKNOWN` with no capacity data, `INFEASIBLE` with a deficit.

## Canonical results (verified by `frontend/tests/p2/impact.test.ts`)

PO shortfall 20.000 kg · forecast chicken 22.000 kg · confirmed chicken 8.750 kg (60 portions) · eligible physical 10.000 kg ·
forecast gap 12.000 kg · discretionary 1.250 kg · frozen fries 27.000 kg of 30.000 kg · affected menus CP/CT/HC · fries-only unaffected.

## Stage 2–3: pages, store adapter and handoffs

- `services/mock/restaurantStore.ts` — `useSyncExternalStore` adapter over the Stage 1 slice (no provider, no second store).
  Replace `getP2State/subscribeP2` with the unified `DemoState` selectors later; pages only call `useRestaurantStore()` and the actions.
  Demo actions (`simulateSupplierReport`, `simulateVerification`, `simulateChickenRecount`, `resetDemo`) are TEST MODE ONLY and always
  record `SIMULATED_CHANNEL`; real-channel ingestion must call `recordSupplierIncident` through P1, never these functions.
- `features/impact/graph.ts` — dependency graph from fixture relationships only. Station rule (synthetic): a station serves a menu when its
  capability ingredient (`DEMO_CHICKEN_BATCH`→chicken, `DEMO_FROZEN_FRIES`→fries) is in that menu's approved recipe.
- `features/impact/handoff.ts` — **proposed contracts, need P3/P4/P5 review**: `buildP3Handoff`, `buildP4Handoff`, `buildP5Handoff`.
  All carry the same `{ id, revision, fingerprint }` snapshot ref and return `{ ready: false, reason }` unless the impact is verified,
  assessed and current. Consumers must mark their scenario STALE when the fingerprint changes.
- Confirmed orders: "no ingredient deficit" ≠ "fulfilled". UI shows ingredient coverage and fulfilment (`CONDITIONAL` / `UNKNOWN` /
  `BREACH_RISK`) separately; P2 never marks an order fulfilled or dropped.
- Stage 3 fix: `ingredientPosition(..., { applySupplierClaims: false })` now counts a claimed PO as planned incoming (true "before" view).

## Shared files touched (team review)

`frontend/vite.config.ts` (test glob), `frontend/tests/navigation.test.tsx` (empty-shell check skips implemented P2 routes),
`types/*`, `data/fixtures/happyPotato.ts`. P2 presentation maps to the shared semantic tokens described in
the [Portal design guide](../design/FEEDME_PORTAL_ALIGNMENT.md). The existing route table remains the integration boundary.

## Assumptions

- Lots have no availability time in the contract; on-hand lots are treated as available from the 09:00 demo clock.
- Default `neededByLocal` for impact is the 10:45 incremental prep cut-off.
- After verification of `UNAVAILABLE`, PO `HP-PO-1042` becomes `SUPPLIER_CLAIMED_UNAVAILABLE_TODAY` (snapshot revision 2).

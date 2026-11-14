# P3 shared integration seam — final handoff

Status: **P3 implementation complete / shared integration pending**.
This directory supplies adapters and an injectable acknowledged publication API.
It contains no fixture, root store, event bus or scenario version allocator.

## Integrator wiring

1. Read the authoritative active incident, operational snapshot, P2 impact, outlet,
   ingredient policy and explicit demo business clock into `PlanAInputRead.source`.
   Use `SupplierOfferInput[]` plus registry rows and explicit per-offer evidence /
   availability states. Do not infer qualification from quoted price or contact name.
2. Supply `scenarioMetadata` from the root version authority. It must assign the
   scenario identity and version, source evidence, action IDs and capacity status.
3. Call `adaptPlanAInputs(read)`. On success, its value can be spread into
   `PlanAWorkspace` props. On failure, surface its code/message as pending/blocked.
4. Pass a `PlanAPublisher` only when backed by the actual root action. Its
   `readCurrent()` must read authoritative inputs at click time, rather than capture
   stale render props. Do not pass local ETA sensitivity data to this dependency.
5. Implement `commitScenarioA(request)` in the integration-owned root adapter. It
   must atomically check incident readiness, current snapshot fingerprint/revision,
   current offer and clock constraints, and root-authorized scenario identity/version;
   then store the standard scenario and return a matching acknowledgement. The
   request includes supplemental P3 conditions, source labels and offer assessment.
   The root must retain these conditions or map them into its approved event model.
6. Return `STORED` or `ALREADY_STORED` with the exact stored scenario, publication
   key and snapshot revision. Return `REJECTED` if a compare-and-set or validation
   fails. A void dispatcher does not satisfy this boundary. Read-back or dispatcher
   acknowledgement implementation belongs to the root owner.

`publishScenarioAReady` revalidates before dispatch, projects the exact Markdown
scenario fields with `toPlanAHandoff`, verifies the acknowledgement, and revalidates
after dispatch. A concurrent change produces `INPUTS_CHANGED_DURING_PUBLICATION`;
the root remains responsible for invalidating any already-stored old scenario.
Dependency exceptions produce an unconfirmed result, because P3 cannot know whether
a commit occurred. Retry through the same idempotent root action, never a new key.

The publication key is an encoded tuple of event, incident, scenario, version,
fingerprint and snapshot revision. This is a local request key, not a new fingerprint.
P3 suppresses duplicate UI clicks; the root must enforce atomic idempotency across
components, retries and sessions, rejecting different content under an existing key.

## Freshness and version authority

Every material stock, offer, BOM, confirmed-order, capacity, incident or deadline
change must advance the root snapshot revision/fingerprint and assign a newer
scenario version (or documented replacement identity). Do not advance versions on
render, preview generation or identical publication retries. `readCurrent` metadata
must still identify the acknowledged version until a material change occurs.

`validateScenarioFreshness` checks supplied identity, fingerprint, revision and version,
then rebuilds the candidate through the domain engine and structurally compares its
costs, quantities, conditions, provenance, evidence and assumptions. The additional
`snapshotRevision` belongs only to P3 candidate detail; `PlanAHandoff` is a `Pick` of
the existing P3 output matching the shared Markdown fields, not a global replacement
`RecoveryScenario` definition. Structural equality is not a hash generator.

The workspace permanently invalidates an old preview until explicit regeneration.
The pure validator accepts an `invalidated` flag for non-UI callers. A future root
must also retain stale/version history so restoring old inputs cannot revive P5
approval. P3's local ETA control changes only an experimental copy, emits no global
event and is blocked from publication until reset and canonical regeneration.

## P5 coordination

P5 consumes `request.scenario` directly, including RM255 cost and portion fields;
no screen scraping or independent Plan A cost recomputation is needed. Set
`comparisonAvailable` only after the real consumer is connected. Draft generation
does not publish; publication does not approve or transmit RFQ/PO drafts. Local
drafts are not mapped into `ExecutionAction` without a separately approved contract.

The integrator owns P5's `createP5Slice(deps)` dependencies (`getActiveIncident`,
`getSnapshot`, `getImpact`, `getDemoClockLocal`, `getCurrentRole`, `emit`), root wrappers
for P5 selectors, and P5's stale approval/reapproval enforcement. P3 does not implement
them. The reported `externalSyncStatus`, `RECEIPT_CHECK`, `ESCALATED` and UNKNOWN /
MEASURED verification-evidence extensions require shared/P5 owner alignment.

## Final repository evidence (Phase 6)

The P3 checkout still has no root runtime or P5 consumer. Remote `main` advanced
through another team's PR #1 to `73381578f98211ced80aedb12e6b7a1bb9742957`.
`origin/feature/feedme-portal-ui-integration` is at
`f9d1e59e5b6a3c9e1f4324326757ff94a96dec20`. Both were inspected read-only;
no merge, rebase, cherry-pick or source copying was performed by P3.

Newly available on remote main (not this checkout):

- `frontend/src/types/{common,restaurant,index}.ts`: P2 restaurant contracts.
- `frontend/src/data/fixtures/happyPotato.ts`: P2 canonical seed.
- `frontend/src/services/mock/restaurantState.ts`: `RestaurantState`,
  `selectIncident(state, incidentId)`, `selectOperationalSnapshot(state)`,
  `selectCurrentImpact(state, incidentId)`, `reviseSnapshot`, `assessIncidentImpact`.
- `frontend/src/services/mock/restaurantStore.ts`: `getP2State`, `subscribeP2`,
  `useRestaurantStore`, `assessImpactAction`, `simulateChickenRecount`.
- `frontend/src/features/impact/handoff.ts`: proposed `buildP3Handoff` and
  `buildP5Handoff` contracts, explicitly pending team review.
- Plan A and comparison pages remain placeholders there; no P5 consumer or
  acknowledged `SCENARIO_A_READY` dispatcher was found.

Read-only inspection also retains the Phase 5 P1 findings at
`origin/feature/p1-mock-messaging` (`703a710b908cbdefc0151233a257cfa76c1a6d68`):
`data/fixtures/happyPotato.ts` and messaging-focused `store/demoStore.ts`, with
no scenario publication/P5 slice. These are separate owner implementations;
Integrator must reconcile them rather than importing a second root into P3.

## Production wiring checklist for Integrator

- Bring approved shared/P2 code and P3 together through owner-reviewed integration.
  Resolve the existing Plan A page and application styling changes under that review.
- Subscribe the existing `pages/PlanA/PlanAPage.tsx` to canonical state. On the P2
  surface above, select `restaurant` from `useRestaurantStore()`, then call
  `selectIncident`, `selectOperationalSnapshot`, and `selectCurrentImpact` for the
  active incident. Pass `impact.summary` only if non-null and authoritative on the
  same snapshot; `P3ImpactHandoff` alone is an aggregate and cannot replace the raw
  verified incident/snapshot/summary needed by the current adapter.
- Map outlet, product requirement and business date/timezone/cutoff from approved
  fixture/selectors. Supply an explicit demo clock and receiving buffer; never use
  browser wall-clock time as an operational default.
- Resolve P2 `PurchaseOrder.expectedKgMilli: number | null`: null must block, not
  become zero. P2 quarantine, expiry, reservations, recipes and eligible-stock
  semantics need shared alignment. Do not silently relabel an adjusted eligible
  balance as physical accepted stock. P3's consistency check blocks mismatched
  impact values; this is a safe blocker, not a complete general P2 allocation engine.
- Supply source offers, registry approval status, evidence references, provenance,
  per-offer spec/availability flags and externally assigned scenario metadata.
  Do not derive missing approval/evidence fields from a name or quoted qualification.
- Call `adaptPlanAInputs`. On success spread its value into `PlanAWorkspace`; on
  failure show its pending/blocked message. The production page must not import
  `tests/plan-a/*` or populate its own Happy Potato fixture.
- Pass an authoritative `PlanAPublisher` only when the acknowledged root action
  described above exists. Keep comparison/evidence navigation availability false
  until the real consumers can use the supplied incident/evidence query context.
- Connect `request.scenario` to P5's actual comparison slice and retain/map
  supplemental conditions. Integrator/P5 own approval history, version allocation,
  stale approval blocking and the reported P5 execution/evidence extensions.

Tests using the canonical test factory and injected acknowledgements establish only
local contracts. Actual root storage, actual P2 connection, actual P5 consumption
and the P1 → P2 → P3 → P5 flow remain blocked in this branch. No reported external
P5 tests were run or assumed successful.

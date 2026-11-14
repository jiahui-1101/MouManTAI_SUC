# P3 shared integration seam — Phase 5

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

## Repository evidence at Phase 5

Current P3 branch and `origin/main` do not contain the shared runtime or P5 consumer.
Available remote heads are main, project foundation, P1 messaging and P3. No P5
implementation is available to import or test; its reported 154 tests were not run.

Read-only inspection of `origin/feature/p1-mock-messaging` at
`703a710b908cbdefc0151233a257cfa76c1a6d68` found:

- `frontend/src/data/fixtures/happyPotato.ts`: canonical business fixture.
- `frontend/src/store/demoStore.ts`: messaging-focused `DemoState`, fingerprint,
  `selectActiveIncident`, `selectOperationalSnapshot` and messaging dispatch.
- No `SCENARIO_A_READY`, P2 impact selector, P5 slice or scenario consumer.
- Incident lacks the shared `type`, `revision`, `snapshotFingerprint`; inventory
  lots lack `availableAtLocal`; confirmed groups lack `status` and
  `agreedRecipeVersion`; offers lack `evidenceRef`; supplier rows lack registry
  qualification. These must be supplied by the responsible owners, not inferred by P3.

No remote branch was merged or cherry-picked. Tests using the existing canonical
test factory establish local adapter/publisher contracts only. Mock acknowledgements
and a mock idempotent consumer do not establish actual root storage or P5 integration.

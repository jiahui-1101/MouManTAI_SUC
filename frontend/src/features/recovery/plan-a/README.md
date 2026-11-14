# Plan A presentation boundary

`PlanAWorkspace` receives `PlanAWorkspaceProps`; it owns only local inspection,
selection, timing sensitivity and proposal-preview state. The current production
page passes no business data and therefore shows the waiting state.

The integration lead can supply:

- `source`: the verified incident, snapshot, P2 impact, ingredient policy, outlet
  and explicit business clock, structurally adapted to `RecoverySourcingNeedInput`.
- `candidates`: `SupplierOfferCandidateInput[]` including registry status,
  specification evidence and availability. `supplierNames` maps IDs to display names.
- `scenarioMetadata`: caller-owned scenario ID/version/evidence/action IDs and
  capacity status. No scenario identity is invented by the UI.
- `loading` / `error`: input-loading and retrieval-error presentation.
- `impactAvailable`, `evidenceAvailable`, `comparisonAvailable`: enable navigation
  to the existing routes once those consumers are ready; incident context is carried
  in query parameters. These flags do not publish a scenario.
- `onPreview`: receives the locally generated `PlanAScenarioCandidate` for optional
  observation. It is not an approval or shared-event dispatch API.

Every render derives need and assessments through the Phase 2 domain functions.
Any source, quote, scenario metadata, selection or timing-preview change invalidates
an existing proposal. Invalidated metrics stay hidden until explicit regeneration.
The ETA sensitivity copy never modifies caller-owned quotes or snapshots.

For visual review with the single test-only factory, run Vite and open
`/tests/plan-a/review.html`. This entry is not imported by the production application
or included in its build. It exercises the same workspace as the production page
without introducing runtime demo fixtures or a separate store.

Phase 4 adds RFQ/PO drafts. Phase 5 supplies shared selectors and
`SCENARIO_A_READY` publishing; these remain integration-lead dependencies.

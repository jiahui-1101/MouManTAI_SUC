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
without introducing runtime demo fixtures or a separate store. The clearly labelled
"Inject test publisher acknowledgement" checkbox exercises only a test double;
it does not connect P5 or a root store.

Phase 4 provides pure `createRfqDraft(DraftInput)` and
`createInternalPoDraft(InternalPoInput)` generators, each returning `DraftResult`.
They revalidate source and quote data; PO drafts additionally recompute and compare
the caller proposal against its supplied metadata. `PlanADraftActions` keeps at most
one document per type in local React state. Identical creation reopens that record.
Changed inputs mark records STALE permanently until explicit regeneration, including
when old inputs are restored. Closing the panel keeps the local record; unmounting
the workspace clears it. No browser storage or global draft store is used.

Draft status is DRAFT or NEEDS_REVIEW (plus local NOT_CREATED / STALE). Approval and
transmission remain NOT_APPROVED / NOT_SENT. Unknown contact authorization and quote
validity remain explicit review requirements. Clipboard success is reported only
after `writeText` resolves; failed or unavailable copy leaves selectable text.
Local `demo:rfq:` and `demo:po:` references are deterministic identifiers, not
provider messages, supplier-issued POs or cryptographic snapshot fingerprints.

Phase 5 supplies `adaptPlanAInputs`, `validateScenarioFreshness`,
`publishScenarioAReady` and `toPlanAHandoff` through `integration/index.ts`.
`PlanAWorkspace.publisher` is optional; without it the workspace displays publication
pending and offers no Propose action. With it, explicit proposal publication must
receive a matching authoritative storage acknowledgement. Local sensitivity previews
cannot publish. Root selectors/storage and the actual P5 consumer remain pending.
See [integration/README.md](./integration/README.md) for exact owner contracts,
read-only remote findings, version policy, idempotency and acknowledgement requirements.

Final acceptance fixes add Plan B navigation for an empty supplier list and prevent
a delayed publication notice from reviving after an input-change/restore cycle.
The supplied-Outlook-evidence contract is covered; real provider ingestion remains
another owner's integration dependency. See the integration README for the newly
available remote P2 interfaces and the production wiring checklist.

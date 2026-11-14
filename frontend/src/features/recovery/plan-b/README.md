# P4 integration

Both pages consume the same temporary P4 preview in `preview.ts`. The demo fingerprint is a revision label. When shared state is available, replace the preview with P0 snapshot and verified incident selectors and pass the matching P2 impact identity to `calculatePlanB`.

P5 can consume `RecoveryScenarioB` from a ready calculation. Check `isCurrentScenario` again against the latest snapshot before approval or execution. P0 must increment snapshot revision and update fingerprint on material changes. Wire `SCENARIO_B_READY` through the shared publisher when it exists. The current frontend foundation has no publisher.

Menu proposals are drafts for manager review. Prep starts planned. P5 owns approval, manual update handoff and recording evidence. The preview includes one chicken lot and one fries lot. Regular fries availability is conditional on capacity and the timeline covers the chicken component only.

From frontend, run `npm ci`, then `npm run dev`. Open `/recovery/plan-b` and `/prep-planning`.

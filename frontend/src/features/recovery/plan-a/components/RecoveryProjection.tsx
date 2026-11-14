import type { PlanAScenarioCandidate } from "../domain";
import { kg, money } from "./presentation";
export function RecoveryProjection({ scenario }: { scenario: PlanAScenarioCandidate }) {
  return <section className="pa-panel" aria-labelledby="projection-heading">
    <span className="pa-kicker">Demo calculation · Local proposal preview</span><h2 id="projection-heading">Potential recovery · CONDITIONAL</h2>
    <p>Potential if the supplier arrives and passes quality checks. Ingredient coverage only; kitchen capacity and production are not guaranteed.</p>
    <dl className="pa-metrics">{[
      ["Proposed additional purchase", kg(scenario.newPurchaseKgMilli)], ["Additional landed cost", money(scenario.additionalCostSen)],
      ["Accepted existing chicken", kg(scenario.acceptedOnHandKgMilli)], ["Conditional incoming chicken", kg(scenario.conditionalIncomingKgMilli)],
      ["Projected chicken after accepted receipt", kg(scenario.projectedChickenAfterConditionalReceiptKgMilli)], ["Forecast requirement", kg(scenario.forecastRequirementKgMilli)],
      ["Projected residual", kg(scenario.projectedResidualKgMilli)], ["Potential forecast chicken-menu portions", scenario.forecastChickenPortionsServed],
      ["Confirmed chicken portions potentially protected", scenario.confirmedChickenPortionsProtected], ["Conditional forecast portions unmet", scenario.forecastChickenPortionsUnmet],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <details><summary>Outstanding conditions, assumptions and evidence</summary><ul className="pa-checks">{scenario.conditions.map(c => <li key={c.code}>{c.description}</li>)}{scenario.assumptions.map(a => <li key={a}>{a}</li>)}</ul><p>Evidence: {scenario.evidenceRefs.join(", ")}</p></details>
    <p className="pa-muted">{scenario.id} · Version {scenario.version} · Snapshot {scenario.snapshotFingerprint}</p>
    <p>Physical inventory is unchanged. This local preview has not been published for comparison or approved.</p>
  </section>;
}

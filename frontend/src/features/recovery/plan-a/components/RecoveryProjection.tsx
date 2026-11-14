import { DataPanel, SectionHeader, StatusBadge } from "../../../../components/ui";
import type { PlanAScenarioCandidate } from "../domain";
import { SupplyCoverage } from "./SupplyCoverage";
import { kg, money } from "./presentation";
export function RecoveryProjection({ scenario }: { scenario: PlanAScenarioCandidate }) {
  return <DataPanel className="pa-panel">
    <div className="pa-card-heading"><span className="pa-kicker">Local proposal preview</span><StatusBadge tone="simulated">Demo calculation · Local proposal preview</StatusBadge></div>
    <SectionHeader title="Potential recovery · CONDITIONAL" actions={<StatusBadge tone="warning">Conditional</StatusBadge>}/>
    <p className="pa-muted">Potential if the supplier arrives and passes quality checks. Ingredient coverage only; kitchen capacity and production are not guaranteed.</p>
    <dl className="pa-metrics pa-projection-metrics">{[
      ["Additional landed cost", money(scenario.additionalCostSen)], ["Projected chicken after accepted receipt", kg(scenario.projectedChickenAfterConditionalReceiptKgMilli)],
      ["Forecast requirement", kg(scenario.forecastRequirementKgMilli)], ["Projected residual", kg(scenario.projectedResidualKgMilli)],
      ["Potential forecast chicken-menu portions", scenario.forecastChickenPortionsServed], ["Confirmed chicken portions potentially protected", scenario.confirmedChickenPortionsProtected],
    ].map(([label, value]) => <div className="pa-metric" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <SupplyCoverage scenario={scenario}/>
    <details><summary>Purchase, stock and calculation detail</summary><dl className="pa-offer-values">{[
      ["Proposed additional purchase", kg(scenario.newPurchaseKgMilli)], ["Accepted existing chicken", kg(scenario.acceptedOnHandKgMilli)],
      ["Conditional incoming chicken", kg(scenario.conditionalIncomingKgMilli)], ["Conditional forecast portions unmet", scenario.forecastChickenPortionsUnmet],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
    <details><summary>Outstanding conditions, assumptions and evidence</summary><ul className="pa-checks">{scenario.conditions.map(c => <li key={c.code}>{c.description}</li>)}{scenario.assumptions.map(a => <li key={a}>{a}</li>)}</ul><p>Evidence: {scenario.evidenceRefs.join(", ")}</p><p className="pa-reference">{scenario.id} · Version {scenario.version} · Snapshot {scenario.snapshotFingerprint}</p></details>
    <p className="pa-muted">Physical inventory is unchanged. Publication and approval status are tracked separately from this local calculation.</p>
  </DataPanel>;
}

import { DataPanel, SectionHeader, StatusBadge } from "../../../../components/ui";
import type { PlanAScenarioCandidate } from "../domain";
import { SupplyCoverage } from "./SupplyCoverage";
import { kg, money } from "./presentation";
export function RecoveryProjection({ scenario }: { scenario: PlanAScenarioCandidate }) {
  return <DataPanel className="pa-panel">
    <SectionHeader title="Recovery preview" actions={<StatusBadge tone="warning">Conditional</StatusBadge>}/>
    <p className="pa-muted">Conditional on receipt and quality acceptance. Ingredient coverage only; production is not guaranteed.</p>
    <dl className="pa-metrics pa-projection-metrics">{[
      ["Additional landed cost", money(scenario.additionalCostSen)], ["Projected stock", kg(scenario.projectedChickenAfterConditionalReceiptKgMilli)],
      ["Forecast demand coverage", scenario.forecastRequirementKgMilli > 0 ? `${Math.min(100, scenario.projectedChickenAfterConditionalReceiptKgMilli / scenario.forecastRequirementKgMilli * 100).toFixed(0)}%` : "No demand"],
      ["Potential forecast portions", scenario.forecastChickenPortionsServed], ["Confirmed portions protected (potential)", scenario.confirmedChickenPortionsProtected],
    ].map(([label, value]) => <div className="pa-metric" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <SupplyCoverage scenario={scenario}/>
    <details><summary>Purchase, stock and calculation detail</summary><dl className="pa-offer-values">{[
      ["Proposed additional purchase", kg(scenario.newPurchaseKgMilli)], ["Accepted existing chicken", kg(scenario.acceptedOnHandKgMilli)],
      ["Conditional incoming chicken", kg(scenario.conditionalIncomingKgMilli)], ["Projected residual", kg(scenario.projectedResidualKgMilli)], ["Conditional forecast portions unmet", scenario.forecastChickenPortionsUnmet],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details>
    <details><summary>Outstanding conditions, assumptions and evidence</summary><ul className="pa-checks">{scenario.conditions.map(c => <li key={c.code}>{c.description}</li>)}{scenario.assumptions.map(a => <li key={a}>{a}</li>)}</ul><p>Evidence: {scenario.evidenceRefs.join(", ")}</p><p className="pa-reference">{scenario.id} · Version {scenario.version} · Snapshot {scenario.snapshotFingerprint}</p></details>
    <p className="pa-muted">Physical inventory is unchanged. Incoming stock is not yet received or quality accepted.</p>
  </DataPanel>;
}

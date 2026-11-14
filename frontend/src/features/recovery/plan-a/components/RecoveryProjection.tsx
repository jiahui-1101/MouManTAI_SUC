import { DataPanel, SectionHeader, StatusBadge } from "../../../../components/ui";
import type { PlanAScenarioCandidate } from "../domain";
import { DetailFacts, ReferenceTokens, conditionLabel } from "./DetailContent";
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
    <details><summary>Purchase, stock and calculation detail</summary><div className="pa-disclosure-body"><div className="pa-stock-equation" aria-label="Conditional stock calculation"><span>{kg(scenario.acceptedOnHandKgMilli)} accepted</span><b>+</b><span>{kg(scenario.conditionalIncomingKgMilli)} conditional</span><b>=</b><strong>{kg(scenario.projectedChickenAfterConditionalReceiptKgMilli)} projected</strong></div><dl className="pa-detail-facts">{[
      ["Proposed additional purchase", kg(scenario.newPurchaseKgMilli)], ["Accepted existing chicken", kg(scenario.acceptedOnHandKgMilli)],
      ["Conditional incoming chicken", kg(scenario.conditionalIncomingKgMilli)], ["Projected residual", kg(scenario.projectedResidualKgMilli)], ["Conditional forecast portions unmet", scenario.forecastChickenPortionsUnmet],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></details>
    <details><summary>Outstanding conditions, assumptions and evidence</summary><div className="pa-disclosure-body">
      <h3 className="pa-detail-heading">Required checks</h3>
      <DetailFacts items={scenario.conditions.map(condition => conditionLabel[condition.code] ?? [condition.code, condition.description])}/>
      <h3 className="pa-detail-heading">Projection assumptions</h3>
      <ul className="pa-assumption-list">{scenario.assumptions.map(assumption => {
        // Only condense known domain sentences; preserve all unfamiliar supplied text.
        const eta = assumption.match(/^Supplier-claimed ETA (.+); receipt and quality acceptance by (.+) are assumed and remain unverified\.$/);
        const coverage = assumption.match(/^Projected chicken coverage is ingredient-only: (.+) accepted stock plus (.+) conditional incoming against (.+) forecast requirement\.$/);
        const text = eta ? `Supplier-claimed ETA ${eta[1]} · Assumed acceptance ${eta[2]} · Unverified`
          : coverage ? `${coverage[1]} accepted + ${coverage[2]} conditional / ${coverage[3]} forecast`
          : assumption === "Forecast chicken portions are potentially covered only after the proposed delivery is physically received and quality accepted." ? "Forecast portions depend on accepted receipt"
          : assumption === "The scenario does not verify kitchen capacity, preparation throughput, or actual production." ? "Kitchen capacity, prep throughput and actual production unverified"
          : assumption;
        return <li key={assumption}>{text}</li>;
      })}</ul>
      <h3 className="pa-detail-heading">Evidence and calculation reference</h3><ReferenceTokens values={scenario.evidenceRefs}/>
      <DetailFacts items={[["Scenario", scenario.id], ["Version", scenario.version]]}/>
      <div className="pa-detail-reference"><span>Snapshot fingerprint</span><code>{scenario.snapshotFingerprint}</code></div>
    </div></details>
    <p className="pa-muted">Physical inventory is unchanged. Incoming stock is not yet received or quality accepted.</p>
  </DataPanel>;
}

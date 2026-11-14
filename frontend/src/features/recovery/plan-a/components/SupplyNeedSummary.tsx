import type { RecoverySourcingNeed } from "../domain";
import { kg } from "./presentation";

export function SupplyNeedSummary({ need }: { need: RecoverySourcingNeed }) {
  return <section aria-labelledby="supply-heading" className="pa-panel">
    <h2 id="supply-heading">Supply requirement</h2>
    <dl className="pa-metrics">{[
      ["Supplier-reported PO shortfall", kg(need.poShortfallKgMilli)],
      ["Accepted physical stock", kg(need.acceptedOnHandKgMilli)],
      ["Forecast ingredient need", kg(need.forecastRequirementKgMilli)],
      ["Forecast ingredient gap", kg(need.forecastGapKgMilli)],
      ["Preparation cutoff", `${need.requiredReceiptCutoffLocal} MYT`],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="pa-muted">Original PO: {kg(need.originalExpectedKgMilli)} planned incoming · Supplier reports {kg(need.claimedIncomingKgMilli)} today. Physical stock remains separate from all supplier claims.</p>
  </section>;
}

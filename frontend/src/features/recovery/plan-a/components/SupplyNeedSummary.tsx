import { DataPanel } from "../../../../components/ui";
import type { RecoverySourcingNeed } from "../domain";
import { kg } from "./presentation";
export function SupplyNeedSummary({ need }: { need: RecoverySourcingNeed }) {
  return <DataPanel title="Supply requirement" className="pa-panel">
    <dl className="pa-metrics pa-supply-metrics">{[
      ["Supplier-reported PO shortfall", kg(need.poShortfallKgMilli)], ["Accepted physical stock", kg(need.acceptedOnHandKgMilli)],
      ["Forecast ingredient need", kg(need.forecastRequirementKgMilli)], ["Forecast ingredient gap", kg(need.forecastGapKgMilli)],
      ["Preparation cutoff", `${need.requiredReceiptCutoffLocal} MYT`],
    ].map(([label, value]) => <div className={`pa-metric ${label === "Forecast ingredient gap" ? "pa-metric--need" : ""}`} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className="pa-muted">Original PO: {kg(need.originalExpectedKgMilli)} planned incoming · Supplier reports {kg(need.claimedIncomingKgMilli)} today. Physical stock remains separate from all supplier claims.</p>
  </DataPanel>;
}

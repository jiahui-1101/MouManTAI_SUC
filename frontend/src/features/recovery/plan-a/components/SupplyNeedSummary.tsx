import { Package, PackageX, UtensilsCrossed } from "lucide-react";
import type { RecoverySourcingNeed } from "../domain";
import { DetailFacts } from "./DetailContent";
import { kg } from "./presentation";

export function SupplyNeedSummary({ need }: { need: RecoverySourcingNeed }) {
  const metrics = [
    { label: "Forecast gap", value: need.forecastGapKgMilli, Icon: PackageX },
    { label: "Accepted stock", value: need.acceptedOnHandKgMilli, Icon: Package },
    { label: "Forecast requirement", value: need.forecastRequirementKgMilli, Icon: UtensilsCrossed },
  ];
  return <section className="pa-supply" aria-label="Supply overview">
    <dl className="pa-supply-kpis">{metrics.map(({ label, value, Icon }) => <div className="pa-supply-kpi" key={label}>
      <svg className="pa-supply-kpi__wave" viewBox="0 0 240 18" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0H240V8C193 1 151 17 106 13C63 9 27 3 0 9Z" />
        <path d="M0 9C27 3 63 9 106 13C151 17 193 1 240 8" />
      </svg>
      <dt><Icon size={15} aria-hidden="true"/>{label}</dt>
      <dd>{kg(value).slice(0, -2)}<span>kg</span></dd>
    </div>)}</dl>
    <dl className="pa-supporting-facts"><div><dt>Supplier-reported PO shortfall</dt><dd>{kg(need.poShortfallKgMilli)}</dd></div><div><dt>Prep cutoff</dt><dd>{need.requiredReceiptCutoffLocal} MYT</dd></div></dl>
    <details><summary>Original delivery</summary><div className="pa-disclosure-body"><DetailFacts items={[
      ["Planned PO delivery", kg(need.originalExpectedKgMilli)], ["Supplier-claimed today", kg(need.claimedIncomingKgMilli)],
      ["PO shortfall", kg(need.poShortfallKgMilli)],
    ]}/><p className="pa-detail-note">Supplier claims do not change accepted stock.</p></div></details>
  </section>;
}

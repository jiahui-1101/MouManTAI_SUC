import { Button, DataPanel, SectionHeader, StatusBadge } from "../../../../components/ui";
import type { OfferAssessment, SupplierOfferCandidateInput } from "../domain";
import { kg, money, reasonText, words } from "./presentation";
export interface EvaluatedOffer { candidate: SupplierOfferCandidateInput; assessment: OfferAssessment }
export interface ComparisonProps {
  offers: EvaluatedOffer[]; supplierNames: Record<string, string>; inspectedOfferId: string | null; selectedOfferId: string | null;
  onInspect: (id: string) => void; onSelect: (id: string) => void;
}
export function SupplierOfferComparison(props: ComparisonProps) {
  return <DataPanel className="pa-panel">
    <SectionHeader title="Alternative suppliers" actions={<StatusBadge>{props.offers.length} offers</StatusBadge>}/>
    <p className="pa-muted pa-section-description">Eligibility first. Price alone cannot qualify an offer.</p>
    {props.offers.length === 0 ? <p role="status">No supplier offers available. Request a documented quote or review internal recovery.</p> : <div className="pa-offers">{props.offers.map(({ candidate, assessment }) => {
      const { offer, supplier } = candidate; const selected = props.selectedOfferId === offer.id;
      const tone = assessment.status === "INCOMPATIBLE" ? "danger" : "warning";
      return <article key={offer.id} className={`pa-offer ${selected ? "pa-offer-selected" : ""}`} aria-label={offer.id}>
        <div className="pa-card-heading"><StatusBadge tone={offer.provenance === "SYNTHETIC_BUSINESS" ? "simulated" : "neutral"}>{offer.provenance ? words(offer.provenance) : "Quote source unknown"}</StatusBadge>{selected && <StatusBadge tone="info">Selected</StatusBadge>}</div>
        <h3 className="pa-card-title">{props.supplierNames[supplier.id] ?? supplier.id}</h3><p className="pa-muted pa-reference">{offer.id} · {supplier.id}</p>
        <dl className="pa-offer-price"><dt>Total landed cost</dt><dd>{money(assessment.landedCostSen)}</dd></dl>
        <StatusBadge tone={tone}>{words(assessment.status)}</StatusBadge>
        <dl className="pa-offer-values">
          <div><dt>Quantity / specification</dt><dd>{kg(offer.quantityKgMilli)} · {offer.spec ?? "Unknown"}</dd></div><div><dt>Quoted ETA</dt><dd>{offer.etaLocal ?? "Unknown"} MYT</dd></div>
          <div><dt>Unit price</dt><dd>{money(offer.pricePerKgSen)}/kg</dd></div><div><dt>Freight</dt><dd>{money(offer.freightSen)}</dd></div>
          <div><dt>Minimum order</dt><dd>{offer.minimumOrderKgMilli == null ? "Not supplied" : kg(offer.minimumOrderKgMilli)}</dd></div><div><dt>Supplier qualification</dt><dd>{words(supplier.status)}</dd></div>
        </dl>
        <div className={`pa-offer-note pa-offer-note--${tone}`}><p>{assessment.reasonCodes.length ? reasonText(assessment.reasonCodes[0]!) : "Conditional on supplier confirmation, receipt and quality acceptance."}</p>{assessment.status === "INCOMPATIBLE" && <p>Price cannot override the failed requirements.</p>}</div>
        <div className="pa-actions"><Button variant="ghost" aria-expanded={props.inspectedOfferId === offer.id} onClick={() => props.onInspect(offer.id)}>Inspect {offer.id}</Button><Button variant={selected ? "primary" : "secondary"} disabled={!assessment.isSelectableForConditionalPlan} aria-pressed={selected} onClick={() => props.onSelect(offer.id)}>Select {offer.id}</Button></div>
      </article>;
    })}</div>}
  </DataPanel>;
}

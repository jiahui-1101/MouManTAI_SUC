import type { OfferAssessment, SupplierOfferCandidateInput } from "../domain";
import { kg, money, reasonText, words } from "./presentation";

export interface EvaluatedOffer { candidate: SupplierOfferCandidateInput; assessment: OfferAssessment }
export interface ComparisonProps {
  offers: EvaluatedOffer[];
  supplierNames: Record<string, string>;
  inspectedOfferId: string | null;
  selectedOfferId: string | null;
  onInspect: (id: string) => void;
  onSelect: (id: string) => void;
}
export function SupplierOfferComparison(props: ComparisonProps) {
  return <section aria-labelledby="offers-heading" className="pa-panel">
    <div className="pa-section-heading"><div><h2 id="offers-heading">Alternative suppliers</h2><p className="pa-muted">Eligibility first. Price alone cannot qualify an offer.</p></div><span>{props.offers.length} offers</span></div>
    {props.offers.length === 0 ? <p role="status">No supplier offers available. Request a documented quote or review internal recovery.</p> : <div className="pa-offers">{props.offers.map(({ candidate, assessment }) => {
      const { offer, supplier } = candidate;
      return <article key={offer.id} className={`pa-offer ${props.selectedOfferId === offer.id ? "pa-offer-selected" : ""}`} aria-label={offer.id}>
        <span className="pa-kicker">{offer.provenance ? words(offer.provenance) : "Quote source unknown"}</span>
        <h3>{props.supplierNames[supplier.id] ?? supplier.id}</h3><p className="pa-muted">{offer.id} · {supplier.id}</p>
        <span className={`pa-badge pa-${assessment.status.toLowerCase()}`}>{words(assessment.status)}</span>
        <dl className="pa-offer-values"><div><dt>Quantity / specification</dt><dd>{kg(offer.quantityKgMilli)} · {offer.spec ?? "Unknown"}</dd></div><div><dt>Unit price</dt><dd>{money(offer.pricePerKgSen)}/kg</dd></div><div><dt>Freight</dt><dd>{money(offer.freightSen)}</dd></div><div><dt>Total landed cost</dt><dd className="pa-price">{money(assessment.landedCostSen)}</dd></div><div><dt>Quoted ETA</dt><dd>{offer.etaLocal ?? "Unknown"} MYT</dd></div><div><dt>Minimum order</dt><dd>{offer.minimumOrderKgMilli == null ? "Not supplied" : kg(offer.minimumOrderKgMilli)}</dd></div><div><dt>Supplier qualification</dt><dd>{words(supplier.status)}</dd></div></dl>
        <p>{assessment.reasonCodes.length ? reasonText(assessment.reasonCodes[0]!) : "Conditional on supplier confirmation, receipt and quality acceptance."}</p>
        <div className="pa-actions"><button type="button" aria-expanded={props.inspectedOfferId === offer.id} onClick={() => props.onInspect(offer.id)}>Inspect {offer.id}</button><button type="button" disabled={!assessment.isSelectableForConditionalPlan} aria-pressed={props.selectedOfferId === offer.id} onClick={() => props.onSelect(offer.id)}>Select {offer.id}</button></div>
      </article>;
    })}</div>}
  </section>;
}

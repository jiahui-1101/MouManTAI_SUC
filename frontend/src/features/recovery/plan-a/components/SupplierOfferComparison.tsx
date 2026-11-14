import { Button, DataPanel, SectionHeader, StatusBadge } from "../../../../components/ui";
import type { OfferAssessment, SupplierOfferCandidateInput } from "../domain";
import { kg, money, reasonText, words } from "./presentation";
export interface EvaluatedOffer { candidate: SupplierOfferCandidateInput; assessment: OfferAssessment }
export interface ComparisonProps {
  offers: EvaluatedOffer[]; supplierNames: Record<string, string>; inspectedOfferId: string | null; selectedOfferId: string | null;
  onInspect: (id: string) => void; onSelect: (id: string) => void;
}
export function SupplierOfferComparison(props: ComparisonProps) {
  return <DataPanel className="pa-panel pa-supplier-list">
    <SectionHeader title="Alternative suppliers"/>
    {props.offers.length === 0 ? <p role="status">No supplier offers available. Request a documented quote or review internal recovery.</p> : <div className="pa-offers">{props.offers.map(({ candidate, assessment }) => {
      const { offer, supplier } = candidate;
      const selected = props.selectedOfferId === offer.id;
      const inspected = props.inspectedOfferId === offer.id;
      return <article key={offer.id} className={`pa-offer ${inspected ? "pa-offer-inspected" : ""} ${selected ? "pa-offer-selected" : ""}`} aria-label={offer.id}>
        <div className="pa-card-heading"><h3 className="pa-card-title">{props.supplierNames[supplier.id] ?? supplier.id}</h3>{selected && <StatusBadge tone="info">Selected</StatusBadge>}</div>
        <p className="pa-muted">{kg(offer.quantityKgMilli)} · {offer.spec ? words(offer.spec) : "Unknown specification"}</p>
        <div className="pa-quote-line"><strong>{money(assessment.landedCostSen)} <small>landed</small></strong><span>{offer.etaLocal ?? "Unknown"} ETA</span></div>
        <StatusBadge tone={assessment.status === "INCOMPATIBLE" ? "danger" : "warning"}>{assessment.status === "QUALIFIED_CONDITIONAL" ? "Conditional" : assessment.status === "INCOMPATIBLE" ? "Incompatible" : "Needs review"}</StatusBadge>
        <p className="pa-offer-reason">{assessment.reasonCodes.length ? reasonText(assessment.reasonCodes.includes("SPEC_MISMATCH") ? "SPEC_MISMATCH" : assessment.reasonCodes[0]!) : "Requires supplier confirmation and quality acceptance."}</p>
        <div className="pa-actions"><Button variant="ghost" aria-label={`Inspect ${offer.id}`} aria-expanded={inspected} onClick={() => props.onInspect(offer.id)}>View details</Button><Button variant="secondary" disabled={!assessment.isSelectableForConditionalPlan} aria-label={`Select ${offer.id}`} aria-pressed={selected} onClick={() => props.onSelect(offer.id)}>{selected ? "Selected supplier" : "Select supplier"}</Button></div>
      </article>;
    })}</div>}
  </DataPanel>;
}

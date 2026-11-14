import type { ReactNode } from "react";
import { StatusBadge } from "../../../../components/ui";
import { Link } from "react-router-dom";
import type { RecoverySourcingNeed } from "../domain";
import type { EvaluatedOffer } from "./SupplierOfferComparison";
import { kg, money, words } from "./presentation";
import { OfferEligibilityChecklist } from "./OfferEligibilityChecklist";

export function SupplierOfferDetails({ entry, need, name, evidenceAvailable = false, children }: { entry: EvaluatedOffer; need: RecoverySourcingNeed; name: string; evidenceAvailable?: boolean; children?: ReactNode }) {
  const { candidate, assessment } = entry;
  const { offer } = candidate;
  return <section className="pa-panel fm-panel pa-supplier-detail" aria-labelledby="details-heading">
    <div className="pa-card-heading"><h2 className="pa-heading" id="details-heading">{name}</h2><StatusBadge tone={assessment.status === "INCOMPATIBLE" ? "danger" : "warning"}>{assessment.status === "QUALIFIED_CONDITIONAL" ? "Conditional" : words(assessment.status)}</StatusBadge></div>
    <p className="pa-muted">{offer.id} · {kg(offer.quantityKgMilli)} {offer.spec ? words(offer.spec) : "Unknown specification"}</p>
    <dl className="pa-offer-values">
      <div><dt>Total landed cost</dt><dd>{money(assessment.landedCostSen)}</dd></div>
      <div><dt>Required specification</dt><dd>{words(need.requiredSpecification)}</dd></div>
    </dl>
    <ol className="pa-timeline" aria-label="Delivery timeline"><li><strong>{offer.etaLocal ?? "Unknown"}</strong><span>Quoted arrival</span></li><li><strong>{assessment.deliveryWindow.expectedAcceptanceLocal ?? "Unknown"}</strong><span>Hypothetical receipt + quality check</span></li><li><strong>{need.requiredReceiptCutoffLocal}</strong><span>Prep cutoff</span></li></ol>
    {assessment.deliveryWindow.status === "MISSED_PREP_CUTOFF" && <p className="pa-notice">Arrival and receiving checks miss the prep cutoff.</p>}
    <p className="pa-muted">No verified goods receipt. Supplier confirmation and quality acceptance required.</p>
    {children}
    <details><summary>Eligibility, conditions and evidence</summary>
      <OfferEligibilityChecklist assessment={assessment}/>
      <ul className="pa-checks">{assessment.conditions.map(condition => <li key={condition.code}>{condition.description}</li>)}</ul>
      <dl className="pa-offer-values">
        <div><dt>Unit price / freight</dt><dd>{money(offer.pricePerKgSen)}/kg · {money(offer.freightSen)}</dd></div>
        <div><dt>Minimum order</dt><dd>{offer.minimumOrderKgMilli == null ? "Not supplied" : kg(offer.minimumOrderKgMilli)}</dd></div>
        <div><dt>Supplier qualification</dt><dd>{words(candidate.supplier.status)}</dd></div>
        <div><dt>Availability</dt><dd>{words(candidate.availabilityStatus)}</dd></div>
        <div><dt>Quote valid until</dt><dd>{offer.quoteValidUntilIso ?? "Not supplied — refresh before approval"}</dd></div>
        <div><dt>Food-safety evidence</dt><dd>{words(candidate.specEvidenceStatus)}</dd></div>
      </dl>
      <p className="pa-muted">Demo qualifications are fictional, not real certifications.</p>
      <p className="pa-reference">{candidate.supplier.id} · {offer.provenance ? words(offer.provenance) : "Quote source unknown"} · Evidence: {assessment.evidenceRefs.join(", ") || "Not supplied"}</p>
      <p className="pa-reference">{need.businessDate} · {need.timeZone} · {words(assessment.deliveryWindow.status)}</p>
      <p className="pa-reference">{assessment.reasonCodes.join(" · ") || "No hard constraint failures."}</p>
      {evidenceAvailable && offer.evidenceRef && <Link to={`/inbox?incidentId=${encodeURIComponent(need.incidentId)}&evidenceRef=${encodeURIComponent(offer.evidenceRef)}`}>View offer evidence</Link>}
    </details>
  </section>;
}

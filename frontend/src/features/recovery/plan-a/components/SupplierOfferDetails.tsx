import { StatusBadge } from "../../../../components/ui";
import { Link } from "react-router-dom";
import type { RecoverySourcingNeed } from "../domain";
import type { EvaluatedOffer } from "./SupplierOfferComparison";
import { kg, words } from "./presentation";
import { OfferEligibilityChecklist } from "./OfferEligibilityChecklist";

export function SupplierOfferDetails({ entry, need, name, evidenceAvailable = false }: { entry: EvaluatedOffer; need: RecoverySourcingNeed; name: string; evidenceAvailable?: boolean }) {
  const { candidate, assessment } = entry;
  const { offer } = candidate;
  return <section className="pa-panel fm-panel" aria-labelledby="details-heading">
    <span className="pa-kicker">Inspecting offer · separate from proposal selection</span><h2 className="pa-heading" id="details-heading">{name} · Offer details</h2>
    <p>{offer.id} · Required: {need.requiredSpecification} · Offered: {offer.spec ?? "Unknown"} · {kg(offer.quantityKgMilli)}</p>
    <p className="pa-muted pa-section-description">Food-safety evidence: {words(candidate.specEvidenceStatus)}. Demo approval is a fictional fixture attribute, not a real certification.</p>
    <h3 className="pa-subheading">Eligibility assessment</h3>
    <StatusBadge tone={assessment.status === "INCOMPATIBLE" ? "danger" : "warning"}>{words(assessment.status)}</StatusBadge>
    <OfferEligibilityChecklist assessment={assessment}/>
    <details><summary>Validation references</summary>{assessment.reasonCodes.length ? assessment.reasonCodes.map(code => <p key={code}>{code}</p>) : "No hard constraint failures."}</details>
    {assessment.reasonCodes.length === 0 && <p>Supplier, ingredient, product specification, evidence, quantity and cost checks support a conditional proposal.</p>}
    <ul className="pa-checks">{assessment.conditions.map(condition => <li key={condition.code}><StatusBadge tone="warning">Conditional</StatusBadge> {condition.description}</li>)}</ul>
    <p>Quote validity: {offer.quoteValidUntilIso ?? "Not supplied — refresh before approval"}</p>
    <h3 className="pa-subheading">Delivery and readiness · demo clock</h3>
    <p>{need.businessDate} · {need.timeZone} · {words(assessment.deliveryWindow.status)}</p>
    <ol className="pa-timeline" aria-label="Delivery timeline"><li><strong>{offer.etaLocal ?? "Unknown"}</strong><span>Supplier-claimed ETA</span></li><li><strong>{assessment.deliveryWindow.expectedAcceptanceLocal ?? "Unknown"}</strong><span>Hypothetical receipt and quality acceptance</span></li><li><strong>{need.requiredReceiptCutoffLocal}</strong><span>Required preparation cutoff</span></li></ol>
    <p className="pa-notice">Not yet physically received. Arrival and quality acceptance remain unverified.</p>
    {evidenceAvailable && offer.evidenceRef && <Link to={`/inbox?incidentId=${encodeURIComponent(need.incidentId)}&evidenceRef=${encodeURIComponent(offer.evidenceRef)}`}>View offer evidence</Link>}
  </section>;
}

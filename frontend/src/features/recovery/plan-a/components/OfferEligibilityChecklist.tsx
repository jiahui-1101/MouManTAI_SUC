import { StatusBadge } from "../../../../components/ui";
import type { OfferAssessment, OfferConditionCode, OfferReasonCode } from "../domain";
import { reasonText } from "./presentation";
const groups: { label: string; codes: OfferReasonCode[]; conditional?: boolean; conditions?: OfferConditionCode[] }[] = [
  { label: "Supplier qualification", codes: ["SUPPLIER_IDENTITY_UNVERIFIED", "SUPPLIER_ID_MISMATCH", "SUPPLIER_NOT_APPROVED_FOR_SOURCING", "SUPPLIER_AVAILABILITY_UNKNOWN", "SUPPLIER_DENIED"], conditions: ["SUPPLIER_CONFIRMATION_REQUIRED"] },
  { label: "Ingredient match", codes: ["INGREDIENT_MISMATCH"] },
  { label: "Product specification", codes: ["SPEC_MISMATCH", "SPECIFICATION_UNKNOWN"] },
  { label: "Product / food-safety evidence (demo only)", codes: ["SPEC_EVIDENCE_MISSING", "SPEC_EVIDENCE_UNVERIFIED", "SPEC_EVIDENCE_REJECTED", "OFFER_EVIDENCE_MISSING"], conditional: true },
  { label: "Quantity and minimum order", codes: ["INSUFFICIENT_QUANTITY", "MOQ_NOT_MET", "INVALID_OFFER_QUANTITY", "INVALID_MOQ"] },
  { label: "ETA and preparation window", codes: ["ETA_UNKNOWN", "MISSED_PREP_CUTOFF", "BUSINESS_CONTEXT_MISMATCH"], conditional: true },
  { label: "Pricing and quote validity", codes: ["MISSING_COST", "INVALID_COST", "LANDED_TOTAL_MISMATCH", "QUOTE_EXPIRED", "QUOTE_VALIDITY_UNKNOWN"], conditions: ["QUOTE_VALIDITY_NOT_PROVIDED"] },
];
const unknown = new Set<OfferReasonCode>(["SUPPLIER_IDENTITY_UNVERIFIED", "SUPPLIER_AVAILABILITY_UNKNOWN", "SPECIFICATION_UNKNOWN", "SPEC_EVIDENCE_MISSING", "SPEC_EVIDENCE_UNVERIFIED", "OFFER_EVIDENCE_MISSING", "ETA_UNKNOWN", "BUSINESS_CONTEXT_MISMATCH", "MISSING_COST", "INVALID_COST", "QUOTE_VALIDITY_UNKNOWN"]);
export function OfferEligibilityChecklist({ assessment }: { assessment: OfferAssessment }) {
  return <ul className="pa-checks" aria-label="Eligibility checks">{groups.map(group => {
    const reasons = assessment.reasonCodes.filter(code => group.codes.includes(code));
    const conditional = group.conditional || assessment.conditions.some(condition => group.conditions?.includes(condition.code));
    const status = reasons.some(code => !unknown.has(code)) ? "FAIL" : reasons.length ? "UNKNOWN" : conditional ? "CONDITIONAL" : "PASS";
    return <li key={group.label}><div className="pa-check-heading"><span>{group.label}</span><StatusBadge tone={status === "FAIL" ? "danger" : status === "PASS" ? "success" : status === "CONDITIONAL" ? "warning" : "neutral"}>{status}</StatusBadge></div>{reasons.map(code => <p key={code}>{reasonText(code)}</p>)}</li>;
  })}</ul>;
}

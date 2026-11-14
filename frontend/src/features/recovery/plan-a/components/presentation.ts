export const kg = (value: number) => `${(value / 1000).toLocaleString("en-MY", { maximumFractionDigits: 3 })}kg`;
export const money = (value: number | null | undefined) => value == null ? "Not estimable" : `RM${(value / 100).toFixed(2)}`;
export const words = (value: string) => value.replaceAll("_", " ").toLowerCase();
const explanations: Record<string, string> = {
  SPEC_MISMATCH: "Frozen chicken does not meet the chilled chicken requirement.",
  MISSED_PREP_CUTOFF: "Quoted arrival plus receiving checks misses the preparation cutoff.",
  SUPPLIER_NOT_APPROVED_FOR_SOURCING: "The contact is not an approved demo sourcing supplier.",
  SPECIFICATION_UNKNOWN: "The product specification is unknown; review is required.",
  SPEC_EVIDENCE_MISSING: "Product and food-safety evidence is missing.",
  SPEC_EVIDENCE_UNVERIFIED: "Product evidence has not been verified for the demo.",
  INSUFFICIENT_QUANTITY: "The offered quantity does not cover the forecast ingredient gap.",
  ETA_UNKNOWN: "Arrival time is unknown or ambiguous.",
  MISSING_COST: "Unit price or freight is missing; the landed cost cannot be estimated.",
  QUOTE_EXPIRED: "The quote has expired and must be refreshed.",
  SUPPLIER_IDENTITY_UNVERIFIED: "Supplier identity has not been verified.",
  SUPPLIER_DENIED: "The supplier has denied availability.",
};
export const reasonText = (code: string) => explanations[code] ?? `${words(code)} — review required.`;

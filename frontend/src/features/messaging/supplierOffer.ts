import type { EvidenceSpan } from "./mockMessageRuleExtractor";
import { CANONICAL_SUPPLIER_REGISTRY } from "./mockMessageRegistry";

/** Exact optional fixture text from the Shared MD (HP-MSG-OL-OFFER). */
export const CANONICAL_OFFER_MESSAGE =
  "Re: HP-RFQ-1042. We can offer 15kg chilled chicken at RM16/kg plus RM15 delivery, ETA 10:15 AM today, subject to confirmation.";

export interface OfferClaim {
  rfqId: "HP-RFQ-1042";
  supplierId: string | null;
  ingredientId: "HP-ING-CHICKEN";
  spec: "CHILLED";
  quantityKgMilli: number;
  pricePerKgSen: number;
  freightSen: number;
  /** Stated by the supplier; conditional, not a confirmed delivery time. */
  statedEtaLocal: string;
  conditional: true;
}

export interface OfferParseResult {
  method: "RULE_EXTRACTION" | "UNRESOLVED";
  claim: OfferClaim | null;
  evidenceSpans: readonly EvidenceSpan[];
}

const TERMS: readonly { field: string; text: string }[] = [
  { field: "rfqId", text: "HP-RFQ-1042" },
  { field: "quantityKgMilli", text: "15kg" },
  { field: "ingredientId", text: "chilled chicken" },
  { field: "pricePerKgSen", text: "RM16/kg" },
  { field: "freightSen", text: "RM15 delivery" },
  { field: "statedEtaLocal", text: "ETA 10:15 AM today" },
  { field: "conditional", text: "subject to confirmation" },
];

/** Fail-closed rule extraction: only the exact canonical offer sentence yields grounded values. */
export function parseMockSupplierOffer(input: { rawText: string; senderRegistryId: string | null }): OfferParseResult {
  if (input.rawText !== CANONICAL_OFFER_MESSAGE) return { method: "UNRESOLVED", claim: null, evidenceSpans: [] };
  const evidenceSpans = TERMS.map(({ field, text }) => {
    const start = input.rawText.indexOf(text);
    return { field, start, end: start + text.length, text };
  });
  const supplierId = input.senderRegistryId && input.senderRegistryId in CANONICAL_SUPPLIER_REGISTRY ? input.senderRegistryId : null;
  return {
    method: "RULE_EXTRACTION",
    evidenceSpans,
    claim: { rfqId: "HP-RFQ-1042", supplierId, ingredientId: "HP-ING-CHICKEN", spec: "CHILLED", quantityKgMilli: 15000, pricePerKgSen: 1600, freightSen: 1500, statedEtaLocal: "10:15", conditional: true },
  };
}

export const isOfferMessage = (rawText: string) => rawText === CANONICAL_OFFER_MESSAGE;

export type OfferQualification = "UNREVIEWED" | "QUALIFIED_CONDITIONAL" | "REJECTED" | "UNRESOLVED";

export interface OfferReviewVersion {
  id: string;
  messageId: string;
  version: number;
  method: "RULE_EXTRACTION" | "HUMAN_REVIEW";
  qualification: OfferQualification;
  decision: "EXTRACTED" | "QUALIFIED" | "REJECTED" | "MARKED_UNRESOLVED";
  actor: string;
  createdAtIso: string;
  note?: string;
}

/** Sender may be qualified only if it is an approved registry supplier other than the disrupted PO supplier. */
export function offerQualificationBlockers(senderRegistryId: string | null, parse: OfferParseResult): string[] {
  const reasons: string[] = [];
  if (parse.method !== "RULE_EXTRACTION" || !parse.claim) reasons.push("Unresolved evidence: offer text does not match the supported offer rule.");
  const entry = senderRegistryId ? CANONICAL_SUPPLIER_REGISTRY[senderRegistryId as keyof typeof CANONICAL_SUPPLIER_REGISTRY] : undefined;
  if (!entry) reasons.push("Unsafe sender identity: sender is not in the canonical supplier registry.");
  else if (entry.verification !== "APPROVED_DEMO_SUPPLIER") reasons.push(`Sender ${entry.id} is ${entry.verification}, not an approved alternative chilled supplier.`);
  return reasons;
}

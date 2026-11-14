import {
  CANONICAL_MESSAGE,
  CANONICAL_PO_REGISTRY,
  CANONICAL_SUPPLIER_REGISTRY,
  type CanonicalSupplierId,
} from "./mockMessageRegistry";

export interface EvidenceSpan {
  field: string;
  start: number;
  end: number;
  text: string;
}

export interface RuleExtraction {
  incidentType?: "UNAVAILABLE";
  poId?: "HP-PO-1042";
  ingredientId?: "HP-ING-CHICKEN";
  expectedKgMilli?: number;
  claimedDeliveryKgMilli?: number;
  shortfallKgMilli?: number;
  etaLocal?: null;
  etaStatus?: "UNKNOWN";
  method: "RULE_EXTRACTION" | "UNRESOLVED";
  reviewStatus: "PENDING" | "UNRESOLVED";
  evidenceSpans: EvidenceSpan[];
}

export interface MockMessageParseResult {
  rawText: string;
  senderRegistryId: CanonicalSupplierId | null;
  senderVerification: "VERIFIED_DEMO_CONTACT" | "UNVERIFIED_SENDER";
  poMatch: "MATCHED" | "UNRESOLVED";
  requiresHumanReview: true;
  reviewReasons: string[];
  extraction: RuleExtraction;
}

export interface ParseMockMessageInput {
  rawText: string;
  senderRegistryId: string | null;
}

interface EvidenceTerm {
  field: string;
  text: string;
  after?: string;
}

const EVIDENCE_TERMS = [
  { field: "incidentType", text: "cannot deliver" },
  { field: "poId", text: "HP-PO-1042" },
  { field: "ingredientId", text: "chilled chicken" },
  { field: "expectedKgMilli", text: "20kg" },
  { field: "claimedDeliveryKgMilli", text: "0kg", after: "Delivered quantity today will be" },
  { field: "etaStatus", text: "We will update you tomorrow" },
] as const satisfies readonly EvidenceTerm[];

function evidenceSpan(rawText: string, field: string, text: string, after?: string): EvidenceSpan {
  const searchStart = after === undefined ? 0 : rawText.indexOf(after);
  const start = searchStart < 0 ? -1 : rawText.indexOf(text, searchStart);
  if (start < 0) throw new Error(`Canonical evidence missing for ${field}`);
  return { field, start, end: start + text.length, text: rawText.slice(start, start + text.length) };
}

function isCanonicalSupplierId(senderRegistryId: string | null): senderRegistryId is CanonicalSupplierId {
  return senderRegistryId !== null && senderRegistryId in CANONICAL_SUPPLIER_REGISTRY;
}

function unresolvedResult(input: ParseMockMessageInput): MockMessageParseResult {
  const senderRegistryId = isCanonicalSupplierId(input.senderRegistryId) ? input.senderRegistryId : null;
  const senderIsKnown = senderRegistryId !== null;
  return {
    rawText: input.rawText,
    senderRegistryId,
    senderVerification: senderIsKnown ? "VERIFIED_DEMO_CONTACT" : "UNVERIFIED_SENDER",
    poMatch: "UNRESOLVED",
    requiresHumanReview: true,
    reviewReasons: [
      "Message does not match the supported canonical delivery-unavailable rule.",
      ...(senderIsKnown ? [] : ["Sender is not in the canonical demo supplier registry."]),
    ],
    extraction: {
      method: "UNRESOLVED",
      reviewStatus: "UNRESOLVED",
      evidenceSpans: [],
    },
  };
}

/**
 * Deterministic, fail-closed extraction for the shared Happy Potato fixture.
 * The raw message is returned unchanged and no delivery ETA is inferred from an update promise.
 */
export function parseMockSupplierMessage(input: ParseMockMessageInput): MockMessageParseResult {
  if (input.rawText !== CANONICAL_MESSAGE) return unresolvedResult(input);

  const senderRegistryId = isCanonicalSupplierId(input.senderRegistryId) ? input.senderRegistryId : null;
  const purchaseOrder = CANONICAL_PO_REGISTRY["HP-PO-1042"];
  const senderIsKnown = senderRegistryId === purchaseOrder.supplierId;
  const claimedDeliveryKgMilli = 0;

  return {
    rawText: input.rawText,
    senderRegistryId,
    senderVerification: senderIsKnown ? "VERIFIED_DEMO_CONTACT" : "UNVERIFIED_SENDER",
    poMatch: "MATCHED",
    requiresHumanReview: true,
    reviewReasons: senderIsKnown
      ? ["Rule extraction is pending explicit human confirmation."]
      : ["Sender is not in the canonical demo supplier registry and cannot auto-verify."],
    extraction: {
      incidentType: "UNAVAILABLE",
      poId: purchaseOrder.id,
      ingredientId: purchaseOrder.ingredientId,
      expectedKgMilli: purchaseOrder.expectedKgMilli,
      claimedDeliveryKgMilli,
      shortfallKgMilli: purchaseOrder.expectedKgMilli - claimedDeliveryKgMilli,
      etaLocal: null,
      etaStatus: "UNKNOWN",
      method: "RULE_EXTRACTION",
      reviewStatus: "PENDING",
      evidenceSpans: (EVIDENCE_TERMS as readonly EvidenceTerm[]).map(({ field, text, after }) =>
        evidenceSpan(input.rawText, field, text, after),
      ),
    },
  };
}


import { CANONICAL_PO_REGISTRY, CANONICAL_SUPPLIER_REGISTRY } from "./mockMessageRegistry";
import { parseMockSupplierMessage, type EvidenceSpan } from "./mockMessageRuleExtractor";

/** Candidate incident kinds a reviewer may choose (subset of shared IncidentKind). */
export const REVIEW_INCIDENT_TYPES = ["UNAVAILABLE", "PARTIAL_DELIVERY", "DELAY"] as const;
export type ReviewIncidentType = (typeof REVIEW_INCIDENT_TYPES)[number];
export type QuantityUnit = "kg" | "g" | "L";
export const QUANTITY_UNITS: readonly QuantityUnit[] = ["kg", "g", "L"];

export type CandidateField =
  | "supplierId"
  | "poId"
  | "incidentType"
  | "expectedKgMilli"
  | "claimedDeliveryKgMilli"
  | "etaStatus"
  | "etaLocal";

export interface CandidateValues {
  supplierId: string | null;
  poId: string | null;
  incidentType: ReviewIncidentType | null;
  expectedKgMilli: number | null;
  claimedDeliveryKgMilli: number | null;
  etaStatus: "UNKNOWN" | "KNOWN";
  etaLocal: string | null;
}

export type ExtractionMethod = "RULE_EXTRACTION" | "HUMAN_CORRECTION" | "UNRESOLVED";
export type ReviewStatus = "PENDING" | "VERIFIED" | "REJECTED" | "UNRESOLVED";

export interface FieldChange {
  field: CandidateField;
  from: string | number | null;
  to: string | number | null;
}

/** Immutable extraction version (shared MessageExtraction contract + review provenance). */
export interface ExtractionVersion {
  id: string;
  messageId: string;
  version: number;
  method: ExtractionMethod;
  reviewStatus: ReviewStatus;
  values: CandidateValues;
  shortfallKgMilli: number | null;
  /** Spans always index into the untouched raw message text. */
  evidenceSpans: readonly EvidenceSpan[];
  /** Fields whose value was asserted by a human without a supporting raw-text span. */
  humanAssertedFields: readonly CandidateField[];
  changedFields: readonly FieldChange[];
  actor: string;
  createdAtIso: string;
  decision: "EXTRACTED" | "CORRECTED" | "CONFIRMED" | "REJECTED" | "MARKED_UNRESOLVED";
  note?: string;
}

export const DEMO_REVIEW_ACTOR = "Demo operator (demo-reviewer-01)";
export const RULE_ENGINE_ACTOR = "Rule engine (RULE_EXTRACTION)";
export const RECEIVED_PLACEHOLDER_ISO = "2026-11-21T09:00:00+08:00";

interface MessageLike {
  id: string;
  rawText: string;
  senderRegistryId: string | null;
  receivedAtIso?: string;
}

/** Version 1 is derived deterministically from the rule extractor and never stored mutably. */
export function ruleExtractionVersion(message: MessageLike): ExtractionVersion {
  const parsed = parseMockSupplierMessage({ rawText: message.rawText, senderRegistryId: message.senderRegistryId });
  const x = parsed.extraction;
  const values: CandidateValues = {
    supplierId: x.poId ? (CANONICAL_PO_REGISTRY[x.poId]?.supplierId ?? null) : null,
    poId: x.poId ?? null,
    incidentType: x.incidentType ?? null,
    expectedKgMilli: x.expectedKgMilli ?? null,
    claimedDeliveryKgMilli: x.claimedDeliveryKgMilli ?? null,
    etaStatus: "UNKNOWN",
    etaLocal: null,
  };
  return {
    id: `${message.id}-EXT-v1`,
    messageId: message.id,
    version: 1,
    method: x.method,
    reviewStatus: x.reviewStatus,
    values,
    shortfallKgMilli: x.shortfallKgMilli ?? null,
    evidenceSpans: x.evidenceSpans,
    humanAssertedFields: [],
    changedFields: [],
    actor: RULE_ENGINE_ACTOR,
    createdAtIso: message.receivedAtIso ?? RECEIVED_PLACEHOLDER_ISO,
    decision: "EXTRACTED",
  };
}

export function shortfallOf(values: CandidateValues): number | null {
  if (values.expectedKgMilli === null || values.claimedDeliveryKgMilli === null) return null;
  return values.expectedKgMilli - values.claimedDeliveryKgMilli;
}

export const CANDIDATE_FIELDS: readonly CandidateField[] = [
  "supplierId", "poId", "incidentType", "expectedKgMilli", "claimedDeliveryKgMilli", "etaStatus", "etaLocal",
];

export function diffValues(prev: CandidateValues, next: CandidateValues): FieldChange[] {
  return CANDIDATE_FIELDS.filter((f) => prev[f] !== next[f]).map((f) => ({ field: f, from: prev[f], to: next[f] }));
}

/** Form draft: free text, validated before becoming candidate values. */
export interface ReviewDraft {
  supplierId: string;
  poId: string;
  incidentType: string;
  expectedQty: string;
  expectedUnit: QuantityUnit;
  claimedQty: string;
  claimedUnit: QuantityUnit;
  etaStatus: "UNKNOWN" | "KNOWN";
  etaLocal: string;
}

export function draftFromValues(v: CandidateValues): ReviewDraft {
  const qty = (n: number | null) => (n === null ? "" : (n / 1000).toFixed(3));
  return {
    supplierId: v.supplierId ?? "",
    poId: v.poId ?? "",
    incidentType: v.incidentType ?? "",
    expectedQty: qty(v.expectedKgMilli),
    expectedUnit: "kg",
    claimedQty: qty(v.claimedDeliveryKgMilli),
    claimedUnit: "kg",
    etaStatus: v.etaStatus,
    etaLocal: v.etaLocal ?? "",
  };
}

export type DraftErrors = Partial<Record<keyof ReviewDraft | "form", string>>;

function parseQuantity(raw: string, unit: QuantityUnit, label: string, errors: DraftErrors, key: keyof ReviewDraft, unitKey: keyof ReviewDraft): number | null {
  const text = raw.trim();
  if (text === "") return null;
  if (!/^\d+(\.\d+)?$/.test(text)) {
    errors[key] = `${label} must be a nonnegative number.`;
    return null;
  }
  if (unit === "L") {
    errors[unitKey] = `${label}: unit L is not compatible with HP-ING-CHICKEN, which is measured in kg.`;
    return null;
  }
  const exact = unit === "g" ? Number(text) : Number(text) * 1000;
  const kgMilli = Math.round(exact);
  if (Math.abs(exact - kgMilli) > 1e-6) {
    errors[key] = `${label} must be precise to at most 1 g (0.001 kg).`;
    return null;
  }
  return kgMilli;
}

/** Validates a draft against canonical registries. Returns values only when there are no errors. */
export function validateDraft(draft: ReviewDraft): { values?: CandidateValues; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const supplierId = draft.supplierId.trim() || null;
  const poId = draft.poId.trim() || null;
  if (supplierId && !(supplierId in CANONICAL_SUPPLIER_REGISTRY)) errors.supplierId = `Supplier ${supplierId} is not in the canonical demo registry.`;
  if (poId && !(poId in CANONICAL_PO_REGISTRY)) errors.poId = `PO ${poId} is not in the canonical PO registry.`;
  const po = poId ? CANONICAL_PO_REGISTRY[poId as keyof typeof CANONICAL_PO_REGISTRY] : undefined;
  if (po && supplierId && !errors.supplierId && po.supplierId !== supplierId) {
    errors.poId = `${poId} belongs to ${po.supplierId}, not ${supplierId}.`;
  }
  const incidentType = draft.incidentType ? (draft.incidentType as ReviewIncidentType) : null;
  if (incidentType && !REVIEW_INCIDENT_TYPES.includes(incidentType)) errors.incidentType = "Choose a supported incident type.";
  const expected = parseQuantity(draft.expectedQty, draft.expectedUnit, "Expected quantity", errors, "expectedQty", "expectedUnit");
  const claimed = parseQuantity(draft.claimedQty, draft.claimedUnit, "Delivered claim", errors, "claimedQty", "claimedUnit");
  if (po && expected !== null && expected !== po.expectedKgMilli) {
    errors.expectedQty = `Expected quantity must match ${po.id} (${(po.expectedKgMilli / 1000).toFixed(3)} kg).`;
  }
  if (expected !== null && claimed !== null && claimed > expected) {
    errors.claimedQty = "Delivered claim cannot exceed the expected PO quantity.";
  }
  if (incidentType === "UNAVAILABLE" && claimed !== null && claimed > 0) {
    errors.incidentType = "Contradiction: UNAVAILABLE requires a 0 kg delivered claim.";
  }
  if (incidentType === "PARTIAL_DELIVERY" && claimed !== null && expected !== null && (claimed === 0 || claimed >= expected)) {
    errors.incidentType = "Contradiction: PARTIAL_DELIVERY requires a delivered claim between 0 and the expected quantity.";
  }
  let etaLocal: string | null = null;
  if (draft.etaStatus === "KNOWN") {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.etaLocal) || Number.isNaN(Date.parse(draft.etaLocal))) {
      errors.etaLocal = "A known ETA needs a valid local date and time (MYT).";
    } else etaLocal = draft.etaLocal;
  }
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    values: { supplierId, poId, incidentType, expectedKgMilli: expected, claimedDeliveryKgMilli: claimed, etaStatus: draft.etaStatus, etaLocal },
  };
}

const FIELD_SPAN: Partial<Record<CandidateField, string>> = {
  poId: "poId",
  incidentType: "incidentType",
  expectedKgMilli: "expectedKgMilli",
  claimedDeliveryKgMilli: "claimedDeliveryKgMilli",
  etaStatus: "etaStatus",
};

/** Builds the next immutable HUMAN_CORRECTION version. Changed fields lose source spans and become human assertions. */
export function buildCorrectionVersion(prev: ExtractionVersion, values: CandidateValues, at: string, actor = DEMO_REVIEW_ACTOR, note?: string): ExtractionVersion {
  const changedFields = diffValues(prev.values, values);
  const reopening = prev.reviewStatus === "REJECTED" || prev.reviewStatus === "UNRESOLVED";
  if (!changedFields.length && !reopening) throw new Error("No changed fields to save");
  const changed = new Set(changedFields.map((c) => c.field));
  const droppedSpanFields = new Set([...changed].map((f) => FIELD_SPAN[f]).filter(Boolean));
  if (changed.has("expectedKgMilli") || changed.has("claimedDeliveryKgMilli")) droppedSpanFields.add("ingredientId");
  const evidenceSpans = prev.evidenceSpans.filter((s) => !droppedSpanFields.has(s.field));
  const humanAssertedFields = [...new Set([...prev.humanAssertedFields, ...changed])].filter((f) => {
    // A field reverted to the original rule value with a surviving span is no longer a bare assertion.
    const span = FIELD_SPAN[f];
    return !(span && evidenceSpans.some((s) => s.field === span));
  });
  return {
    id: `${prev.messageId}-EXT-v${prev.version + 1}`,
    messageId: prev.messageId,
    version: prev.version + 1,
    method: "HUMAN_CORRECTION",
    reviewStatus: "PENDING",
    values,
    shortfallKgMilli: shortfallOf(values),
    evidenceSpans,
    humanAssertedFields,
    changedFields,
    actor,
    createdAtIso: at,
    decision: "CORRECTED",
    note,
  };
}

export function buildDecisionVersion(prev: ExtractionVersion, decision: "CONFIRMED" | "REJECTED" | "MARKED_UNRESOLVED", at: string, actor = DEMO_REVIEW_ACTOR, note?: string): ExtractionVersion {
  return {
    ...prev,
    id: `${prev.messageId}-EXT-v${prev.version + 1}`,
    version: prev.version + 1,
    reviewStatus: decision === "CONFIRMED" ? "VERIFIED" : decision === "REJECTED" ? "REJECTED" : "UNRESOLVED",
    changedFields: [],
    actor,
    createdAtIso: at,
    decision,
    note,
  };
}

export interface SafetyContext {
  senderRegistryId: string | null;
  canonicalIncidentShortfallKgMilli: number;
  incidentPoId: string;
}

/** Precise reasons why confirmation must stay disabled. Empty array means safe. */
export function confirmBlockers(version: ExtractionVersion, ctx: SafetyContext): string[] {
  const reasons: string[] = [];
  const po = version.values.poId ? CANONICAL_PO_REGISTRY[version.values.poId as keyof typeof CANONICAL_PO_REGISTRY] : undefined;
  const senderVerified = ctx.senderRegistryId !== null && po !== undefined && ctx.senderRegistryId === po.supplierId;
  if (ctx.senderRegistryId === null || !(ctx.senderRegistryId in CANONICAL_SUPPLIER_REGISTRY)) {
    reasons.push("Unsafe sender identity: the sender is not a verified demo contact. Editing the supplier field cannot verify who sent this message.");
  } else if (po && !senderVerified) {
    reasons.push(`Unsafe sender identity: sender ${ctx.senderRegistryId} is not the supplier for ${po.id}.`);
  }
  if (version.values.supplierId && ctx.senderRegistryId && version.values.supplierId !== ctx.senderRegistryId) {
    reasons.push(`Candidate supplier ${version.values.supplierId} differs from the actual sender ${ctx.senderRegistryId}; a field edit cannot override sender identity.`);
  }
  if (!po) reasons.push("Unmatched PO: no canonical purchase order is matched.");
  else if (po.id !== ctx.incidentPoId) reasons.push(`PO ${po.id} is not the PO for the active incident.`);
  if (version.method === "UNRESOLVED" || version.evidenceSpans.length === 0) {
    reasons.push("Unresolved evidence: no raw-text evidence supports this extraction.");
  }
  if (version.reviewStatus === "REJECTED" || version.reviewStatus === "UNRESOLVED") {
    reasons.push(`Latest review decision is ${version.reviewStatus}; save a correction (it may keep the same values) to reopen review before confirming.`);
  }
  if (version.reviewStatus === "VERIFIED") reasons.push("This message is already confirmed.");
  if (version.values.incidentType === null || version.values.claimedDeliveryKgMilli === null || version.values.expectedKgMilli === null) {
    reasons.push("Unresolved evidence: incident type and quantities are required.");
  } else if (version.shortfallKgMilli !== ctx.canonicalIncidentShortfallKgMilli) {
    reasons.push(`Contradictory data: shortfall ${((version.shortfallKgMilli ?? 0) / 1000).toFixed(3)} kg conflicts with incident shortfall ${(ctx.canonicalIncidentShortfallKgMilli / 1000).toFixed(3)} kg.`);
  }
  return reasons;
}

/**
 * P1 evidence producer API (read-only) for P3 and P5.
 * All values are derived from the single shared DemoState; nothing here mutates state.
 * Evidence is NOT approval authorization, receipt proof, confirmed procurement or outcome SUCCESS.
 */
import { fingerprint, selectExtractionVersions, selectOfferReviewVersions, type DemoState, type InboxMessage } from "../../store/demoStore";
import type { EvidenceSpan } from "./mockMessageRuleExtractor";
import type { ExtractionVersion } from "./messageReview";
import { parseMockSupplierOffer, type OfferClaim, type OfferQualification, type OfferReviewVersion } from "./supplierOffer";

export const EVIDENCE_LIMITS = Object.freeze({
  isApprovalAuthorization: false,
  isReceiptProof: false,
  isOutcomeSuccess: false,
  isConfirmedProcurement: false,
  isCompletedSupplierAction: false,
} as const);
export type EvidenceLimits = typeof EVIDENCE_LIMITS;

export interface RawMessageRef {
  messageId: string;
  channel: InboxMessage["channel"];
  provenance: "SIMULATED_CHANNEL";
  channelAccountId: string;
  providerMessageId: string;
  receivedAtIso: string;
  senderRegistryId: string | null;
  /** fnv1a32 of the exact raw text; recompute to prove immutability. */
  contentHash: string;
  rawText: string;
}

export interface MessageEvidence {
  evidenceRef: string;
  kind: InboxMessage["kind"];
  raw: RawMessageRef;
  verification: InboxMessage["verification"];
  extractionVersions: readonly ExtractionVersion[];
  offerReviewVersions: readonly OfferReviewVersion[];
  incidentLink: { incidentId: string; linkedAtIso: string; linkedBy: string } | null;
  limits: EvidenceLimits;
}

export interface IncidentEvidence {
  incidentId: string;
  status: DemoState["incident"]["status"];
  poId: string;
  ingredientId: string;
  snapshotId: string;
  claimedShortfallKgMilli: number;
  messages: readonly MessageEvidence[];
  limits: EvidenceLimits;
}

export interface SupplierOfferEvidence {
  evidenceRef: string;
  messageId: string;
  raw: RawMessageRef;
  claim: OfferClaim;
  evidenceSpans: readonly EvidenceSpan[];
  qualification: OfferQualification;
  reviewVersions: readonly OfferReviewVersion[];
  /** Canonical SYNTHETIC_BUSINESS offer whose values equal this claim, if any. The business offer is never modified. */
  matchesCanonicalOfferId: string | null;
  status: "OFFER_CLAIM";
  limits: EvidenceLimits;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function rawRef(m: InboxMessage): RawMessageRef {
  return {
    messageId: m.id, channel: m.channel, provenance: m.provenance, channelAccountId: m.channelAccountId,
    providerMessageId: m.providerMessageId, receivedAtIso: m.receivedAtIso, senderRegistryId: m.senderRegistryId,
    contentHash: fingerprint(m.rawText), rawText: m.rawText,
  };
}

export function selectMessageEvidence(state: DemoState, messageId: string): MessageEvidence | null {
  const m = state.messages.find((x) => x.id === messageId);
  if (!m) return null;
  const versions = m.kind === "DISRUPTION_REPORT" ? selectExtractionVersions(state, m.id) : [];
  const confirmed = versions.find((v) => v.decision === "CONFIRMED");
  const linked = state.incident.messageIds.includes(m.id);
  const latest = m.kind === "DISRUPTION_REPORT" ? versions.at(-1)?.id : selectOfferReviewVersions(state, m.id).at(-1)?.id;
  return deepFreeze({
    evidenceRef: `${m.id}#${latest ?? "v1"}`,
    kind: m.kind,
    raw: rawRef(m),
    verification: m.verification,
    extractionVersions: versions,
    offerReviewVersions: selectOfferReviewVersions(state, m.id),
    incidentLink: linked && confirmed ? { incidentId: state.incident.id, linkedAtIso: confirmed.createdAtIso, linkedBy: confirmed.actor } : null,
    limits: EVIDENCE_LIMITS,
  });
}

export function selectIncidentEvidence(state: DemoState, incidentId: string): IncidentEvidence | null {
  const i = state.incident;
  if (i.id !== incidentId) return null;
  return deepFreeze({
    incidentId: i.id, status: i.status, poId: i.poId, ingredientId: i.ingredientId, snapshotId: i.snapshotId,
    claimedShortfallKgMilli: i.claimedShortfallKgMilli,
    messages: i.messageIds.map((id) => selectMessageEvidence(state, id)).filter((x): x is MessageEvidence => x !== null),
    limits: EVIDENCE_LIMITS,
  });
}

/** P3 consumer API: grounded supplier-offer claims from simulated messages. */
export function selectSupplierOfferEvidence(state: DemoState): readonly SupplierOfferEvidence[] {
  return deepFreeze(state.messages.filter((m) => m.kind === "SUPPLIER_OFFER").flatMap((m): SupplierOfferEvidence[] => {
    const parsed = parseMockSupplierOffer(m);
    if (!parsed.claim) return [];
    const c = parsed.claim;
    const match = state.business.supplierOffers.find((o) =>
      o.supplierId === c.supplierId && o.ingredientId === c.ingredientId && o.quantityKgMilli === c.quantityKgMilli &&
      o.pricePerKgSen === c.pricePerKgSen && o.freightSen === c.freightSen && o.etaLocal === c.statedEtaLocal && o.spec === c.spec);
    const reviewVersions = selectOfferReviewVersions(state, m.id);
    return [{
      evidenceRef: `${m.id}#${reviewVersions.at(-1)!.id}`, messageId: m.id, raw: rawRef(m), claim: { ...c },
      evidenceSpans: parsed.evidenceSpans, qualification: m.offerQualification ?? "UNREVIEWED", reviewVersions,
      matchesCanonicalOfferId: match?.id ?? null, status: "OFFER_CLAIM", limits: EVIDENCE_LIMITS,
    }];
  }));
}

import { assessOffer, buildPlanAScenario, deriveRecoverySourcingNeed } from "../domain";
import { kg, money } from "../components/presentation";
import type { DraftInput, DraftResult, InternalPoInput, PlanADraft } from "./types";
export type * from "./types";

function prepare(input: DraftInput) {
  if (!input?.source || !input.candidate?.offer || !input.candidate.supplier) {
    return { ok: false as const, error: { code: "MISSING_INPUT", message: "A verified incident, current snapshot and selected supplier offer are required." } };
  }
  const need = deriveRecoverySourcingNeed(input.source);
  if (!need.ok) return need;
  const assessment = assessOffer({ candidate: input.candidate, need: need.value, businessClock: input.source.businessClock });
  if (assessment.reasonCodes.includes("INVALID_COST")) {
    return { ok: false as const, error: { code: "INVALID_COST", message: "Correct invalid or unsafe quoted amounts before generating a draft." } };
  }
  if (input.candidate.supplier.status !== "APPROVED_DEMO_SUPPLIER" || assessment.status === "INCOMPATIBLE") {
    return { ok: false as const, error: { code: "OFFER_NOT_ELIGIBLE", message: "Select a qualified demo supplier whose offer meets the hard product, quantity and delivery constraints.", reasons: assessment.reasonCodes } };
  }
  if (input.contactAuthorization !== "UNKNOWN" && input.contactAuthorization !== "AUTHORIZED_DEMO_CONTACT") {
    return { ok: false as const, error: { code: "CONTACT_STATUS_UNKNOWN", message: "Supply an explicit contact authorization status; no supplier contact is inferred." } };
  }
  return { ok: true as const, need: need.value, assessment };
}

export function createRfqDraft(input: DraftInput): DraftResult {
  const prepared = prepare(input);
  if (!prepared.ok) return prepared;
  const { need, assessment } = prepared;
  const offer = input.candidate.offer;
  const reviewRequirements = [
    ...(input.contactAuthorization === "UNKNOWN" ? ["Supplier contact authorization is unknown. Confirm an authorized demo contact before any future communication."] : []),
    ...assessment.reasonCodes.map(code => `Unresolved quote information: ${code}`),
    ...assessment.conditions.map(condition => condition.description),
  ];
  const id = `demo:rfq:${encodeURIComponent(need.incidentId)}:${encodeURIComponent(offer.id)}:${encodeURIComponent(need.snapshotFingerprint)}:r${need.snapshotRevision}`;
  const text = [
    "DEMO ONLY — UNSENT RFQ DRAFT — NOT AN ORDER",
    `Local reference: ${id} (internal demo reference; not a provider message ID)`,
    `To: ${input.supplierName ?? offer.supplierId} (${offer.supplierId}); contact authorization: ${input.contactAuthorization}`,
    `Incident: ${need.incidentId}; original disrupted PO: ${need.poId}; source offer: ${offer.id}`,
    `Please confirm availability of ${kg(offer.quantityKgMilli)} ${need.requiredSpecification} chicken (${need.ingredientId}).`,
    `Quoted unit price: ${money(offer.pricePerKgSen)}/kg. Please confirm MYR/kg pricing.`,
    `Freight: ${money(offer.freightSen)}. Please confirm delivery charges.`,
    `MOQ: ${offer.minimumOrderKgMilli == null ? "Unknown — please confirm minimum delivery/order quantity" : kg(offer.minimumOrderKgMilli)}.`,
    `Earliest arrival: ${offer.etaLocal ?? "Unknown — please confirm"} MYT (supplier claim). Please confirm earliest delivery.`,
    `Required acceptance before ${need.requiredReceiptCutoffLocal} MYT on ${need.businessDate}; allow ${need.receivingBufferMinutes} minutes for receiving and quality checks. Can delivery satisfy this cutoff?`,
    `Quote validity: ${offer.quoteValidUntilIso ?? "Unknown — please confirm expiry"}.`,
    `Please confirm chilled storage/handling requirements and provide relevant product evidence for review. No real certification is asserted.`,
    `Snapshot: ${need.snapshotFingerprint}; revision ${need.snapshotRevision}.`,
    ...reviewRequirements,
    "Synthetic business data. NOT_SENT / NOT_APPROVED. No stock, supplier verification or confirmed orders are changed.",
  ].join("\n");
  return { ok: true, value: {
    id, type: "RFQ_DRAFT", status: reviewRequirements.length ? "NEEDS_REVIEW" : "DRAFT", simulated: true,
    approval: "NOT_APPROVED", transmission: "NOT_SENT", incidentId: need.incidentId, originalPoId: need.poId,
    supplierId: offer.supplierId, offerId: offer.id, snapshotFingerprint: need.snapshotFingerprint, snapshotRevision: need.snapshotRevision,
    quantityKgMilli: offer.quantityKgMilli, pricePerKgSen: offer.pricePerKgSen ?? null, freightSen: offer.freightSen ?? null,
    landedCostSen: assessment.landedCostSen, reviewRequirements, evidenceRefs: [...new Set([...need.evidenceRefs, ...assessment.evidenceRefs])], text,
  } };
}

export function createInternalPoDraft(input: InternalPoInput): DraftResult {
  const prepared = prepare(input);
  if (!prepared.ok) return prepared;
  if (!input.scenarioIsCurrent || !input.proposal || !input.scenarioMetadata) {
    return { ok: false, error: { code: "STALE_SCENARIO", message: "Generate a current Plan A preview before creating an internal PO draft." } };
  }
  const fresh = buildPlanAScenario({ sourcingNeed: prepared.need, candidateOffers: [input.candidate], selectedOfferId: input.candidate.offer.id,
    currentSnapshotFingerprint: input.source.snapshot.fingerprint, currentSnapshotRevision: input.source.snapshot.revision,
    businessClock: input.source.businessClock, scenarioMetadata: input.scenarioMetadata });
  if (!fresh.ok) return fresh;
  if (JSON.stringify(fresh.value) !== JSON.stringify(input.proposal)) {
    return { ok: false, error: { code: "STALE_SCENARIO", message: "The proposal no longer matches the current quote and snapshot. Regenerate it before drafting." } };
  }
  const rfq = createRfqDraft(input);
  if (!rfq.ok) return rfq;
  const offer = input.candidate.offer;
  const proposal = fresh.value;
  const id = `demo:po:${encodeURIComponent(prepared.need.incidentId)}:${encodeURIComponent(offer.id)}:${encodeURIComponent(proposal.snapshotFingerprint)}:r${prepared.need.snapshotRevision}:v${proposal.version}`;
  const reviewRequirements = [...new Set([...rfq.value.reviewRequirements, "Manager decision and approval are required through P5 before any simulated execution.", ...proposal.conditions.map(condition => condition.description)])];
  const text = [
    "DEMO ONLY — INTERNAL PO DRAFT — NOT_APPROVED / NOT_SENT",
    `Replacement draft reference: ${id} (local demo ID; not an issued supplier PO)`,
    `Original incident: ${prepared.need.incidentId}; original disrupted PO reference: ${prepared.need.poId}`,
    `Replacement supplier: ${input.supplierName ?? offer.supplierId} (${offer.supplierId}); source offer: ${offer.id}`,
    `Ingredient: ${prepared.need.ingredientId}; required specification: ${prepared.need.requiredSpecification}; offered: ${offer.spec}`,
    `Proposed quantity: ${kg(offer.quantityKgMilli)}; unit: kg; unit price: ${money(offer.pricePerKgSen)}/kg`,
    `Freight: ${money(offer.freightSen)}; total additional landed cost: ${money(proposal.additionalCostSen)}`,
    `ETA: ${offer.etaLocal} MYT (supplier claim); hypothetical quality acceptance: ${prepared.assessment.deliveryWindow.expectedAcceptanceLocal} MYT; preparation cutoff: ${prepared.need.requiredReceiptCutoffLocal} MYT.`,
    `Scenario: ${proposal.id}; version ${proposal.version}; snapshot ${proposal.snapshotFingerprint}; revision ${prepared.need.snapshotRevision}.`,
    `Evidence: ${proposal.evidenceRefs.join(", ")}`,
    ...reviewRequirements, ...proposal.assumptions,
    "Synthetic business data / simulated local draft. No purchase, approval, inventory write or verified receipt has occurred.",
  ].join("\n");
  const value: PlanADraft = { ...rfq.value, id, type: "INTERNAL_PO_DRAFT", status: "NEEDS_REVIEW", scenarioId: proposal.id, scenarioVersion: proposal.version,
    landedCostSen: proposal.additionalCostSen, evidenceRefs: [...proposal.evidenceRefs], reviewRequirements, text };
  return { ok: true, value };
}

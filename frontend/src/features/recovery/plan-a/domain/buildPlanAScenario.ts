import { assessOffer } from "./assessOffer";
import type {
  BuildPlanAScenarioInput,
  DomainFailureCode,
  DomainResult,
  OfferAssessment,
  PlanAScenarioCandidate,
  SupplierOfferCandidateInput,
} from "./types";

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

function failure<T>(code: DomainFailureCode, message: string, details?: string[]): DomainResult<T> {
  return { ok: false, error: { code, message, ...(details ? { details } : {}) } };
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function safeSum(left: number, right: number): number | null {
  const sum = BigInt(left) + BigInt(right);
  return sum > MAX_SAFE ? null : Number(sum);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isCandidate(value: SupplierOfferCandidateInput | null | undefined): value is SupplierOfferCandidateInput {
  return Boolean(value && typeof value === "object" && value.offer && value.supplier);
}

function selectedAssessmentReason(assessment: OfferAssessment): string[] {
  return assessment.reasonCodes.length > 0 ? assessment.reasonCodes : [assessment.status];
}

function formatKgMilli(value: number): string {
  const whole = Math.floor(value / 1_000);
  const fraction = (value % 1_000).toString().padStart(3, "0");
  return `${whole}.${fraction}kg`;
}

export function buildPlanAScenario(input: BuildPlanAScenarioInput): DomainResult<PlanAScenarioCandidate> {
  if (!input || !input.sourcingNeed || !input.businessClock || !input.scenarioMetadata || !Array.isArray(input.candidateOffers)) {
    return failure("INVALID_INPUT", "A derived sourcing need, supplier candidates, business clock, and caller scenario metadata are required.");
  }

  const { sourcingNeed: need, scenarioMetadata: metadata } = input;
  if (typeof input.currentSnapshotFingerprint !== "string" || input.currentSnapshotFingerprint.trim().length === 0 ||
      typeof need.snapshotFingerprint !== "string" || need.snapshotFingerprint.trim().length === 0) {
    return failure("SNAPSHOT_FINGERPRINT_MISSING", "Scenario generation requires the caller's current snapshot fingerprint.");
  }
  if (input.currentSnapshotFingerprint !== need.snapshotFingerprint || input.currentSnapshotRevision !== need.snapshotRevision) {
    return failure("SNAPSHOT_MISMATCH", "The sourcing need is stale; its fingerprint and revision must match the current operational snapshot.");
  }
  if (need.readinessStatus !== "READY" || !need.incidentId || !need.ingredientId ||
      !isSafeNonNegativeInteger(need.acceptedOnHandKgMilli) ||
      !isSafeNonNegativeInteger(need.forecastRequirementKgMilli) ||
      !isSafeNonNegativeInteger(need.forecastGapKgMilli) ||
      !isSafeNonNegativeInteger(need.forecastChickenPortions) ||
      !isSafeNonNegativeInteger(need.confirmedChickenPortions) ||
      !Number.isSafeInteger(need.snapshotRevision) || need.snapshotRevision < 1) {
    return failure("INVALID_INPUT", "The supplied sourcing need is incomplete or contains invalid integer quantities.");
  }
  if (need.businessDate !== input.businessClock.businessDate || need.timeZone !== input.businessClock.timeZone ||
      need.requiredReceiptCutoffLocal !== input.businessClock.requiredReceiptCutoffLocal ||
      need.receivingBufferMinutes !== input.businessClock.receivingBufferMinutes) {
    return failure("INVALID_INPUT", "The business clock does not match the verified sourcing need context.");
  }
  if (typeof metadata.scenarioId !== "string" || metadata.scenarioId.trim().length === 0 ||
      !Number.isSafeInteger(metadata.version) || metadata.version < 1 ||
      !Array.isArray(metadata.evidenceRefs) || !metadata.evidenceRefs.every((ref) => typeof ref === "string" && ref.trim().length > 0) ||
      !Array.isArray(metadata.actionIds) || !metadata.actionIds.every((id) => typeof id === "string" && id.trim().length > 0) ||
      (metadata.capacityStatus !== "UNKNOWN" && metadata.capacityStatus !== "INSUFFICIENT")) {
    return failure("SCENARIO_METADATA_MISSING", "A caller-supplied scenario ID, positive version, valid evidence/action references, and capacity status are required.");
  }
  if (metadata.capacityStatus === "INSUFFICIENT") {
    return failure("KITCHEN_CAPACITY_INSUFFICIENT", "Known kitchen capacity is insufficient; P3 will not generate a producible-looking Plan A candidate.");
  }
  if (input.candidateOffers.length === 0) {
    return failure("NO_SUPPLIER_OFFERS", "No supplier offers were supplied; Plan A cannot invent a replacement quote.");
  }
  if (!input.candidateOffers.every(isCandidate)) {
    return failure("INVALID_INPUT", "Every supplier offer must include its offer, supplier registry state, specification evidence, and availability state.");
  }

  const offerIds = input.candidateOffers.map(({ offer }) => offer.id);
  if (offerIds.some((id) => typeof id !== "string" || id.trim().length === 0) || new Set(offerIds).size !== offerIds.length) {
    return failure("INVALID_INPUT", "Supplier offer IDs must be present and unique before a scenario can reference one.");
  }

  const assessed = input.candidateOffers.map((candidate) => ({
    candidate,
    assessment: assessOffer({ candidate, need, businessClock: input.businessClock }),
  }));
  const eligible = assessed.filter(({ assessment }) => assessment.isSelectableForConditionalPlan);

  if (input.selectedOfferId === null) {
    if (eligible.length === 0) {
      return failure("NO_ELIGIBLE_OFFERS", "No supplied offer satisfies the hard supplier, product, quantity, evidence, quote, cost, and delivery constraints.");
    }
    return failure("OFFER_SELECTION_REQUIRED", "Select a specific conditionally eligible supplier offer; P3 does not auto-select or price-rank offers.");
  }

  const selected = assessed.find(({ candidate }) => candidate.offer.id === input.selectedOfferId);
  if (!selected) {
    return failure("OFFER_NOT_ELIGIBLE", "The selected offer is not present in the current supplier candidates.", [input.selectedOfferId]);
  }
  if (selected.assessment.reasonCodes.includes("INSUFFICIENT_QUANTITY")) {
    return failure("NEEDS_RECALCULATION", "The selected quote is smaller than the current forecast ingredient gap; revise the plan before claiming full forecast coverage.", selectedAssessmentReason(selected.assessment));
  }
  if (!selected.assessment.isSelectableForConditionalPlan) {
    return failure("OFFER_NOT_ELIGIBLE", "The selected supplier offer fails one or more hard or unresolved eligibility checks.", selectedAssessmentReason(selected.assessment));
  }
  if (selected.assessment.landedCostSen === null) {
    return failure("OFFER_NOT_ELIGIBLE", "The selected offer has no safely normalized landed cost and cannot produce a Plan A scenario.", selectedAssessmentReason(selected.assessment));
  }

  const incoming = selected.candidate.offer.quantityKgMilli;
  const projected = safeSum(need.acceptedOnHandKgMilli, incoming);
  if (projected === null) return failure("INVALID_INPUT", "The conditional inventory projection exceeds the safe integer range.");
  if (projected < need.forecastRequirementKgMilli) {
    return failure("NEEDS_RECALCULATION", "Accepted stock plus selected conditional incoming does not cover the current forecast requirement.");
  }

  const residual = projected - need.forecastRequirementKgMilli;
  if (!isSafeNonNegativeInteger(residual)) return failure("INVALID_INPUT", "The projected residual is outside the supported KgMilli range.");

  const eta = selected.assessment.deliveryWindow.etaLocal;
  const acceptance = selected.assessment.deliveryWindow.expectedAcceptanceLocal;
  const assumptions = [
    `Supplier-claimed ETA ${eta}; receipt and quality acceptance by ${acceptance} are assumed and remain unverified.`,
    `Projected chicken coverage is ingredient-only: ${formatKgMilli(need.acceptedOnHandKgMilli)} accepted stock plus ${formatKgMilli(incoming)} conditional incoming against ${formatKgMilli(need.forecastRequirementKgMilli)} forecast requirement.`,
    "Forecast chicken portions are potentially covered only after the proposed delivery is physically received and quality accepted.",
    "The scenario does not verify kitchen capacity, preparation throughput, or actual production.",
  ];
  const conditions = [
    ...selected.assessment.conditions,
    {
      code: "CONDITIONAL_INCOMING_NOT_PHYSICAL_STOCK" as const,
      description: "The proposed supplier quantity is not accepted inventory; update physical stock only after actual receipt and quality acceptance.",
    },
    {
      code: "KITCHEN_CAPACITY_NOT_RECOMPUTED" as const,
      description: "This projection covers chicken ingredients only; kitchen capacity and production feasibility have not been recalculated.",
    },
  ].filter((condition, index, all) => all.findIndex((candidate) => candidate.code === condition.code) === index);
  const provenance = selected.candidate.offer.provenance;
  const sourceLabels: PlanAScenarioCandidate["sourceLabels"] = [
    ...(provenance ? [provenance] : []),
    "SIMULATED_CALCULATION",
  ];

  return {
    ok: true,
    value: {
      id: metadata.scenarioId,
      incidentId: need.incidentId,
      strategy: "A",
      snapshotFingerprint: input.currentSnapshotFingerprint,
      version: metadata.version,
      feasibility: "CONDITIONAL",
      newPurchaseKgMilli: incoming,
      additionalCostSen: selected.assessment.landedCostSen,
      forecastChickenPortionsServed: need.forecastChickenPortions,
      forecastChickenPortionsUnmet: 0,
      confirmedChickenPortionsProtected: need.confirmedChickenPortions,
      assumptions,
      evidenceRefs: unique([...need.evidenceRefs, ...metadata.evidenceRefs, ...selected.assessment.evidenceRefs]),
      actionIds: [...metadata.actionIds],
      simulatedCalculation: true,
      acceptedOnHandKgMilli: need.acceptedOnHandKgMilli,
      conditionalIncomingKgMilli: incoming,
      projectedChickenAfterConditionalReceiptKgMilli: projected,
      forecastRequirementKgMilli: need.forecastRequirementKgMilli,
      projectedResidualKgMilli: residual,
      projectionScope: "INGREDIENT_COVERAGE_ONLY",
      productionGuaranteed: false,
      physicalInventoryEffect: "UNCHANGED",
      conditions,
      selectedOfferAssessment: selected.assessment,
      sourceLabels,
    },
  };
}

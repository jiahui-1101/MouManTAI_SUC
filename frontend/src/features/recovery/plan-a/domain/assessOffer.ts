import { calculateLandedCostSen } from "./calculateLandedCostSen";
import { evaluateDeliveryWindow } from "./evaluateDeliveryWindow";
import { instantMatchesBusinessClock, parseExplicitOffsetInstant } from "./timeUtils";
import type { AssessOfferInput, OfferAssessment, OfferReasonCode } from "./types";

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function assessOffer(input: AssessOfferInput): OfferAssessment {
  const offer = input?.candidate?.offer;
  const supplier = input?.candidate?.supplier;
  const need = input?.need;
  const businessClock = input?.businessClock;
  const reasonCodes: OfferReasonCode[] = [];
  const hardFailures = new Set<OfferReasonCode>();
  const unknownFindings = new Set<OfferReasonCode>();
  const conditions: OfferAssessment["conditions"] = [];
  const addReason = (code: OfferReasonCode, kind: "hard" | "unknown") => {
    if (!reasonCodes.includes(code)) reasonCodes.push(code);
    if (kind === "hard") hardFailures.add(code);
    else unknownFindings.add(code);
  };
  const addCondition = (code: OfferAssessment["conditions"][number]["code"], description: string) => {
    if (!conditions.some((condition) => condition.code === code)) conditions.push({ code, description });
  };

  if (!offer || !supplier || !need || !businessClock) {
    addReason("OFFER_EVIDENCE_MISSING", "unknown");
  } else {
    if (
      need.readinessStatus !== "READY" ||
      need.businessDate !== businessClock.businessDate ||
      need.timeZone !== businessClock.timeZone ||
      need.requiredReceiptCutoffLocal !== businessClock.requiredReceiptCutoffLocal ||
      need.receivingBufferMinutes !== businessClock.receivingBufferMinutes
    ) {
      addReason("BUSINESS_CONTEXT_MISMATCH", "unknown");
    }
    if (!offer.id || !offer.supplierId || !supplier.id) addReason("SUPPLIER_IDENTITY_UNVERIFIED", "unknown");
    if (typeof offer.evidenceRef !== "string" || offer.evidenceRef.trim().length === 0) {
      addReason("OFFER_EVIDENCE_MISSING", "unknown");
    }
    if (offer.supplierId !== supplier.id) addReason("SUPPLIER_ID_MISMATCH", "hard");
    if (supplier.status === "UNVERIFIED" || supplier.status === "UNKNOWN") {
      addReason("SUPPLIER_IDENTITY_UNVERIFIED", "unknown");
    } else if (supplier.status !== "APPROVED_DEMO_SUPPLIER") {
      addReason("SUPPLIER_NOT_APPROVED_FOR_SOURCING", "hard");
    }

    if (offer.ingredientId !== need.ingredientId) addReason("INGREDIENT_MISMATCH", "hard");
    if (typeof offer.spec !== "string" || offer.spec.trim().length === 0) {
      addReason("SPECIFICATION_UNKNOWN", "unknown");
    } else if (offer.spec !== need.requiredSpecification) {
      addReason("SPEC_MISMATCH", "hard");
    }
    if (input.candidate.specEvidenceStatus === "MISSING") addReason("SPEC_EVIDENCE_MISSING", "unknown");
    if (input.candidate.specEvidenceStatus === "UNVERIFIED") addReason("SPEC_EVIDENCE_UNVERIFIED", "unknown");
    if (input.candidate.specEvidenceStatus === "REJECTED") addReason("SPEC_EVIDENCE_REJECTED", "hard");
    if (input.candidate.specEvidenceStatus !== "SYNTHETIC_DEMO_APPROVED" &&
        input.candidate.specEvidenceStatus !== "MISSING" &&
        input.candidate.specEvidenceStatus !== "UNVERIFIED" &&
        input.candidate.specEvidenceStatus !== "REJECTED") {
      addReason("SPEC_EVIDENCE_UNVERIFIED", "unknown");
    }

    if (!isSafeNonNegativeInteger(offer.quantityKgMilli)) {
      addReason("INVALID_OFFER_QUANTITY", "hard");
    } else if (offer.quantityKgMilli < need.forecastGapKgMilli) {
      addReason("INSUFFICIENT_QUANTITY", "hard");
    }
    if (offer.minimumOrderKgMilli !== null && offer.minimumOrderKgMilli !== undefined) {
      if (!isSafeNonNegativeInteger(offer.minimumOrderKgMilli)) addReason("INVALID_MOQ", "hard");
      else if (isSafeNonNegativeInteger(offer.quantityKgMilli) && offer.quantityKgMilli < offer.minimumOrderKgMilli) addReason("MOQ_NOT_MET", "hard");
    }

    if (typeof offer.quoteValidUntilIso !== "string" || offer.quoteValidUntilIso.length === 0) {
      addCondition("QUOTE_VALIDITY_NOT_PROVIDED", "Quote validity was not included in the supplied offer; refresh it before any approval.");
    } else {
      const validUntil = parseExplicitOffsetInstant(offer.quoteValidUntilIso);
      const now = businessClock.nowIso;
      if (validUntil === null || !now || !instantMatchesBusinessClock(now, businessClock.businessDate, businessClock.nowLocal, businessClock.timeZone)) {
        addReason("QUOTE_VALIDITY_UNKNOWN", "unknown");
      } else {
        const currentInstant = parseExplicitOffsetInstant(now);
        if (currentInstant === null) addReason("QUOTE_VALIDITY_UNKNOWN", "unknown");
        else if (validUntil < currentInstant) addReason("QUOTE_EXPIRED", "hard");
      }
    }

    const deliveryAssessment = evaluateDeliveryWindow({ etaLocal: offer.etaLocal, ...businessClock });
    if (deliveryAssessment.status === "MISSED_PREP_CUTOFF") addReason("MISSED_PREP_CUTOFF", "hard");
    if (deliveryAssessment.status === "UNKNOWN") addReason("ETA_UNKNOWN", "unknown");

    if (input.candidate.availabilityStatus === "DENIED") addReason("SUPPLIER_DENIED", "hard");
    else if (input.candidate.availabilityStatus === "UNCONFIRMED") {
      addCondition("SUPPLIER_CONFIRMATION_REQUIRED", "The supplier's availability and ETA are claims, not a confirmed delivery.");
    } else if (input.candidate.availabilityStatus !== "CONFIRMED") {
      addReason("SUPPLIER_AVAILABILITY_UNKNOWN", "unknown");
    }
    addCondition("QUALITY_ACCEPTANCE_REQUIRED", "Receipt quantity, chilled specification, and quality must be checked before stock can change.");
  }

  let landedCostSen: number | null = null;
  if (offer && isSafeNonNegativeInteger(offer.quantityKgMilli)) {
    const cost = calculateLandedCostSen({
      quantityKgMilli: offer.quantityKgMilli,
      pricePerKgSen: offer.pricePerKgSen,
      freightSen: offer.freightSen,
    });
    if (!cost.ok) {
      addReason(cost.error.code === "MISSING_COST" ? "MISSING_COST" : "INVALID_COST", "unknown");
    } else {
      landedCostSen = cost.value.landedCostSen;
      if (offer.landedTotalSen !== null && offer.landedTotalSen !== undefined && offer.landedTotalSen !== landedCostSen) {
        addReason("LANDED_TOTAL_MISMATCH", "hard");
      }
    }
  } else if (offer) {
    addReason("INVALID_COST", "unknown");
  }

  const deliveryWindow = offer && businessClock
    ? evaluateDeliveryWindow({ etaLocal: offer.etaLocal, ...businessClock })
    : evaluateDeliveryWindow({ etaLocal: null, businessDate: "", timeZone: "", nowLocal: "", requiredReceiptCutoffLocal: "", receivingBufferMinutes: -1 });
  const status: OfferAssessment["status"] = hardFailures.size > 0
    ? "INCOMPATIBLE"
    : unknownFindings.size > 0
      ? "UNKNOWN"
      : "QUALIFIED_CONDITIONAL";

  return {
    offerId: offer?.id ?? "",
    supplierId: offer?.supplierId ?? "",
    status,
    isSelectableForConditionalPlan: status === "QUALIFIED_CONDITIONAL",
    reasonCodes,
    conditions,
    landedCostSen,
    deliveryWindow,
    physicalInventoryEffect: "NONE_UNTIL_ACCEPTED_RECEIPT",
    evidenceRefs: offer?.evidenceRef ? [offer.evidenceRef] : [],
  };
}

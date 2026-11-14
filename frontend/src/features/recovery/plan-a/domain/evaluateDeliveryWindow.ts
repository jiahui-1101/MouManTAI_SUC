import { formatLocalMinutes, instantMatchesBusinessClock, isCalendarDate, isValidTimeZone, parseLocalMinutes } from "./timeUtils";
import type { DeliveryWindowAssessment, DeliveryWindowInput } from "./types";

function unknown(reasonCode: DeliveryWindowAssessment["reasonCode"], etaLocal: string | null): DeliveryWindowAssessment {
  return {
    status: "UNKNOWN",
    reasonCode,
    etaLocal,
    expectedAcceptanceLocal: null,
    actualArrivalVerified: false,
    qualityAccepted: false,
  };
}

export function evaluateDeliveryWindow(input: DeliveryWindowInput): DeliveryWindowAssessment {
  const etaLocal = typeof input?.etaLocal === "string" ? input.etaLocal : null;
  const etaMinutes = parseLocalMinutes(etaLocal);
  const nowMinutes = parseLocalMinutes(input?.nowLocal);
  const cutoffMinutes = parseLocalMinutes(input?.requiredReceiptCutoffLocal);
  const validBuffer = Number.isSafeInteger(input?.receivingBufferMinutes) && input.receivingBufferMinutes >= 0;

  if (
    !isCalendarDate(input?.businessDate) ||
    !isValidTimeZone(input?.timeZone) ||
    nowMinutes === null ||
    cutoffMinutes === null ||
    !validBuffer
  ) {
    return unknown("BUSINESS_CONTEXT_UNKNOWN", etaLocal);
  }
  if (input.nowIso && !instantMatchesBusinessClock(input.nowIso, input.businessDate, input.nowLocal, input.timeZone)) {
    return unknown("BUSINESS_CONTEXT_UNKNOWN", etaLocal);
  }
  if (etaMinutes === null) return unknown("ETA_UNKNOWN", etaLocal);
  if (etaMinutes < nowMinutes) return unknown("ETA_BEFORE_DEMO_CLOCK", etaLocal);

  const acceptanceMinutes = etaMinutes + input.receivingBufferMinutes;
  if (acceptanceMinutes >= 24 * 60) return unknown("CROSS_DAY_ETA_UNSUPPORTED", etaLocal);

  const expectedAcceptanceLocal = formatLocalMinutes(acceptanceMinutes);
  if (acceptanceMinutes > cutoffMinutes) {
    return {
      status: "MISSED_PREP_CUTOFF",
      reasonCode: "MISSED_PREP_CUTOFF",
      etaLocal,
      expectedAcceptanceLocal,
      actualArrivalVerified: false,
      qualityAccepted: false,
    };
  }

  return {
    status: "TIME_CONDITIONALLY_ELIGIBLE",
    reasonCode: "NONE",
    etaLocal,
    expectedAcceptanceLocal,
    actualArrivalVerified: false,
    qualityAccepted: false,
  };
}

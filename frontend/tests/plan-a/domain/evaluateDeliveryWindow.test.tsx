import { describe, expect, it } from "vitest";
import { evaluateDeliveryWindow } from "../../../src/features/recovery/plan-a/domain";
import { makeCanonicalSourcingInput } from "./happyPotatoFactory";

describe("evaluateDeliveryWindow", () => {
  const context = makeCanonicalSourcingInput().businessClock;

  it("keeps Offer B conditionally eligible after a 15-minute receiving buffer", () => {
    const result = evaluateDeliveryWindow({ etaLocal: "10:15", ...context });

    expect(result).toMatchObject({ status: "TIME_CONDITIONALLY_ELIGIBLE", expectedAcceptanceLocal: "10:30", actualArrivalVerified: false, qualityAccepted: false });
  });

  it("rejects Offer C because the receiving window misses the 10:45 cutoff", () => {
    const result = evaluateDeliveryWindow({ etaLocal: "13:30", ...context });

    expect(result.status).toBe("MISSED_PREP_CUTOFF");
    expect(result.reasonCode).toBe("MISSED_PREP_CUTOFF");
  });

  it.each([null, "tomorrow", "25:15", "10:15Z"]) ("returns UNKNOWN for ambiguous ETA %s", (etaLocal) => {
    const result = evaluateDeliveryWindow({ etaLocal, ...context });

    expect(result.status).toBe("UNKNOWN");
  });

  it("does not infer tomorrow when the supplier ETA time is earlier than the demo clock", () => {
    const result = evaluateDeliveryWindow({ etaLocal: "08:00", ...context });

    expect(result).toMatchObject({ status: "UNKNOWN", reasonCode: "ETA_BEFORE_DEMO_CLOCK" });
  });

  it("returns UNKNOWN when the receiving buffer crosses midnight without a dated ETA", () => {
    const result = evaluateDeliveryWindow({
      etaLocal: "23:50",
      ...context,
      nowLocal: "22:00",
      nowIso: "2026-11-21T22:00:00+08:00",
      requiredReceiptCutoffLocal: "23:59",
      receivingBufferMinutes: 15,
    });

    expect(result).toMatchObject({ status: "UNKNOWN", reasonCode: "CROSS_DAY_ETA_UNSUPPORTED" });
  });
});

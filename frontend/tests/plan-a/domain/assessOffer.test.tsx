import { describe, expect, it } from "vitest";
import { assessOffer, deriveRecoverySourcingNeed } from "../../../src/features/recovery/plan-a/domain";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC } from "./happyPotatoFactory";

function need() {
  const result = deriveRecoverySourcingNeed(makeCanonicalSourcingInput());
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

function assess(candidate: ReturnType<typeof makeOfferB> | ReturnType<typeof makeOfferC>) {
  return assessOffer({ candidate, need: need(), businessClock: makeCanonicalSourcingInput().businessClock });
}

describe("assessOffer", () => {
  it("qualifies Offer B conditionally and keeps its quote out of physical stock", () => {
    const result = assess(makeOfferB());

    expect(result).toMatchObject({
      status: "QUALIFIED_CONDITIONAL",
      isSelectableForConditionalPlan: true,
      landedCostSen: 25_500,
      physicalInventoryEffect: "NONE_UNTIL_ACCEPTED_RECEIPT",
    });
    expect(result.conditions.map((condition) => condition.code)).toContain("SUPPLIER_CONFIRMATION_REQUIRED");
    expect(result.conditions.map((condition) => condition.code)).toContain("QUALITY_ACCEPTANCE_REQUIRED");
  });

  it("rejects Offer C for its chilled-spec mismatch and missed cutoff despite the lower cost", () => {
    const result = assess(makeOfferC());

    expect(result).toMatchObject({ status: "INCOMPATIBLE", isSelectableForConditionalPlan: false, landedCostSen: 22_000 });
    expect(result.reasonCodes).toContain("SPEC_MISMATCH");
    expect(result.reasonCodes).toContain("MISSED_PREP_CUTOFF");
  });

  it("keeps missing specification evidence UNKNOWN rather than asserting approval", () => {
    const result = assess(makeOfferB({ specEvidenceStatus: "MISSING" }));

    expect(result).toMatchObject({ status: "UNKNOWN", isSelectableForConditionalPlan: false });
    expect(result.reasonCodes).toContain("SPEC_EVIDENCE_MISSING");
  });

  it("does not qualify an unverified supplier", () => {
    const result = assess(makeOfferB({ supplierStatus: "UNVERIFIED" }));

    expect(result.status).toBe("UNKNOWN");
    expect(result.reasonCodes).toContain("SUPPLIER_IDENTITY_UNVERIFIED");
  });

  it("does not treat a five-kilogram quote as full-gap recovery", () => {
    const result = assess(makeOfferB({ offer: { quantityKgMilli: 5_000 } }));

    expect(result.status).toBe("INCOMPATIBLE");
    expect(result.reasonCodes).toContain("INSUFFICIENT_QUANTITY");
  });

  it("rejects an expired quote", () => {
    const result = assess(makeOfferB({ offer: { quoteValidUntilIso: "2026-11-21T08:59:00+08:00" } }));

    expect(result.status).toBe("INCOMPATIBLE");
    expect(result.reasonCodes).toContain("QUOTE_EXPIRED");
  });

  it("keeps a missing cost non-estimable instead of filling it with zero", () => {
    const result = assess(makeOfferB({ offer: { pricePerKgSen: null } }));

    expect(result.status).toBe("UNKNOWN");
    expect(result.landedCostSen).toBeNull();
    expect(result.reasonCodes).toContain("MISSING_COST");
  });
});

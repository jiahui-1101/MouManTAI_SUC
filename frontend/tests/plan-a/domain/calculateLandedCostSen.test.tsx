import { describe, expect, it } from "vitest";
import { calculateLandedCostSen } from "../../../src/features/recovery/plan-a/domain";

describe("calculateLandedCostSen", () => {
  it("normalizes Offer B to exactly RM255 using integer sen", () => {
    const result = calculateLandedCostSen({ quantityKgMilli: 15_000, pricePerKgSen: 1_600, freightSen: 1_500 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ quantityKgMilli: 15_000, itemCostSen: 24_000, freightSen: 1_500, landedCostSen: 25_500 });
  });

  it("normalizes the cheaper Offer C to RM220 without making an eligibility decision", () => {
    const result = calculateLandedCostSen({ quantityKgMilli: 15_000, pricePerKgSen: 1_400, freightSen: 1_000 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.landedCostSen).toBe(22_000);
  });

  it.each([
    [{ quantityKgMilli: -1, pricePerKgSen: 1, freightSen: 0 }, "INVALID_AMOUNT"],
    [{ quantityKgMilli: 1.5, pricePerKgSen: 1, freightSen: 0 }, "INVALID_AMOUNT"],
    [{ quantityKgMilli: 1, pricePerKgSen: -1, freightSen: 0 }, "INVALID_AMOUNT"],
    [{ quantityKgMilli: 1, pricePerKgSen: 1, freightSen: -1 }, "INVALID_AMOUNT"],
    [{ quantityKgMilli: Number.MAX_SAFE_INTEGER + 1, pricePerKgSen: 1, freightSen: 0 }, "INVALID_AMOUNT"],
  ])("rejects invalid monetary or quantity inputs", (input, code) => {
    const result = calculateLandedCostSen(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  });

  it("does not turn missing cost components into zero", () => {
    const result = calculateLandedCostSen({ quantityKgMilli: 1_000, pricePerKgSen: null, freightSen: null });

    expect(result).toMatchObject({ ok: false, error: { code: "MISSING_COST" } });
  });

  it("rounds fractional sen deterministically using half-up rounding", () => {
    const result = calculateLandedCostSen({ quantityKgMilli: 1, pricePerKgSen: 500, freightSen: 0 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.itemCostSen).toBe(1);
    expect(result.value.roundingPolicy).toBe("HALF_UP_TO_SEN");
  });

  it("returns an explicit overflow result when the total cannot fit a safe integer", () => {
    const result = calculateLandedCostSen({
      quantityKgMilli: Number.MAX_SAFE_INTEGER,
      pricePerKgSen: Number.MAX_SAFE_INTEGER,
      freightSen: 0,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "COST_OVERFLOW" } });
  });
});

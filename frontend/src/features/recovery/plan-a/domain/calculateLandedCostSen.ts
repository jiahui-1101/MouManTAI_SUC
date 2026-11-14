import type { DomainResult, LandedCost, LandedCostInput } from "./types";

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function calculateLandedCostSen(input: LandedCostInput): DomainResult<LandedCost> {
  if (!input || !isSafeNonNegativeInteger(input.quantityKgMilli)) {
    return { ok: false, error: { code: "INVALID_AMOUNT", message: "Quantity must be a non-negative safe integer in KgMilli." } };
  }
  if (input.pricePerKgSen === null || input.pricePerKgSen === undefined || input.freightSen === null || input.freightSen === undefined) {
    return { ok: false, error: { code: "MISSING_COST", message: "Unit price and freight must both be supplied; missing amounts are not treated as zero." } };
  }
  if (!isSafeNonNegativeInteger(input.pricePerKgSen) || !isSafeNonNegativeInteger(input.freightSen)) {
    return { ok: false, error: { code: "INVALID_AMOUNT", message: "Unit price and freight must be non-negative safe integers in sen." } };
  }

  const productSenMilli = BigInt(input.quantityKgMilli) * BigInt(input.pricePerKgSen);
  const itemCostSenBigInt = (productSenMilli + 500n) / 1_000n;
  const landedCostSenBigInt = itemCostSenBigInt + BigInt(input.freightSen);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (itemCostSenBigInt > maxSafe || landedCostSenBigInt > maxSafe) {
    return { ok: false, error: { code: "COST_OVERFLOW", message: "Normalized landed cost exceeds JavaScript's safe integer range." } };
  }

  const itemCostSen = Number(itemCostSenBigInt);
  return {
    ok: true,
    value: {
      quantityKgMilli: input.quantityKgMilli,
      pricePerKgSen: input.pricePerKgSen,
      itemCostSen,
      freightSen: input.freightSen,
      landedCostSen: Number(landedCostSenBigInt),
      roundingPolicy: "HALF_UP_TO_SEN",
      roundingApplied: productSenMilli % 1_000n !== 0n,
    },
  };
}

import { describe, expect, it } from "vitest";
import { calculatePlanB, isCurrentScenario } from "./planB";
import { preview } from "./preview";

function plan(input = preview) {
  const result = calculatePlanB(input);
  if (result.status !== "READY") throw new Error(result.status);
  return result;
}
describe("Happy Potato internal recovery", () => {
  it("reserves once across the chicken menus and limits new demand", () => {
    const result = plan();
    expect(result).toMatchObject({ chicken: 10000, confirmedChicken: 8750, discretionary: 1250, assigned: 9950, residual: 50, fries: 30000, friesForecastGrams: 27000, chickenForecastGrams: 22000, issues: [] });
    expect(result.rows.map(row => row.quota)).toEqual([0, 0, 12, 55]);
    expect(result.scenario).toMatchObject({ feasibility: "FEASIBLE", forecastChickenPortionsServed: 72, forecastChickenPortionsUnmet: 78, confirmedChickenPortionsProtected: 60, newPurchaseKgMilli: 0, additionalCostSen: 0 });
    expect(result.scenario.batches.map(batch => batch.status)).toEqual(Array(4).fill("PLANNED"));
  });
  it.each([{ start: 660 }, { end: 760 }, { portions: 21 }, { station: "missing" }])("flags schedule changes %j", change => {
    const batches = preview.batches.map((batch, index) => index === 1 ? { ...batch, ...change } : batch);
    expect(plan({ ...preview, batches }).scenario.feasibility).toBe("INFEASIBLE");
  });
  it("flags a 750g confirmed deficit", () => {
    const result = plan({ ...preview, lots: preview.lots.map(lot => lot.ingredient === "chicken" ? { ...lot, grams: 8000 } : lot) });
    expect(result.deficit).toBe(750);
    expect(result.scenario.feasibility).toBe("BREACH_RISK");
  });
  it("excludes expired and unaccepted chicken and blocks unapproved recipes", () => {
    for (const change of [{ expiresOn: preview.date }, { accepted: false }]) {
      expect(plan({ ...preview, lots: [{ ...preview.lots[0], ...change }, preview.lots[1]] }).scenario.feasibility).toBe("BREACH_RISK");
    }
    expect(plan({ ...preview, menus: [{ ...preview.menus[0], approved: false }, ...preview.menus.slice(1)] }).scenario.feasibility).toBe("BREACH_RISK");
    expect(calculatePlanB({ ...preview, lots: [{ ...preview.lots[0], grams: null }, preview.lots[1]] }).status).toBe("UNKNOWN");
  });
  it("marks unknown holding conditional and invalidates stale scenarios", () => {
    expect(plan({ ...preview, holdingKnown: false }).scenario.feasibility).toBe("CONDITIONAL");
    expect(isCurrentScenario(plan().scenario, { ...preview, fingerprint: "changed" })).toBe(false);
    expect(calculatePlanB(preview, { incidentId: "HP-INC-001", snapshotFingerprint: "old" }).status).toBe("STALE");
  });
});

import { describe, expect, it } from "vitest";
import { calculatePlanB, isCurrentScenario } from "../src/features/recovery/plan-b/planB";
import { preview } from "../src/features/recovery/plan-b/preview";

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
    expect(result.fries).toBe(30000);
    expect(result.friesForecastGrams).toBe(27000);
    expect(result.friesAssigned).toBe(23760);
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
    expect(result.scenario).toMatchObject({ feasibility: "BREACH_RISK", confirmedChickenPortionsProtected: 0, newPurchaseKgMilli: 0, additionalCostSen: 0 });
    expect(result.scenario.forecastChickenPortionsServed).toBe(0);
    expect(result.assigned).toBe(0);
    expect(result.rows.filter(row => row.chicken > 0).every(row => row.protected === 0 && row.quota === 0)).toBe(true);
  });
  it("excludes expired and unaccepted chicken and blocks unapproved recipes", () => {
    for (const change of [{ expiresOn: preview.date }, { accepted: false }]) {
      expect(plan({ ...preview, lots: preview.lots.map(lot => lot.ingredient === "chicken" ? { ...lot, ...change } : lot) }).scenario.feasibility).toBe("BREACH_RISK");
    }
    expect(plan({ ...preview, menus: preview.menus.map(menu => menu.id === "HP-MENU-CP" ? { ...menu, approved: false } : menu) }).scenario.feasibility).toBe("BREACH_RISK");
    expect(calculatePlanB({ ...preview, lots: preview.lots.map(lot => lot.ingredient === "chicken" ? { ...lot, grams: null } : lot) }).status).toBe("UNKNOWN");
  });
  it("marks unknown holding conditional and invalidates stale scenarios", () => {
    expect(plan({ ...preview, holdingKnown: false }).scenario.feasibility).toBe("CONDITIONAL");
    expect(isCurrentScenario(plan().scenario, { ...preview, fingerprint: "changed" })).toBe(false);
    expect(calculatePlanB(preview, { incidentId: "HP-INC-001", snapshotFingerprint: "old" }).status).toBe("STALE");
  });
});

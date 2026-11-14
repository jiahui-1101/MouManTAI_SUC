import { describe, expect, it } from "vitest";
import {
  HP_BUSINESS,
  HP_IDS,
  HP_LOCKED_MESSAGE,
  createHappyPotatoSeedSnapshot,
} from "../../src/data/fixtures/happyPotato";
import {
  affectedConfirmedOrders,
  affectedMenus,
  confirmedIngredientRequirements,
  dataQualityWarnings,
  forecastIngredientRequirements,
  ingredientGap,
  ingredientPosition,
  isSupplyTimeEligible,
  lotEligibility,
  poDeliveryDifference,
  sharedIngredientDemand,
  forecastDemandLines,
  verifySnapshotFreshness,
} from "../../src/features/impact/calculations";
import { assessImpact } from "../../src/features/impact/assessImpact";
import {
  assessIncidentImpact,
  createInitialRestaurantState,
  isImpactStale,
  recordSupplierIncident,
  resetRestaurantState,
  reviseSnapshot,
  selectCurrentImpact,
  type RestaurantState,
  type SupplierIncidentReport,
} from "../../src/services/mock/restaurantState";
import { UnitError, addSameUnit, convertToBase, formatMilli, multiplyByPortions, parseQuantity } from "../../src/utils/quantity";

const CHICKEN = HP_IDS.chicken;
const FRIES = HP_IDS.fries;
const CUTOFF = HP_BUSINESS.prepCutoffLocal;

function report(overrides: Partial<SupplierIncidentReport> = {}): SupplierIncidentReport {
  const e = HP_LOCKED_MESSAGE.expected;
  return {
    incidentId: HP_IDS.incident,
    messageId: "sim:whatsapp:001",
    poId: e.poId,
    supplierId: HP_IDS.supplierOriginal,
    ingredientId: e.ingredientId,
    incidentType: e.incidentType,
    claimedDeliveryTodayKgMilli: e.claimedDeliveryTodayKgMilli,
    etaLocal: e.etaLocal,
    verification: "VERIFIED",
    ...overrides,
  };
}

function verifiedAndAssessed(start: RestaurantState = createInitialRestaurantState()) {
  const verified = recordSupplierIncident(start, report());
  return assessIncidentImpact(verified, HP_IDS.incident);
}

describe("canonical fixture (seed = before message)", () => {
  const snap = createHappyPotatoSeedSnapshot();

  it("has the shared-contract identity and labels", () => {
    expect(snap.id).toBe("HP-SNAP-001");
    expect(snap.revision).toBe(1);
    expect(snap.dataMode).toBe("SYNTHETIC_BUSINESS");
    expect(snap.fingerprint).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
  });

  it("starts with PO OPEN, no claims and nothing received", () => {
    expect(snap.purchaseOrders).toEqual([expect.objectContaining({ id: "HP-PO-1042", state: "OPEN", expectedKgMilli: 20000 })]);
    expect(snap.supplierClaims).toEqual([]);
    expect(createInitialRestaurantState().incidents).toEqual([]);
  });

  it("totals 240 forecast / 95 confirmed portions; confirmed ⊆ forecast per menu", () => {
    const forecast = snap.forecasts.reduce((s, f) => s + f.portions, 0);
    const confirmed = snap.confirmedOrders.reduce((s, o) => s + o.portions, 0);
    expect(forecast).toBe(240);
    expect(confirmed).toBe(95);
    for (const f of snap.forecasts) {
      const c = snap.confirmedOrders.filter((o) => o.menuId === f.menuId).reduce((s, o) => s + o.portions, 0);
      expect(c).toBeLessThanOrEqual(f.portions);
    }
  });

  it("derives menu contract weights from the recipe BOM", () => {
    const byId = Object.fromEntries(snap.menuItems.map((m) => [m.id, m]));
    expect(byId["HP-MENU-CP"]?.chickenKgMilli).toBe(150);
    expect(byId["HP-MENU-CT"]?.chickenKgMilli).toBe(200);
    expect(byId["HP-MENU-HC"]?.chickenKgMilli).toBe(100);
    expect(byId["HP-MENU-HC"]?.potatoFriesKgMilli).toBe(180);
    expect(byId["HP-MENU-FR"]?.chickenKgMilli).toBe(0);
  });

  it("returns an independent copy each time (no shared mutation)", () => {
    const a = createHappyPotatoSeedSnapshot();
    a.ingredientLots[0]!.onHandMilli = 1;
    expect(createHappyPotatoSeedSnapshot().ingredientLots[0]!.onHandMilli).toBe(10000);
  });
});

describe("units and exact arithmetic", () => {
  it("parses decimals exactly", () => {
    expect(parseQuantity("0.150", "kg")).toEqual({ valueMilli: 150, unit: "kg" });
    expect(parseQuantity("10", "kg").valueMilli).toBe(10000);
    expect(parseQuantity("200", "g")).toEqual({ valueMilli: 200, unit: "kg" });
    expect(parseQuantity("10.000", "L").unit).toBe("L");
  });

  it("0.150 kg × 25 = 3.750 kg with no float artifact (P2-T09)", () => {
    expect(multiplyByPortions(150, 25)).toBe(3750);
    expect(formatMilli(multiplyByPortions(150, 25))).toBe("3.750");
    // Why integers: binary floats drift (0.1 kg × 3 ≠ 0.3 kg); integer grams do not.
    expect(0.1 * 3).not.toBe(0.3);
    expect(multiplyByPortions(parseQuantity("0.1", "kg").valueMilli, 3)).toBe(300);
  });

  it("converts only compatible units", () => {
    expect(convertToBase(200_000, "g", "kg")).toBe(200); // 200.000 g = 0.200 kg
    expect(addSameUnit(parseQuantity("25", "kg"), parseQuantity("200", "g"))).toEqual({ valueMilli: 25200, unit: "kg" });
    expect(() => addSameUnit(parseQuantity("10", "pcs"), parseQuantity("3", "kg"))).toThrow(UnitError);
    expect(() => convertToBase(1, "g", "kg")).toThrow(UnitError); // 0.001 g is below gram precision
    expect(convertToBase(1000, "ml", "L")).toBe(1);
    expect(() => convertToBase(1000, "pcs", "kg")).toThrow(UnitError);
    expect(() => convertToBase(1000, "L", "kg")).toThrow(UnitError);
    expect(() => parseQuantity("0.1505", "kg")).toThrow(UnitError);
  });
});

describe("demand and requirement calculations", () => {
  const snap = createHappyPotatoSeedSnapshot();

  it("forecast chicken requirement = 22.000 kg", () => {
    expect(forecastIngredientRequirements(snap).totals[CHICKEN]).toEqual({ unit: "kg", quantityMilli: 22000 });
  });

  it("confirmed chicken requirement = 8.750 kg", () => {
    expect(confirmedIngredientRequirements(snap).totals[CHICKEN]?.quantityMilli).toBe(8750);
  });

  it("frozen fries forecast = 27.000 kg within 30.000 kg on hand", () => {
    expect(forecastIngredientRequirements(snap).totals[FRIES]?.quantityMilli).toBe(27000);
    const fries = ingredientPosition(snap, FRIES, { neededByLocal: CUTOFF, applySupplierClaims: true });
    expect(fries.eligibleOnHandMilli).toBe(30000);
    expect(ingredientGap(27000, fries.eligibleOnHandMilli)).toBe(0);
  });

  it("shared chicken demand: 150 forecast portions across three menus", () => {
    const rows = sharedIngredientDemand(snap, CHICKEN, forecastDemandLines(snap));
    expect(rows.map((r) => r.menuId)).toEqual(["HP-MENU-CP", "HP-MENU-CT", "HP-MENU-HC"]);
    expect(rows.reduce((s, r) => s + r.portions, 0)).toBe(150);
    expect(rows.map((r) => r.ingredientQuantityMilli)).toEqual([9000, 8000, 5000]);
  });

  it("identifies three chicken menus and leaves fries-only unaffected", () => {
    const menus = affectedMenus(snap, CHICKEN);
    expect(menus.affectedMenuIds).toEqual(["HP-MENU-CP", "HP-MENU-CT", "HP-MENU-HC"]);
    expect(menus.unaffectedMenuIds).toEqual(["HP-MENU-FR"]);
    expect(menus.unknownMenuIds).toEqual([]);
  });

  it("affected confirmed orders are the 9 chicken groups totalling 60 portions", () => {
    const orders = affectedConfirmedOrders(snap, affectedMenus(snap, CHICKEN).affectedMenuIds);
    expect(orders).toHaveLength(9);
    expect(orders.reduce((s, o) => s + o.portions, 0)).toBe(60);
    expect(orders.some((o) => o.menuId === "HP-MENU-FR")).toBe(false);
  });

  it("missing BOM yields UNKNOWN, not 'unaffected'", () => {
    const broken = createHappyPotatoSeedSnapshot();
    broken.recipes = broken.recipes.filter((r) => r.menuId !== "HP-MENU-CT");
    const menus = affectedMenus(broken, CHICKEN);
    expect(menus.unknownMenuIds).toEqual(["HP-MENU-CT"]);
    expect(dataQualityWarnings(broken).map((i) => i.code)).toContain("MISSING_RECIPE");
  });
});

describe("inventory and time eligibility", () => {
  it("before vs after claim keeps 10 kg physical; incoming is never physical (P2-T11)", () => {
    const state = recordSupplierIncident(createInitialRestaurantState(), report());
    const seed = createHappyPotatoSeedSnapshot();
    const before = ingredientPosition(seed, CHICKEN, { neededByLocal: CUTOFF, applySupplierClaims: false });
    const after = ingredientPosition(state.snapshot, CHICKEN, { neededByLocal: CUTOFF, applySupplierClaims: true });
    expect(before).toMatchObject({ physicalOnHandMilli: 10000, plannedIncomingMilli: 20000, supplierClaimedIncomingMilli: 0 });
    expect(after).toMatchObject({ physicalOnHandMilli: 10000, eligibleOnHandMilli: 10000, plannedIncomingMilli: 0, supplierClaimedIncomingMilli: 0 });
  });

  it("does not double-count a lot listed twice", () => {
    const snap = createHappyPotatoSeedSnapshot();
    snap.ingredientLots.push({ ...snap.ingredientLots[0]! });
    expect(ingredientPosition(snap, CHICKEN, { neededByLocal: CUTOFF, applySupplierClaims: true }).eligibleOnHandMilli).toBe(10000);
  });

  it("unaccepted or quarantined lots are physical but not eligible", () => {
    const snap = createHappyPotatoSeedSnapshot();
    snap.ingredientLots.push({ id: "HP-LOT-CH-Q", ingredientId: CHICKEN, onHandMilli: 5000, unit: "kg", accepted: true, quarantined: true, availableAtLocal: "09:00" });
    snap.ingredientLots.push({ id: "HP-LOT-CH-X", ingredientId: CHICKEN, onHandMilli: 2000, unit: "kg", accepted: false, availableAtLocal: "09:00" });
    const pos = ingredientPosition(snap, CHICKEN, { neededByLocal: CUTOFF, applySupplierClaims: true });
    expect(pos.physicalOnHandMilli).toBe(17000);
    expect(pos.eligibleOnHandMilli).toBe(10000);
    expect(pos.ineligibleOnHandMilli).toBe(7000);
  });

  it("reservations reduce availability but never below zero per lot", () => {
    const snap = createHappyPotatoSeedSnapshot();
    snap.reservations.push({ id: "R1", lotId: "HP-LOT-CH-001", quantityMilli: 1500, reason: "test" });
    expect(ingredientPosition(snap, CHICKEN, { neededByLocal: CUTOFF, applySupplierClaims: true }).availableAfterReservationsMilli).toBe(8500);
    snap.reservations.push({ id: "R2", lotId: "HP-LOT-CH-001", quantityMilli: 50000, reason: "test" });
    expect(ingredientPosition(snap, CHICKEN, { neededByLocal: CUTOFF, applySupplierClaims: true }).availableAfterReservationsMilli).toBe(0);
  });

  it("late supplier receipt (13:30) is not usable for the 10:45 prep cutoff", () => {
    expect(isSupplyTimeEligible("13:30", CUTOFF)).toBe(false);
    expect(isSupplyTimeEligible("10:15", CUTOFF)).toBe(true);
    expect(isSupplyTimeEligible("10:45", CUTOFF)).toBe(true);
    expect(isSupplyTimeEligible(null, CUTOFF)).toBe(false); // "update you tomorrow" is not an ETA
    expect(lotEligibility({ id: "L", ingredientId: CHICKEN, onHandMilli: 1, unit: "kg", accepted: true, availableAtLocal: "13:30" }, CUTOFF).eligible).toBe(false);
  });

  it("PO difference: 20 kg shortfall; missing quantity is UNRESOLVED", () => {
    const po = createHappyPotatoSeedSnapshot().purchaseOrders[0];
    expect(poDeliveryDifference(po, 0)).toEqual({ status: "RESOLVED", expectedKgMilli: 20000, claimedKgMilli: 0, shortfallKgMilli: 20000 });
    expect(poDeliveryDifference({ ...po!, expectedKgMilli: null }, 0).status).toBe("UNRESOLVED");
    expect(poDeliveryDifference(undefined, 0).status).toBe("UNRESOLVED");
  });
});

describe("impact assessment (P2-T01, T05, T06, T07)", () => {
  it("canonical verified incident: 20 kg PO shortfall vs 12 kg forecast gap, 1.25 kg discretionary", () => {
    const state = verifiedAndAssessed();
    const impact = selectCurrentImpact(state, HP_IDS.incident)!;
    expect(impact.status).toBe("ASSESSED");
    expect(impact.poShortfallKgMilli).toBe(20000);
    expect(impact.summary).toMatchObject({
      affectedMenuIds: ["HP-MENU-CP", "HP-MENU-CT", "HP-MENU-HC"],
      confirmedChickenPortions: 60,
      chickenForecastPortions: 150,
      chickenForecastRequirementKgMilli: 22000,
      chickenAvailableKgMilli: 10000,
      demandGapKgMilli: 12000,
    });
    expect(impact.confirmedRequirementKgMilli).toBe(8750);
    expect(impact.discretionaryAfterConfirmedKgMilli).toBe(1250);
    expect(impact.confirmedDeficitKgMilli).toBe(0);
    expect(impact.unaffectedMenuIds).toEqual(["HP-MENU-FR"]);
    expect(impact.feasibilityOfConfirmed).toBe("CONDITIONAL");
    expect(impact.source).toBe("SIMULATED_CALCULATION");
    expect(state.incidents[0]?.status).toBe("IMPACT_ASSESSED");
    expect(impact.poShortfallKgMilli).not.toBe(impact.summary!.demandGapKgMilli); // different metrics
  });

  it("unverified sender/PO gives no authoritative impact and leaves the snapshot untouched", () => {
    const start = createInitialRestaurantState();
    const pending = recordSupplierIncident(start, report({ verification: "PENDING" }));
    expect(pending.snapshot).toBe(start.snapshot);
    const assessed = assessIncidentImpact(pending, HP_IDS.incident);
    const impact = assessed.impacts[HP_IDS.incident]!;
    expect(impact.status).toBe("PENDING_VERIFICATION");
    expect(impact.summary).toBeNull();
    expect(assessed.incidents[0]?.status).toBe("PENDING_VERIFICATION");
  });

  it("three channels reporting the same PO link to one incident without repeated subtraction", () => {
    let state = createInitialRestaurantState();
    state = recordSupplierIncident(state, report({ messageId: "sim:whatsapp:001" }));
    const afterFirst = state.snapshot;
    state = recordSupplierIncident(state, report({ messageId: "sim:outlook:001" }));
    state = recordSupplierIncident(state, report({ messageId: "sim:telegram:001" }));
    state = recordSupplierIncident(state, report({ messageId: "sim:telegram:001" })); // provider redelivery
    expect(state.incidents).toHaveLength(1);
    expect(state.incidents[0]?.messageIds).toEqual(["sim:whatsapp:001", "sim:outlook:001", "sim:telegram:001"]);
    expect(state.snapshot.supplierClaims).toHaveLength(1);
    expect(state.snapshot).toBe(afterFirst);
    const impact = selectCurrentImpact(assessIncidentImpact(state, HP_IDS.incident), HP_IDS.incident)!;
    expect(impact.poShortfallKgMilli).toBe(20000);
    expect(impact.summary?.chickenAvailableKgMilli).toBe(10000);
  });

  it("8 kg accepted chicken → 0.750 kg confirmed deficit and BREACH_RISK, orders not dropped", () => {
    let state = recordSupplierIncident(createInitialRestaurantState(), report());
    state = reviseSnapshot(state, "Accepted chicken counted at 8 kg", (d) => {
      d.ingredientLots.find((l) => l.id === "HP-LOT-CH-001")!.onHandMilli = 8000;
    });
    state = assessIncidentImpact(state, HP_IDS.incident);
    const impact = state.impacts[HP_IDS.incident]!;
    expect(impact.status).toBe("BREACH_RISK");
    expect(impact.confirmedDeficitKgMilli).toBe(750);
    expect(impact.discretionaryAfterConfirmedKgMilli).toBe(0);
    expect(impact.feasibilityOfConfirmed).toBe("INFEASIBLE");
    expect(impact.affectedConfirmedOrderIds).toHaveLength(9);
    expect(state.snapshot.confirmedOrders.every((o) => o.status === "CONFIRMED")).toBe(true);
  });

  it("missing BOM makes the impact UNKNOWN with a reason", () => {
    let state = recordSupplierIncident(createInitialRestaurantState(), report());
    state = reviseSnapshot(state, "Recipe removed", (d) => {
      d.recipes = d.recipes.filter((r) => r.menuId !== "HP-MENU-HC");
    });
    const impact = assessIncidentImpact(state, HP_IDS.incident).impacts[HP_IDS.incident]!;
    expect(impact.status).toBe("UNKNOWN");
    expect(impact.summary).toBeNull();
    expect(impact.reasons.join(" ")).toMatch(/HP-MENU-HC|Happy Combo/);
  });

  it("unapproved recipe version blocks a confident result", () => {
    let state = recordSupplierIncident(createInitialRestaurantState(), report());
    state = reviseSnapshot(state, "Recipe unapproved", (d) => {
      d.recipes.find((r) => r.menuId === "HP-MENU-CP")!.approvedInDemo = false;
    });
    expect(assessIncidentImpact(state, HP_IDS.incident).impacts[HP_IDS.incident]?.status).toBe("UNKNOWN");
  });

  it("no capacity metadata → confirmed feasibility UNKNOWN (P2-T10)", () => {
    let state = recordSupplierIncident(createInitialRestaurantState(), report());
    state = reviseSnapshot(state, "Resources removed", (d) => {
      d.resources = [];
    });
    const impact = assessIncidentImpact(state, HP_IDS.incident).impacts[HP_IDS.incident]!;
    expect(impact.status).toBe("ASSESSED");
    expect(impact.feasibilityOfConfirmed).toBe("UNKNOWN");
    expect(impact.dataQuality.map((i) => i.code)).toContain("MISSING_CAPACITY");
  });
});

describe("snapshot revisions, staleness and reset", () => {
  it("material change → new revision and fingerprint; prior impact becomes stale (P2-T08)", () => {
    const assessed = verifiedAndAssessed();
    const oldFingerprint = assessed.snapshot.fingerprint;
    const changed = reviseSnapshot(assessed, "Verified simulated receipt of 5 kg", (d) => {
      d.ingredientLots.push({ id: "HP-LOT-CH-002", ingredientId: CHICKEN, onHandMilli: 5000, unit: "kg", accepted: true, availableAtLocal: "10:30" });
    });
    expect(changed.snapshot.revision).toBe(assessed.snapshot.revision + 1);
    expect(changed.snapshot.fingerprint).not.toBe(oldFingerprint);
    expect(changed.snapshotHistory.at(-1)?.fingerprint).toBe(oldFingerprint);
    expect(isImpactStale(changed, HP_IDS.incident)).toBe(true);
    expect(selectCurrentImpact(changed, HP_IDS.incident)).toBeNull();
    const incident = changed.incidents[0]!;
    expect(assessImpact(changed.snapshot, incident, { expectedFingerprint: oldFingerprint, neededByLocal: CUTOFF }).status).toBe("STALE_SNAPSHOT");
  });

  it("a no-op revision keeps the same revision and fingerprint", () => {
    const state = createInitialRestaurantState();
    expect(reviseSnapshot(state, "noop", () => {})).toBe(state);
  });

  it("silent in-place mutation is detected as stale", () => {
    const snap = createHappyPotatoSeedSnapshot();
    expect(verifySnapshotFreshness(snap).status).toBe("CURRENT");
    snap.ingredientLots[0]!.onHandMilli = 9000;
    expect(verifySnapshotFreshness(snap).status).toBe("STALE");
  });

  it("verifying the claim itself creates revision 2 (PO state + claim recorded)", () => {
    const state = recordSupplierIncident(createInitialRestaurantState(), report());
    expect(state.snapshot.revision).toBe(2);
    expect(state.snapshot.purchaseOrders[0]?.state).toBe("SUPPLIER_CLAIMED_UNAVAILABLE_TODAY");
    expect(state.snapshot.ingredientLots.find((l) => l.id === "HP-LOT-CH-001")?.onHandMilli).toBe(10000);
  });

  it("fingerprint is deterministic across independent seeds", () => {
    expect(createHappyPotatoSeedSnapshot().fingerprint).toBe(createHappyPotatoSeedSnapshot().fingerprint);
  });

  it("reset returns the canonical synthetic state (P2-T12)", () => {
    const seed = createInitialRestaurantState();
    const dirty = verifiedAndAssessed();
    const reset = resetRestaurantState();
    expect(reset).toEqual(seed);
    expect(reset.snapshot.id).toBe("HP-SNAP-001");
    expect(reset.snapshot.revision).toBe(1);
    expect(reset.incidents).toEqual([]);
    expect(dirty.snapshot.revision).toBe(2);
  });
});

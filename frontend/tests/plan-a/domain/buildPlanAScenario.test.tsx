import { describe, expect, it } from "vitest";
import { buildPlanAScenario } from "../../../src/features/recovery/plan-a/domain";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC, makePlanAScenarioInput } from "./happyPotatoFactory";

describe("buildPlanAScenario", () => {
  it("builds the canonical conditional Plan A candidate from the selected eligible offer", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: "HP-SC-A-001",
      incidentId: "HP-INC-001",
      strategy: "A",
      snapshotFingerprint: "fixture-snapshot-version-1",
      version: 1,
      feasibility: "CONDITIONAL",
      newPurchaseKgMilli: 15_000,
      additionalCostSen: 25_500,
      acceptedOnHandKgMilli: 10_000,
      conditionalIncomingKgMilli: 15_000,
      projectedChickenAfterConditionalReceiptKgMilli: 25_000,
      forecastRequirementKgMilli: 22_000,
      projectedResidualKgMilli: 3_000,
      forecastChickenPortionsServed: 150,
      forecastChickenPortionsUnmet: 0,
      confirmedChickenPortionsProtected: 60,
      simulatedCalculation: true,
      projectionScope: "INGREDIENT_COVERAGE_ONLY",
      productionGuaranteed: false,
      physicalInventoryEffect: "UNCHANGED",
    });
  });

  it("carries the caller's scenario version, fingerprint, evidence refs, and action IDs", () => {
    const input = makePlanAScenarioInput({
      version: 4,
      evidenceRefs: ["reviewed-message-7"],
      actionIds: ["draft-action-9"],
    });
    const result = buildPlanAScenario(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      version: 4,
      snapshotFingerprint: input.currentSnapshotFingerprint,
      evidenceRefs: expect.arrayContaining(["reviewed-message-7", "HP-OFFER-002"]),
      actionIds: ["draft-action-9"],
      sourceLabels: ["SYNTHETIC_BUSINESS", "SIMULATED_CALCULATION"],
    });
  });

  it("labels the output as ingredient-only and does not claim production is guaranteed without capacity evidence", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.conditions.map((condition) => condition.code)).toContain("KITCHEN_CAPACITY_NOT_RECOMPUTED");
    expect(result.value.conditions.map((condition) => condition.code)).toContain("CONDITIONAL_INCOMING_NOT_PHYSICAL_STOCK");
    expect(result.value.productionGuaranteed).toBe(false);
    expect(result.value.forecastChickenPortionsServed).toBe(150);
  });

  it("does not mutate the snapshot or turn the proposed incoming quantity into accepted stock", () => {
    const sourcingInput = makeCanonicalSourcingInput();
    const before = structuredClone(sourcingInput.snapshot);
    const result = buildPlanAScenario(makePlanAScenarioInput({ sourcingInput }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.acceptedOnHandKgMilli).toBe(10_000);
    expect(result.value.conditionalIncomingKgMilli).toBe(15_000);
    expect(sourcingInput.snapshot).toEqual(before);
  });

  it("recomputes projections when accepted stock changes", () => {
    const sourcingInput = makeCanonicalSourcingInput();
    sourcingInput.snapshot.ingredientLots[0]!.onHandMilli = 12_000;
    sourcingInput.impact.chickenAvailableKgMilli = 12_000;
    sourcingInput.impact.demandGapKgMilli = 10_000;

    const result = buildPlanAScenario(makePlanAScenarioInput({ sourcingInput }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      acceptedOnHandKgMilli: 12_000,
      conditionalIncomingKgMilli: 15_000,
      projectedChickenAfterConditionalReceiptKgMilli: 27_000,
      projectedResidualKgMilli: 5_000,
      forecastChickenPortionsServed: 150,
    });
  });

  it("recomputes portion projections when forecast demand changes", () => {
    const sourcingInput = makeCanonicalSourcingInput();
    sourcingInput.snapshot.forecasts[0]!.portions = 70;
    sourcingInput.impact.chickenForecastPortions = 160;
    sourcingInput.impact.chickenForecastRequirementKgMilli = 23_500;
    sourcingInput.impact.demandGapKgMilli = 13_500;

    const result = buildPlanAScenario(makePlanAScenarioInput({ sourcingInput }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      forecastRequirementKgMilli: 23_500,
      forecastChickenPortionsServed: 160,
      forecastChickenPortionsUnmet: 0,
      projectedResidualKgMilli: 1_500,
    });
  });

  it("returns NEEDS_RECALCULATION for a five-kilogram quote instead of preserving the 150-portion claim", () => {
    const smallerOffer = makeOfferB({ offer: { quantityKgMilli: 5_000, landedTotalSen: 9_500 } });
    const result = buildPlanAScenario(makePlanAScenarioInput({ candidateOffers: [smallerOffer] }));

    expect(result).toMatchObject({ ok: false, error: { code: "NEEDS_RECALCULATION" } });
  });

  it("returns a typed empty-supplier result without fabricating a candidate", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ candidateOffers: [], selectedOfferId: null }));

    expect(result).toMatchObject({ ok: false, error: { code: "NO_SUPPLIER_OFFERS" } });
  });

  it("returns a typed result when all offers are incompatible", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ candidateOffers: [makeOfferC()], selectedOfferId: null }));

    expect(result).toMatchObject({ ok: false, error: { code: "NO_ELIGIBLE_OFFERS" } });
  });

  it("requires explicit selection rather than selecting the cheapest or only offer automatically", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ selectedOfferId: null }));

    expect(result).toMatchObject({ ok: false, error: { code: "OFFER_SELECTION_REQUIRED" } });
  });

  it("refuses the cheaper frozen and late offer when it is explicitly selected", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ selectedOfferId: "HP-OFFER-003" }));

    expect(result).toMatchObject({ ok: false, error: { code: "OFFER_NOT_ELIGIBLE" } });
  });

  it("blocks a scenario when the current fingerprint differs from the sourcing need", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ currentSnapshotFingerprint: "changed-snapshot-version" }));

    expect(result).toMatchObject({ ok: false, error: { code: "SNAPSHOT_MISMATCH" } });
  });

  it("blocks a scenario when the snapshot revision differs even if its fingerprint string was reused", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ currentSnapshotRevision: 2 }));

    expect(result).toMatchObject({ ok: false, error: { code: "SNAPSHOT_MISMATCH" } });
  });

  it("does not invent a fingerprint when the caller has none", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ currentSnapshotFingerprint: "" }));

    expect(result).toMatchObject({ ok: false, error: { code: "SNAPSHOT_FINGERPRINT_MISSING" } });
  });

  it("requires caller-supplied scenario identity and a positive version", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ scenarioId: "", version: 0 }));

    expect(result).toMatchObject({ ok: false, error: { code: "SCENARIO_METADATA_MISSING" } });
  });

  it("does not emit a feasible-looking candidate when kitchen capacity is known insufficient", () => {
    const result = buildPlanAScenario(makePlanAScenarioInput({ capacityStatus: "INSUFFICIENT" }));

    expect(result).toMatchObject({ ok: false, error: { code: "KITCHEN_CAPACITY_INSUFFICIENT" } });
  });

  it("does not produce a scenario from an unverified incident", () => {
    const sourcingInput = makeCanonicalSourcingInput();
    sourcingInput.incident.status = "PENDING_VERIFICATION";

    expect(() => makePlanAScenarioInput({ sourcingInput })).toThrow("INCIDENT_NOT_VERIFIED");
  });
});

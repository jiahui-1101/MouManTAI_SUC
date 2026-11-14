import { describe, expect, it } from "vitest";
import { deriveRecoverySourcingNeed } from "../../../src/features/recovery/plan-a/domain";
import { makeCanonicalSourcingInput } from "./happyPotatoFactory";

function valueOf<T>(result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }): T {
  if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`);
  return result.value;
}

describe("deriveRecoverySourcingNeed", () => {
  it("keeps the 20kg PO shortfall distinct from the 12kg forecast gap", () => {
    const result = valueOf(deriveRecoverySourcingNeed(makeCanonicalSourcingInput()));

    expect(result).toMatchObject({
      originalExpectedKgMilli: 20_000,
      claimedIncomingKgMilli: 0,
      poShortfallKgMilli: 20_000,
      acceptedOnHandKgMilli: 10_000,
      forecastRequirementKgMilli: 22_000,
      forecastGapKgMilli: 12_000,
    });
  });

  it("derives 8.75kg for 60 confirmed chicken portions and excludes fries-only portions", () => {
    const result = valueOf(deriveRecoverySourcingNeed(makeCanonicalSourcingInput()));

    expect(result.confirmedRequirementKgMilli).toBe(8_750);
    expect(result.confirmedChickenPortions).toBe(60);
    expect(result.forecastChickenPortions).toBe(150);
    expect(result.affectedMenuIds).toEqual(["HP-MENU-CP", "HP-MENU-CT", "HP-MENU-HC"]);
    expect(result.affectedMenuIds).not.toContain("HP-MENU-FR");
  });

  it("blocks an incident that has not passed verification", () => {
    const input = makeCanonicalSourcingInput();
    input.incident.status = "PENDING_VERIFICATION";

    const result = deriveRecoverySourcingNeed(input);

    expect(result).toMatchObject({ ok: false, error: { code: "INCIDENT_NOT_VERIFIED" } });
  });

  it("blocks inconsistent impact values instead of replacing them with local calculations", () => {
    const input = makeCanonicalSourcingInput();
    input.impact.demandGapKgMilli = 20_000;

    const result = deriveRecoverySourcingNeed(input);

    expect(result).toMatchObject({ ok: false, error: { code: "IMPACT_MISMATCH" } });
  });

  it("does not subtract supplier-claimed incoming from physical accepted stock", () => {
    const input = makeCanonicalSourcingInput();
    const before = structuredClone(input.snapshot);
    const result = valueOf(deriveRecoverySourcingNeed(input));

    expect(result.acceptedOnHandKgMilli).toBe(10_000);
    expect(input.snapshot).toEqual(before);
  });

  it("blocks mismatched incident and snapshot fingerprints", () => {
    const input = makeCanonicalSourcingInput();
    input.incident.snapshotFingerprint = "different-snapshot-version";

    const result = deriveRecoverySourcingNeed(input);

    expect(result).toMatchObject({ ok: false, error: { code: "SNAPSHOT_MISMATCH" } });
  });
});

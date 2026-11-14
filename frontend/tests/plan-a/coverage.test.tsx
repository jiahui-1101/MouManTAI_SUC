import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RecoveryProjection } from "../../src/features/recovery/plan-a/components/RecoveryProjection";
import { SupplyCoverage } from "../../src/features/recovery/plan-a/components/SupplyCoverage";
import { buildPlanAScenario } from "../../src/features/recovery/plan-a/domain";
import { makeCanonicalSourcingInput, makePlanAScenarioInput } from "./domain/happyPotatoFactory";
afterEach(cleanup);
it("shows physical vs conditional supply and moves the forecast marker when source stock changes",()=>{
  const first=buildPlanAScenario(makePlanAScenarioInput()); if(!first.ok)throw Error(first.error.message);
  const view=render(<SupplyCoverage scenario={first.value}/>);
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("Physical accepted stock 10kg, conditional incoming 15kg, forecast requirement 22kg, projected residual 3kg");
  expect(screen.getByTestId("coverage-physical").style.width).toBe("40%");
  expect(screen.getByTestId("coverage-conditional").style.width).toBe("60%");
  expect(screen.getByTestId("coverage-forecast").style.left).toBe("88%");
  const source=makeCanonicalSourcingInput();source.snapshot.ingredientLots[0]!.onHandMilli=12000;source.impact.chickenAvailableKgMilli=12000;source.impact.demandGapKgMilli=10000;
  const changed=buildPlanAScenario(makePlanAScenarioInput({sourcingInput:source})); if(!changed.ok)throw Error(changed.error.message);
  view.rerender(<SupplyCoverage scenario={changed.value}/>);
  expect(parseFloat(screen.getByTestId("coverage-physical").style.width)).toBeCloseTo(12000/(12000+15000)*100);
  expect(parseFloat(screen.getByTestId("coverage-forecast").style.left)).toBeCloseTo(22000/(12000+15000)*100);
  expect(screen.getByRole("img").getAttribute("aria-label")).toContain("projected residual 5kg");
});

it("keeps unfamiliar assumptions and every evidence reference accessible in structured projection details", () => {
  const result = buildPlanAScenario(makePlanAScenarioInput());
  if (!result.ok) throw Error(result.error.message);
  result.value.assumptions.push("Confirm loading-bay access with the outlet manager.");
  const before = structuredClone(result.value);
  render(<RecoveryProjection scenario={result.value}/>);
  expect(screen.getByText("Confirm loading-bay access with the outlet manager.")).toBeTruthy();
  for (const ref of result.value.evidenceRefs) expect(screen.getByText(ref)).toBeTruthy();
  expect(screen.getByText(/Supplier-claimed ETA 10:15 · Assumed acceptance 10:30 · Unverified/)).toBeTruthy();
  expect(screen.getByText("Refresh before approval")).toBeTruthy();
  expect(screen.getByText(/Incoming supply is conditional/)).toBeTruthy();
  expect(result.value).toEqual(before);
});

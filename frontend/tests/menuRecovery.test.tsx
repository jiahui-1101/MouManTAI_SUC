import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { MenuRecoveryPanel } from "../src/features/recovery/plan-b/MenuRecoveryPanel";
import { calculatePlanB } from "../src/features/recovery/plan-b/planB";
import { preview } from "../src/features/recovery/plan-b/preview";

afterEach(cleanup);

function scenario(chicken: number) {
  const result = calculatePlanB({ ...preview, lots: preview.lots.map(lot => lot.ingredient === "chicken" ? { ...lot, grams: chicken } : lot) });
  if (result.status !== "READY") throw new Error(result.status);
  return result;
}

it("shows baseline recommendations and opens an inline explanation", () => {
  render(<MenuRecoveryPanel plan={scenario(10000)} />);
  const table = screen.getByRole("table", { name: "Menu availability" });
  expect(within(table).getAllByText("Pause New Orders")).toHaveLength(2);
  expect(within(table).getByText("12")).toBeTruthy();
  expect(within(table).getByText("Up to 55*")).toBeTruthy();
  for (const count of [25, 15, 20, 35]) expect(within(table).getByText(String(count))).toBeTruthy();
  expect(screen.getByText(/Additional production is subject to kitchen capacity/)).toBeTruthy();
  const combo = within(table).getByRole("button", { name: /Happy Combo/ });
  fireEvent.click(combo);
  expect(combo.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText(/1.20 kg of chicken/)).toBeTruthy();
  fireEvent.click(combo);
  expect(combo.getAttribute("aria-expanded")).toBe("false");
});

it("updates suggestions for shortages and restores them at baseline", () => {
  const { rerender } = render(<MenuRecoveryPanel plan={scenario(10000)} />);
  rerender(<MenuRecoveryPanel plan={scenario(8000)} />);
  expect(screen.getByText("Confirmed Order Risk")).toBeTruthy();
  expect(screen.getByText(/0.75 kg chicken missing/)).toBeTruthy();
  expect(within(screen.getByRole("table")).getAllByText("Pause New Orders")).toHaveLength(3);
  expect(screen.getByText("Up to 55*")).toBeTruthy();
  rerender(<MenuRecoveryPanel plan={scenario(10000)} />);
  expect(screen.queryByText("Confirmed Order Risk")).toBeNull();
  const limited = screen.getByRole("heading", { name: "Accept up to the quota" }).closest("section")!;
  expect(within(limited).getByText("12 new")).toBeTruthy();
});

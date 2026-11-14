import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { allocateDemoOrders } from "../src/features/recovery/plan-b/orderCoverage";
import { OrderProtection } from "../src/features/recovery/plan-b/OrderProtectionPanel";
import { calculatePlanB } from "../src/features/recovery/plan-b/planB";
import { preview } from "../src/features/recovery/plan-b/preview";

afterEach(cleanup);

it("matches confirmed demand and reserves stock once in ticket order", () => {
  const orders = allocateDemoOrders(preview.menus, 8000, 30000)!;
  expect(orders).toHaveLength(12);
  expect(orders.reduce((sum, order) => sum + order.portions, 0)).toBe(95);
  expect(orders.reduce((sum, order) => sum + order.requiredChicken, 0)).toBe(8750);
  expect(orders.reduce((sum, order) => sum + order.requiredFries, 0)).toBe(10600);
  expect(orders.reduce((sum, order) => sum + order.chickenShort, 0)).toBe(750);
  expect(orders.filter(order => order.atRisk).map(order => order.id)).toEqual(["HP-DEMO-ORD-011", "HP-DEMO-ORD-012"]);
});

it("supports searching, paging and projected demand", () => {
  const plan = calculatePlanB(preview);
  if (plan.status !== "READY") throw new Error(plan.status);
  render(<OrderProtection plan={plan} />);
  expect(screen.getByText("Showing 1–6 of 12")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByText("Showing 7–12 of 12")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search orders"), { target: { value: "ORD-012" } });
  fireEvent.click(screen.getByRole("button", { name: "HP-DEMO-ORD-012" }));
  expect(screen.getByRole("heading", { name: "HP-DEMO-ORD-012" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Forecast Demand" }));
  expect(screen.getByText("240", { exact: true })).toBeTruthy();
  expect(screen.getByText("145", { exact: true })).toBeTruthy();
  expect(screen.getByText("78", { exact: true })).toBeTruthy();
  expect(within(screen.getByRole("table")).getByText("55 conditional")).toBeTruthy();
});

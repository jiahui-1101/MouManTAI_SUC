/** P1/P2 -> P4: production Plan B consumes P2's buildP4Handoff on the shared snapshot. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { demoStore } from "../src/store/demoStore";
import { assessImpactAction, getP2State, simulateChickenRecount } from "../src/services/mock/restaurantStore";
import { selectPlanBInput } from "../src/integration/planBShared";
import { calculatePlanB } from "../src/features/recovery/plan-b/planB";

const s = () => demoStore.getSnapshot();
beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);
const app = (path: string) => { const r = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={r} />); return r; };
const verifyAndAssess = () => act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); assessImpactAction("HP-INC-001"); });

describe("Plan B shared inputs", () => {
  it("D: pending -> ready from shared impact; inputs mirror the authoritative snapshot", () => {
    expect(selectPlanBInput(s()).status).toBe("PENDING");
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    expect(selectPlanBInput(s()).status).toBe("PENDING"); // verified but not yet assessed by P2
    act(() => assessImpactAction("HP-INC-001"));
    const shared = selectPlanBInput(s());
    expect(shared.status).toBe("READY");
    if (shared.status !== "READY") return;
    const snap = s().restaurant.snapshot;
    expect(shared.input).toMatchObject({ snapshotId: "HP-SNAP-001", fingerprint: snap.fingerprint, revision: snap.revision, incident: { id: "HP-INC-001", verified: true, po: "HP-PO-1042", ordered: 20000, claimed: 0 } });
    expect(shared.sharedChickenGrams).toBe(10000);
    expect(shared.input.menus.find((m) => m.id === "HP-MENU-CP")).toMatchObject({ chicken: 150, forecast: 60, confirmed: 25 });
    expect(calculatePlanB(shared.input).status).toBe("READY");
  });

  it("what-if is local only and never mutates shared inventory", () => {
    verifyAndAssess();
    const before = getP2State().restaurant;
    app("/recovery/plan-b?view=recovery");
    fireEvent.change(screen.getByRole("slider", { name: /Simulated chicken stock/ }), { target: { value: "8000" } });
    expect(screen.getByText("Chicken shortfall · 0.75 kg")).toBeTruthy();
    expect(getP2State().restaurant).toBe(before);
    expect(before.snapshot.ingredientLots.find((l) => l.id === "HP-LOT-CH-001")!.onHandMilli).toBe(10000);
  });

  it("I: a real recount makes Plan B stale until P2 reassesses, then uses the new baseline", () => {
    verifyAndAssess();
    app("/recovery/plan-b?view=recovery");
    act(() => simulateChickenRecount(8000));
    expect(screen.getByText("LOCAL DEMO")).toBeTruthy();
    expect(screen.getByTestId("plan-b-reason")).toBeTruthy();
    act(() => assessImpactAction("HP-INC-001"));
    expect(within(screen.getByRole("region", { name: "Plan B summary" })).getByText("8.00 kg", { selector: "strong" })).toBeTruthy();
  });
});

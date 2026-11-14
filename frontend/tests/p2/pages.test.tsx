import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../src/app/router";
import {
  __resetP2StoreForTests,
  getP2State,
  resetDemo,
  simulateChickenRecount,
  simulateSupplierReport,
  simulateVerification,
  assessImpactAction,
} from "../../src/services/mock/restaurantStore";
import { overviewCounts } from "../../src/features/incidents/model";

const FIXED = new Date("2026-11-21T01:05:00Z");

beforeEach(() => __resetP2StoreForTests(() => FIXED));
afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const kpi = (label: string) => screen.getByText(label).closest("a") as HTMLAnchorElement;

function verifiedAssessed() {
  act(() => {
    simulateSupplierReport("WHATSAPP", "VERIFIED");
    assessImpactAction("HP-INC-001");
  });
}

describe("Operations Overview", () => {
  it("renders the canonical initial state without a seeded incident", () => {
    renderAt("/overview");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Overview");
    expect(screen.getAllByText("Happy Potato — Demo Outlet").length).toBeGreaterThan(0);
    expect(screen.getByText("HP-SNAP-001 · r1")).toBeTruthy();
    expect(screen.getByText("No supplier disruption reported")).toBeTruthy();
    expect(within(kpi("Active supply incidents")).getByText("0")).toBeTruthy();
    // Not assessed → never a default zero
    expect(within(kpi("Confirmed orders at risk")).getByText("—")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open supplier inbox/ }).getAttribute("href")).toBe("/inbox");
  });

  it("treats an unverified report as pending, not complete", () => {
    act(() => void simulateSupplierReport("TELEGRAM", "PENDING"));
    renderAt("/overview");
    expect(within(kpi("Active supply incidents")).getByText("0")).toBeTruthy();
    expect(within(kpi("Active supply incidents")).getByText("+1 awaiting verification")).toBeTruthy();
    expect(screen.getAllByText("Pending verification").length).toBeGreaterThan(0);
    expect(screen.getByText("Not applied (unverified)")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Review supplier message/ }).getAttribute("href")).toBe("/message-intelligence");
  });

  it("shows Pending for verified-but-unassessed, then values after assessment", () => {
    act(() => void simulateSupplierReport("WHATSAPP", "VERIFIED"));
    renderAt("/overview");
    expect(within(kpi("Confirmed orders at risk")).getByText("Pending")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Assess business impact/ }));
    expect(within(kpi("Active supply incidents")).getByText("1")).toBeTruthy();
    expect(within(kpi("Affected menu items")).getByText("3")).toBeTruthy();
    expect(within(kpi("Confirmed orders at risk")).getByText("0")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Review Plan A/ }).getAttribute("href")).toBe("/recovery/plan-a");
    expect(screen.getByRole("link", { name: /Review Plan B/ }).getAttribute("href")).toBe("/recovery/plan-b");
  });

  it("separates supplier claim from physical stock on the disruption card", () => {
    verifiedAssessed();
    renderAt("/overview");
    const card = screen.getByRole("link", { name: "Open incident HP-INC-001" });
    expect(within(card).getByText("Reported PO shortage").nextElementSibling?.textContent).toBe("20kg");
    expect(within(card).getByText("Accepted on-hand chicken").nextElementSibling?.textContent).toBe("10kg");
    expect(within(card).getByText("Claimed delivery today").nextElementSibling?.textContent).toBe("0kg");
  });

  it("lists three chicken menus as affected and fries-only as unaffected", () => {
    renderAt("/overview");
    for (const name of ["Chicken Popcorn", "Chicken Tenders", "Happy Combo — Chicken Popcorn"]) {
      expect(screen.getByRole("link", { name: `${name}: uses chilled chicken` }).getAttribute("href")).toBe("/impact");
    }
    expect(screen.getByRole("link", { name: "Flavoured Fries (Regular): unaffected" })).toBeTruthy();
  });

  it("updates after a snapshot change: stale warning, then BREACH_RISK after re-assessment", () => {
    verifiedAssessed();
    renderAt("/overview");
    act(() => simulateChickenRecount(8000));
    expect(screen.getByText("Impact is stale")).toBeTruthy();
    expect(within(kpi("Confirmed orders at risk")).getByText("Pending")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Re-assess impact/ }));
    expect(within(kpi("Confirmed orders at risk")).getByText("9")).toBeTruthy();
    expect(screen.getByText("Confirmed demand exceeds eligible chicken")).toBeTruthy();
  });

  it("KPI card navigates to incidents and opens the incident", async () => {
    verifiedAssessed();
    const router = renderAt("/overview");
    fireEvent.click(kpi("Confirmed orders at risk"));
    expect(router.state.location.pathname).toBe("/incidents");
    expect(router.state.location.search).toBe("?incident=HP-INC-001");
    expect(await screen.findByRole("dialog", { name: "HP-INC-001" })).toBeTruthy();
  });

  it("reset restores the initial projection", () => {
    verifiedAssessed();
    renderAt("/overview");
    act(() => resetDemo());
    expect(screen.getByText("No supplier disruption reported")).toBeTruthy();
    expect(screen.getByText("HP-SNAP-001 · r1")).toBeTruthy();
    expect(screen.getByText("Demo reset")).toBeTruthy();
  });
});

describe("Supply Incidents", () => {
  it("shows an empty state with no incidents", () => {
    renderAt("/incidents");
    expect(screen.getByText("No supply incidents")).toBeTruthy();
  });

  it("three channel reports produce one incident with three linked messages", () => {
    act(() => {
      simulateSupplierReport("WHATSAPP", "VERIFIED");
      simulateSupplierReport("OUTLOOK", "VERIFIED");
      simulateSupplierReport("TELEGRAM", "VERIFIED");
    });
    expect(getP2State().restaurant.incidents).toHaveLength(1);
    expect(getP2State().restaurant.snapshot.supplierClaims).toHaveLength(1);
    renderAt("/incidents");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText("3 messages · simulated")).toBeTruthy();
    fireEvent.click(within(rows[0]!).getByRole("button", { name: "View details" }));
    const dialog = screen.getByRole("dialog", { name: "HP-INC-001" });
    expect(within(dialog).getByText("Linked supplier messages (3)")).toBeTruthy();
    expect(within(dialog).getByText(/counted once/)).toBeTruthy();
  });

  it("detail shows PO, supplier and keeps 20kg PO delta distinct from 12kg forecast gap", () => {
    verifiedAssessed();
    renderAt("/incidents?incident=HP-INC-001");
    const dialog = screen.getByRole("dialog", { name: "HP-INC-001" });
    expect(within(dialog).getAllByText("HP-PO-1042").length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Supplier").nextElementSibling?.textContent).toBe("Demo Poultry Supply A HP-SUP-001");
    const cell = (label: string) => within(dialog).getByText(label).nextElementSibling?.textContent;
    expect(cell("Supplier PO change")).toBe("20kg");
    expect(cell("Forecast ingredient gap")).toBe("12kg");
    expect(cell("Physical chicken")).toBe("10kg");
    expect(cell("Forecast requirement")).toBe("22kg");
    expect(cell("Affected menu items")).toBe("3");
    expect(cell("Confirmed chicken portions")).toBe("60");
    expect(within(dialog).getByText("Unaffected: 1 (fries-only)")).toBeTruthy();
    expect(within(dialog).getByText("Unaffected")).toBeTruthy();
  });

  it("withholds impact for an unverified incident and warns", () => {
    act(() => void simulateSupplierReport("OUTLOOK", "PENDING"));
    renderAt("/incidents?incident=HP-INC-001");
    const dialog = screen.getByRole("dialog", { name: "HP-INC-001" });
    expect(within(dialog).getByText("Impact withheld — incident not verified")).toBeTruthy();
    expect(within(dialog).queryByText("Forecast ingredient gap")).toBeNull();
    act(() => simulateVerification("HP-INC-001"));
    expect(within(dialog).getByText("Impact not assessed yet")).toBeTruthy();
  });

  it("shows a stale warning after a snapshot change", () => {
    verifiedAssessed();
    act(() => simulateChickenRecount(8000));
    renderAt("/incidents?incident=HP-INC-001");
    expect(screen.getByText("Impact is stale")).toBeTruthy();
    expect(screen.getByText("Stale")).toBeTruthy();
  });

  it("filters, search and empty-result reset work", () => {
    verifiedAssessed();
    renderAt("/incidents");
    const table = () => screen.queryByRole("table");
    const select = (label: string) => screen.getByLabelText(label) as HTMLSelectElement;

    fireEvent.change(select("Status"), { target: { value: "PENDING_VERIFICATION" } });
    expect(screen.getByText("No incidents match these filters")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    expect(table()).toBeTruthy();

    fireEvent.change(select("Status"), { target: { value: "IMPACT_ASSESSED" } });
    fireEvent.change(select("Severity"), { target: { value: "HIGH" } });
    fireEvent.change(select("Ingredient"), { target: { value: "HP-ING-CHICKEN" } });
    fireEvent.change(select("Supplier"), { target: { value: "HP-SUP-001" } });
    fireEvent.change(select("Channel"), { target: { value: "WHATSAPP" } });
    expect(table()).toBeTruthy();
    fireEvent.change(select("Channel"), { target: { value: "TELEGRAM" } });
    expect(table()).toBeNull();
    fireEvent.change(select("Channel"), { target: { value: "" } });
    fireEvent.change(select("Severity"), { target: { value: "CRITICAL" } });
    expect(table()).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);

    const search = screen.getByRole("searchbox");
    fireEvent.change(search, { target: { value: "po-1042" } });
    expect(table()).toBeTruthy();
    fireEvent.change(search, { target: { value: "HP-INC-999" } });
    expect(table()).toBeNull();
  });

  it("opens details by clicking a row and closes with Escape (keyboard)", () => {
    verifiedAssessed();
    const router = renderAt("/incidents");
    fireEvent.click(screen.getAllByRole("row")[1]!);
    const dialog = screen.getByRole("dialog", { name: "HP-INC-001" });
    expect(document.activeElement?.id).toBe("incident-detail-title");
    expect(router.state.location.search).toBe("?incident=HP-INC-001");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(dialog.isConnected).toBe(false);
  });

  it("lifecycle reflects actual shared state", () => {
    act(() => void simulateSupplierReport("WHATSAPP", "PENDING"));
    renderAt("/incidents?incident=HP-INC-001");
    const steps = screen.getByRole("list", { name: "Incident lifecycle" });
    expect(within(steps).getByText("Pending verification").closest("li")?.getAttribute("aria-current")).toBe("step");
  });
});

describe("overview counts selector", () => {
  it("never reports zero risk before assessment", () => {
    act(() => void simulateSupplierReport("WHATSAPP", "VERIFIED"));
    expect(overviewCounts(getP2State().restaurant).confirmedOrdersAtRisk.kind).toBe("pending");
  });
});

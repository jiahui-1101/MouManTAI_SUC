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
  it("guides a supplier report from simulation through verification and impact", () => {
    renderAt("/overview");
    const summary = screen.getByText("Supplier disruption demo");
    expect(summary.closest("header")).toBe(screen.getByRole("heading", { name: "Overview" }).closest("header"));
    const demo = summary.closest("details")!;
    demo.open = true;
    const controls = within(demo);

    expect(controls.queryByRole("button", { name: "Verify report" })).toBeNull();
    const options = controls.getByText("More demo options").closest("details")!;
    expect(options.open).toBe(false);
    fireEvent.click(controls.getByRole("button", { name: "Simulate supplier report" }));
    expect(getP2State().messages[0]?.channel).toBe("WHATSAPP");
    expect(getP2State().restaurant.incidents[0]?.status).toBe("PENDING_VERIFICATION");

    fireEvent.click(controls.getByRole("button", { name: "Verify report" }));
    fireEvent.click(controls.getByRole("button", { name: "Assess impact" }));
    expect(controls.getByRole("status").textContent).toContain("Assessment complete");
    expect(within(kpi("Affected menu items")).getByText("3")).toBeTruthy();

    fireEvent.click(controls.getByRole("button", { name: "Reset demo" }));
    expect(controls.getByRole("button", { name: "Simulate supplier report" })).toBeTruthy();
    expect(getP2State().restaurant.snapshot.revision).toBe(1);
  });

  it("renders the canonical initial state without a seeded incident", () => {
    renderAt("/overview");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Overview");
    expect(screen.getByText("Outlet: Happy Potato")).toBeTruthy();
    expect(getP2State().restaurant.snapshot).toMatchObject({ id: "HP-SNAP-001", revision: 1 });
    expect(screen.getByText("No supplier disruption reported")).toBeTruthy();
    expect(within(kpi("Active supply incidents")).getByText("0")).toBeTruthy();
    // Not assessed → never a default zero
    expect(within(kpi("Confirmed orders at risk")).getByText("—")).toBeTruthy();
    expect(screen.getByText("No action needed")).toBeTruthy();
  });

  it("treats an unverified report as pending, not complete", () => {
    act(() => void simulateSupplierReport("TELEGRAM", "PENDING"));
    renderAt("/overview");
    expect(within(kpi("Active supply incidents")).getByText("0")).toBeTruthy();
    expect(within(kpi("Active supply incidents")).getByText("+1 awaiting verification")).toBeTruthy();
    expect(screen.getAllByText("Pending verification").length).toBeGreaterThan(0);
    expect(screen.getByText("Claim not applied yet")).toBeTruthy();
    expect(getP2State().restaurant.snapshot.revision).toBe(1);
  });

  it("shows Pending for verified-but-unassessed, then values after assessment", () => {
    act(() => void simulateSupplierReport("WHATSAPP", "VERIFIED"));
    renderAt("/overview");
    expect(within(kpi("Confirmed orders at risk")).getByText("Pending")).toBeTruthy();
    screen.getByText("Supplier disruption demo").closest("details")!.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Assess impact" }));
    expect(within(kpi("Active supply incidents")).getByText("1")).toBeTruthy();
    expect(within(kpi("Affected menu items")).getByText("3")).toBeTruthy();
    expect(within(kpi("Confirmed orders at risk")).getByText("0")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Plan A · External supplier/ }).getAttribute("href")).toBe("/recovery/plan-a");
    expect(screen.getByRole("link", { name: /Plan B · Internal recovery/ }).getAttribute("href")).toBe("/recovery/plan-b");
  });

  it("separates supplier claim from physical stock on the disruption card", () => {
    verifiedAssessed();
    renderAt("/overview");
    for (const [tile, label, quantity] of [
      ["PO shortage", "Reported shortage", "20kg"],
      ["On-hand stock", "Physical on hand", "10kg"],
      ["Claimed today", "Claimed delivery today", "0kg"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: `Show details: ${tile}` }));
      expect(screen.getByText(label!, { selector: "dt" }).nextElementSibling?.textContent).toBe(quantity);
    }
  });

  it("lists three chicken menus as affected and fries-only as unaffected", () => {
    renderAt("/overview");
    for (const name of ["Chicken Popcorn", "Chicken Tenders", "Happy Combo — Chicken Popcorn"]) {
      expect(screen.getByRole("link", { name: `${name}: uses chilled chicken` }).getAttribute("href")).toBe("/impact");
    }
    expect(screen.getByRole("link", { name: "Flavoured Fries (Regular): unaffected" })).toBeTruthy();
  });

  it("filters the menu cards by chicken impact and restores all four photos", () => {
    renderAt("/overview");
    const filters = within(screen.getByRole("group", { name: "Filter menu by chicken impact" }));
    const popcorn = /Chicken Popcorn: uses chilled chicken/;
    const fries = "Flavoured Fries (Regular): unaffected";

    fireEvent.click(filters.getByRole("button", { name: "Affected" }));
    expect(screen.getByText("3 of 4 items")).toBeTruthy();
    expect(screen.queryByRole("link", { name: fries })).toBeNull();

    const unaffected = filters.getByRole("button", { name: "Unaffected" });
    fireEvent.click(unaffected);
    expect(unaffected.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryAllByRole("link", { name: popcorn })).toHaveLength(0);
    expect(screen.getByRole("link", { name: fries }).querySelector("img")).toBeTruthy();

    fireEvent.click(filters.getByRole("button", { name: "All" }));
    expect(screen.getByText("4 of 4 items")).toBeTruthy();
    expect(screen.getByRole("link", { name: fries }).closest("ul")?.querySelectorAll("img")).toHaveLength(4);
  });

  it("updates after a snapshot change: stale warning, then BREACH_RISK after re-assessment", () => {
    verifiedAssessed();
    renderAt("/overview");
    act(() => simulateChickenRecount(8000));
    expect(screen.getByText("Impact is stale")).toBeTruthy();
    expect(within(kpi("Confirmed orders at risk")).getByText("Pending")).toBeTruthy();
    screen.getByText("Supplier disruption demo").closest("details")!.open = true;
    fireEvent.click(screen.getByRole("button", { name: "Update impact" }));
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
    expect(getP2State().restaurant.snapshot).toMatchObject({ id: "HP-SNAP-001", revision: 1 });
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

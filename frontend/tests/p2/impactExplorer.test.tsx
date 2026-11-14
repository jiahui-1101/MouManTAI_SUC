import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../../src/app/router";
import {
  __resetP2StoreForTests,
  assessImpactAction,
  getP2State,
  simulateChickenRecount,
  simulateSupplierReport,
} from "../../src/services/mock/restaurantStore";
import { createHappyPotatoSeedSnapshot, HP_IDS } from "../../src/data/fixtures/happyPotato";
import { buildImpactGraph, connectedNodeIds } from "../../src/features/impact/graph";
import { buildP3Handoff, buildP4Handoff, buildP5Handoff } from "../../src/features/impact/handoff";
import { overviewCounts } from "../../src/features/incidents/model";
import { reviseSnapshot } from "../../src/services/mock/restaurantState";

beforeEach(() => __resetP2StoreForTests(() => new Date("2026-11-21T01:05:00Z")));
afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function verifiedAssessed() {
  act(() => {
    simulateSupplierReport("WHATSAPP", "VERIFIED");
    assessImpactAction(HP_IDS.incident);
  });
}

const dd = (scope: HTMLElement, label: string) => within(scope).getByText(label).nextElementSibling?.textContent;

describe("dependency graph model", () => {
  const graph = buildImpactGraph(createHappyPotatoSeedSnapshot(), HP_IDS.po, HP_IDS.chicken);
  const node = (id: string) => graph.nodes.find((n) => n.id === id)!;

  it("uses only fixture relationships", () => {
    expect(graph.edges).toContainEqual({ from: "supplier:HP-SUP-001", to: "po:HP-PO-1042", relation: "supplies" });
    expect(graph.edges).toContainEqual({ from: "po:HP-PO-1042", to: "ingredient:HP-ING-CHICKEN", relation: "planned incoming" });
    expect(graph.edges.filter((e) => e.from === "ingredient:HP-ING-CHICKEN").map((e) => e.to).sort()).toEqual([
      "recipe:HP-MENU-CP", "recipe:HP-MENU-CT", "recipe:HP-MENU-HC",
    ]);
    // fries-only menu never connected to chicken
    expect(graph.edges.some((e) => e.from === "ingredient:HP-ING-CHICKEN" && e.to === "recipe:HP-MENU-FR")).toBe(false);
    expect(graph.edges.some((e) => e.from === "menu:HP-MENU-FR" && e.to === "station:HP-FRY-CH-A")).toBe(false);
    // no supplier invented for fries (no fries PO in fixture)
    expect(graph.nodes.filter((n) => n.kind === "supplier").map((n) => n.id)).toEqual(["supplier:HP-SUP-001"]);
  });

  it("marks affected vs unaffected from the BOM", () => {
    expect(node("menu:HP-MENU-CP").status).toBe("AFFECTED");
    expect(node("menu:HP-MENU-CT").status).toBe("AFFECTED");
    expect(node("menu:HP-MENU-HC").status).toBe("AFFECTED");
    expect(node("menu:HP-MENU-FR").status).toBe("UNAFFECTED");
    expect(node("po:HP-PO-1042").status).toBe("DISRUPTED");
    expect(node("station:HP-FRY-FRIES-A").status).toBe("UNAFFECTED");
  });

  it("connected nodes follow both directions without crossing to unrelated items", () => {
    const fromFries = connectedNodeIds(graph, "menu:HP-MENU-FR");
    expect(fromFries.has("ingredient:HP-ING-FRIES")).toBe(true);
    expect(fromFries.has("ingredient:HP-ING-CHICKEN")).toBe(false);
    expect(fromFries.has("po:HP-PO-1042")).toBe(false);
    const fromPo = connectedNodeIds(graph, "po:HP-PO-1042");
    expect(fromPo.has("menu:HP-MENU-HC")).toBe(true);
    expect(fromPo.has("menu:HP-MENU-FR")).toBe(false);
  });

  it("missing recipe makes the menu UNKNOWN, not unaffected", () => {
    const snap = createHappyPotatoSeedSnapshot();
    snap.recipes = snap.recipes.filter((r) => r.menuId !== "HP-MENU-CT");
    const g = buildImpactGraph(snap, HP_IDS.po, HP_IDS.chicken);
    expect(g.nodes.find((n) => n.id === "menu:HP-MENU-CT")?.status).toBe("UNKNOWN");
  });
});

describe("P3 / P4 / P5 handoff contracts", () => {
  it("are not ready before verification and assessment", () => {
    expect(buildP3Handoff(getP2State().restaurant, HP_IDS.incident).ready).toBe(false);
    act(() => void simulateSupplierReport("WHATSAPP", "VERIFIED"));
    const p4 = buildP4Handoff(getP2State().restaurant, HP_IDS.incident);
    expect(p4.ready).toBe(false);
  });

  it("share one snapshot and carry canonical values", () => {
    verifiedAssessed();
    const state = getP2State().restaurant;
    const p3 = buildP3Handoff(state, HP_IDS.incident);
    const p4 = buildP4Handoff(state, HP_IDS.incident);
    const p5 = buildP5Handoff(state, HP_IDS.incident);
    if (!p3.ready || !p4.ready || !p5.ready) throw new Error("handoffs should be ready");
    expect(p3.payload.snapshot).toEqual(p4.payload.snapshot);
    expect(p4.payload.snapshot).toEqual(p5.payload.snapshot);
    expect(p3.payload).toMatchObject({
      ingredientId: HP_IDS.chicken,
      requiredSpec: "CHILLED",
      poShortfallKgMilli: 20000,
      forecastRequirementKgMilli: 22000,
      forecastGapKgMilli: 12000,
      confirmedRequirementKgMilli: 8750,
      physicalEligibleKgMilli: 10000,
      requiredByLocal: "10:45",
    });
    expect(p3.payload.menuDependencies.map((m) => m.menuId)).toEqual(["HP-MENU-CP", "HP-MENU-CT", "HP-MENU-HC"]);
    expect(p4.payload.eligibleStock).toEqual([{ lotId: "HP-LOT-CH-001", onHandMilli: 10000, availableAtLocal: "09:00" }]);
    expect(p4.payload.confirmedReservations.reduce((s, r) => s + r.ingredientMilli, 0)).toBe(8750);
    expect(p4.payload.confirmedReservations).toHaveLength(9);
    expect(p5.payload.confirmedFulfilment).toBe("CONDITIONAL");
    expect(p5.payload.evidenceRefs).toContain("sim:whatsapp:001");
    expect(p5.payload.dataMode).toBe("SYNTHETIC_BUSINESS");
  });

  it("become not-ready (stale) after a material snapshot change", () => {
    verifiedAssessed();
    act(() => simulateChickenRecount(8000));
    const p3 = buildP3Handoff(getP2State().restaurant, HP_IDS.incident);
    expect(p3.ready).toBe(false);
    if (!p3.ready) expect(p3.reason).toMatch(/stale/);
  });

  it("P4 handoff excludes quarantined stock and P2 stock is not changed by a future plan", () => {
    verifiedAssessed();
    const before = getP2State().restaurant.snapshot.ingredientLots.map((l) => l.onHandMilli);
    const state = reviseSnapshot(getP2State().restaurant, "test", (d) => {
      d.ingredientLots.push({ id: "HP-LOT-CH-Q", ingredientId: HP_IDS.chicken, onHandMilli: 4000, unit: "kg", accepted: true, quarantined: true, availableAtLocal: "09:00" });
    });
    expect(getP2State().restaurant.snapshot.ingredientLots.map((l) => l.onHandMilli)).toEqual(before);
    expect(state.snapshot.revision).toBe(getP2State().restaurant.snapshot.revision + 1);
  });
});

describe("confirmed-order labels", () => {
  it("zero ingredient deficit is reported as conditional fulfilment, not success", () => {
    verifiedAssessed();
    const metric = overviewCounts(getP2State().restaurant).confirmedOrdersAtRisk;
    expect(metric).toMatchObject({ kind: "conditional", value: 0, qualifier: "Fulfilment conditional" });
    renderAt("/overview");
    expect(screen.getByText("Fulfilment conditional")).toBeTruthy();
  });

  it("8 kg recount turns coverage into a deficit and breach risk", () => {
    verifiedAssessed();
    act(() => {
      simulateChickenRecount(8000);
      assessImpactAction(HP_IDS.incident);
    });
    renderAt("/impact");
    const coverage = screen.getAllByLabelText("Confirmed order coverage")[0]!;
    expect(within(coverage).getByText("Deficit 0.75 kg")).toBeTruthy();
    expect(within(coverage).getByText("Breach risk")).toBeTruthy();
    expect(screen.getAllByText("BREACH_RISK").length).toBe(9);
  });
});

describe("Impact Explorer page", () => {
  it("shows an empty state and structural graph with no incident", () => {
    renderAt("/impact");
    expect(screen.getByText("No supply incident to explore")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Menu item: Chicken Popcorn/ })).toBeTruthy();
  });

  it("withholds quantified impact for an unverified incident", () => {
    act(() => void simulateSupplierReport("TELEGRAM", "PENDING"));
    renderAt("/impact");
    expect(screen.getByText("Impact withheld — incident not verified")).toBeTruthy();
    expect(screen.queryByText("Before vs after the supplier claim")).toBeNull();
    expect(screen.getByText("Claim not applied yet")).toBeTruthy();
    expect(screen.getByText("Plan A · External supplier").closest("[aria-disabled=true]")).toBeTruthy();
  });

  it("renders canonical before/after and inventory values", () => {
    verifiedAssessed();
    renderAt("/impact");
    const ba = screen.getByText("Before vs after the supplier claim").closest("section")!;
    fireEvent.click(within(ba).getByRole("button", { name: "Show details: Before the claim" }));
    const before = within(ba).getByLabelText("Details: Before the claim");
    expect(dd(before, "Planned PO incoming")).toBe("20kg");
    expect(dd(before, "Total supply")).toBe("30kg");
    expect(dd(before, "Physical on hand")).toBe("10kg");
    fireEvent.click(within(ba).getByRole("button", { name: "Show details: After the claim" }));
    const after = within(ba).getByLabelText("Details: After the claim");
    expect(dd(after, "Supplier-claimed today")).toBe("0kg");
    expect(dd(after, "Total supply")).toBe("10kg");
    expect(dd(after, "Forecast need")).toBe("22kg");
    expect(dd(after, "Missing")).toBe("12kg");
    expect(dd(after, "Physical on hand")).toBe("10kg");
    const inv = screen.getByText("Inventory impact · chilled chicken").closest("section")!;
    expect(within(inv).getByText("Available after protecting confirmed").parentElement?.textContent).toContain("1.25kg");
  });

  it("menu table totals and fries unaffected", () => {
    verifiedAssessed();
    renderAt("/impact");
    const table = screen.getByText("Menu items and chilled chicken requirement").closest("table")!;
    const total = within(table).getByText("Chicken-bearing total").closest("tr")!;
    expect(total.textContent).toContain("150");
    expect(total.textContent).toContain("60");
    expect(total.textContent).toContain("22kg");
    expect(total.textContent).toContain("8.75kg");
    expect(total.textContent).toContain("gap 12kg");
    expect(within(table).getByText("Unaffected — no chicken in BOM")).toBeTruthy();
  });

  it("node selection opens details, highlights relationships, and can be reset", () => {
    verifiedAssessed();
    const router = renderAt("/impact");
    fireEvent.click(screen.getByRole("button", { name: /Purchase order: HP-PO-1042/ }));
    const detail = screen.getByLabelText("Details for HP-PO-1042");
    expect(dd(detail, "State")).toBe("SUPPLIER_CLAIMED_UNAVAILABLE_TODAY");
    expect(router.state.location.search).toContain("node=po%3AHP-PO-1042");
    const fries = screen.getByRole("button", { name: /Menu item: Flavoured Fries/ });
    expect(fries.className).toContain("p2-node--dim");
    // navigate a dependency level from the detail panel
    fireEvent.click(within(detail).getByRole("button", { name: "Chilled chicken" }));
    expect(screen.getByLabelText("Details for Chilled chicken")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Reset selection/ }));
    expect(screen.getByText(/No node selected/)).toBeTruthy();
    expect(screen.queryByLabelText(/Details for/)).toBeNull();
  });

  it("selecting a menu row inspects its BOM; demand node lists confirmed groups", () => {
    verifiedAssessed();
    renderAt("/impact");
    const table = screen.getByText("Menu items and chilled chicken requirement").closest("table")!;
    fireEvent.click(within(table).getByRole("button", { name: "Happy Combo — Chicken Popcorn" }));
    const detail = screen.getByLabelText("Details for Happy Combo — Chicken Popcorn");
    expect(dd(detail, "HP-ING-CHICKEN")).toBe("0.1kg per portion");
    expect(dd(detail, "HP-ING-FRIES")).toBe("0.18kg per portion");
    fireEvent.click(screen.getByRole("button", { name: /Orders & forecast: 20 confirmed · 50 forecast/ }));
    const demand = screen.getByLabelText("Details for 20 confirmed · 50 forecast");
    expect(within(demand).getByText("HP-ORD-HC-01")).toBeTruthy();
  });

  it("filter dims non-matching nodes and the table alternative lists relationships", () => {
    verifiedAssessed();
    renderAt("/impact");
    fireEvent.click(screen.getByRole("button", { name: "Unaffected" }));
    expect(screen.getByRole("button", { name: /Menu item: Chicken Tenders/ }).className).toContain("p2-node--dim");
    expect(screen.getByRole("button", { name: /Menu item: Flavoured Fries/ }).className).not.toContain("p2-node--dim");
    fireEvent.click(screen.getByRole("button", { name: "Show as table" }));
    const rel = screen.getByText(/accessible alternative to the graph/).closest("table")!;
    expect(within(rel).getAllByRole("row").length).toBeGreaterThan(15);
  });

  it("ingredient selector focuses the ingredient node", () => {
    verifiedAssessed();
    renderAt("/impact");
    fireEvent.change(screen.getByLabelText("Ingredient"), { target: { value: "HP-ING-FRIES" } });
    expect(screen.getByLabelText("Details for Frozen potato fries")).toBeTruthy();
  });

  it("recovery CTAs enable only when impact is current; stale disables them", () => {
    verifiedAssessed();
    renderAt("/impact");
    expect(screen.getByRole("link", { name: /Plan A · External supplier/ }).getAttribute("href")).toBe("/recovery/plan-a");
    expect(screen.getByRole("link", { name: /Plan B · Internal recovery/ }).getAttribute("href")).toBe("/recovery/plan-b");
    expect(screen.getByText("Compare recovery plans").closest("[aria-disabled=true]")).toBeTruthy();
    expect(screen.getByRole("link", { name: /View incident/ }).getAttribute("href")).toBe("/incidents?incident=HP-INC-001");
    act(() => simulateChickenRecount(8000));
    expect(screen.getByText("Impact is stale")).toBeTruthy();
    expect(screen.getByText("Plan A · External supplier").closest("[aria-disabled=true]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Re-assess impact" }));
    expect(screen.getByRole("link", { name: /Plan A · External supplier/ })).toBeTruthy();
  });

  it("evidence details are expandable and simulated messages are tagged", () => {
    act(() => {
      simulateSupplierReport("WHATSAPP", "VERIFIED");
      simulateSupplierReport("OUTLOOK", "VERIFIED");
    });
    renderAt("/impact");
    const summary = screen.getByText("Evidence details (2 linked messages)");
    fireEvent.click(summary);
    expect(screen.getAllByText("Simulated channel")).toHaveLength(2);
    expect(screen.queryByText(/^Live channel$/i)).toBeNull();
  });
});

describe("keyboard focus", () => {
  it("incident drawer returns focus to the opener after Escape", () => {
    verifiedAssessed();
    renderAt("/incidents");
    const opener = screen.getByRole("button", { name: "View details" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement?.id).toBe("incident-detail-title");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "View details" }));
  });
});

describe("cross-page consistency", () => {
  it("overview, incidents and impact agree on IDs, snapshot and quantities", () => {
    verifiedAssessed();
    const { snapshot } = getP2State().restaurant;
    const rev = `${snapshot.id} · r${snapshot.revision}`;

    renderAt("/overview");
    expect(screen.getAllByText(rev).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Open incident" }).getAttribute("href")).toBe("/incidents?incident=HP-INC-001");
    fireEvent.click(screen.getByRole("button", { name: "Show details: PO shortage" }));
    expect(dd(document.body, "Reported shortage")).toBe("20kg");
    fireEvent.click(screen.getByRole("button", { name: "Show details: On-hand stock" }));
    expect(dd(document.body, "Physical on hand")).toBe("10kg");
    cleanup();

    renderAt("/incidents?incident=HP-INC-001");
    const dialog = screen.getByRole("dialog", { name: "HP-INC-001" });
    fireEvent.click(within(dialog).getByRole("tab", { name: /^Impact/ }));
    expect(dd(dialog, "Supplier PO change")).toBe("20kg");
    expect(dd(dialog, "Forecast ingredient gap")).toBe("12kg");
    fireEvent.click(within(dialog).getByRole("tab", { name: /^History/ }));
    expect(within(dialog).getByText(`${snapshot.id} · r${snapshot.revision}`)).toBeTruthy();
    cleanup();

    renderAt("/impact");
    expect(screen.getAllByText(rev).length).toBeGreaterThan(0);
    const context = screen.getByText("Incident context").closest("section")!;
    fireEvent.click(within(context).getByRole("button", { name: "Show details: PO shortage" }));
    expect(dd(context, "Reported shortage")).toBe("20kg");
    const comparison = screen.getByText("Before vs after the supplier claim").closest("section")!;
    fireEvent.click(within(comparison).getByRole("button", { name: "Show details: After the claim" }));
    expect(dd(comparison, "Missing")).toBe("12kg");
  });

  it("state is preserved when navigating between P2 pages", () => {
    verifiedAssessed();
    const router = renderAt("/overview");
    act(() => void router.navigate("/impact"));
    expect(screen.getByText("Before vs after the supplier claim")).toBeTruthy();
    act(() => void router.navigate("/incidents"));
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});

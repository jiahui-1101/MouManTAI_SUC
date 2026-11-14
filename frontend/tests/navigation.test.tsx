import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { PAGE_ROUTES, routes } from "../src/app/router";
import { NAV_ITEMS } from "../src/constants/navigation";

afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

function heading() {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

describe("route configuration", () => {
  it("has exactly one page route per navigation item", () => {
    expect(Object.keys(PAGE_ROUTES).sort()).toEqual(NAV_ITEMS.map((item) => item.path).sort());
  });
});

/** Routes whose pages have been implemented; all others must still be empty shells. */
const IMPLEMENTED = new Set(["/overview", "/incidents", "/impact", "/recovery/plan-a", "/recovery/plan-b", "/prep-planning"]);

describe("pages", () => {
  it.each(NAV_ITEMS.map((item) => [item.path, item.title]))("%s shows heading %s", (path, title) => {
    renderAt(path);
    expect(heading()).toBe(title);
  });

  it.each(NAV_ITEMS.filter((item) => !IMPLEMENTED.has(item.path)).map((item) => [item.path]))(
    "%s is still an empty page shell",
    (path) => {
      renderAt(path);
      const body = screen.getByTestId("page-body");
      expect(body.childElementCount).toBe(0);
      expect(body.textContent).toBe("");
    },
  );

  it("shows the Plan A waiting workspace rather than an empty shell", () => {
    renderAt("/recovery/plan-a");
    expect(screen.getByText("External supply workspace is waiting")).toBeTruthy();
  });

  it("shows the Plan B allocation and menu proposal", () => {
    renderAt("/recovery/plan-b");
    expect(heading()).toBe("Plan B — Internal Recovery");
    expect(screen.getByRole("tab", { name: "Stock Allocation" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Order Protection" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Menu Recovery" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /View Prep Planning/ }).getAttribute("href")).toBe("/prep-planning");
  });

  it("recalculates stock across tabs and resets to the canonical demo", async () => {
    renderAt("/recovery/plan-b");
    fireEvent.click(screen.getByRole("button", { name: "8.00 kg" }));
    expect(screen.getByText("Confirmed demand is under-provisioned")).toBeTruthy();
    expect(screen.getByText(/0.75 kg shortfall/)).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Order Protection" }));
    expect(within(screen.getByRole("tabpanel", { name: "Order Protection" })).getAllByText("At risk · review").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Menu Recovery" }));
    expect(screen.getAllByText("At risk").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Stock Allocation" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset Demo" }));
    expect(within(screen.getByRole("region", { name: "Plan B summary" })).getByText("10.00 kg", { selector: "strong" })).toBeTruthy();
    expect(screen.getByText("Plan Feasible*")).toBeTruthy();
  });

  it("shows prep and lets the manager inspect the tenders batch", () => {
    renderAt("/prep-planning");
    expect(heading()).toBe("Prep Planning");
    const batch = screen.getByRole("button", { name: /Chicken Tenders, 15 Confirmed/ });
    fireEvent.click(batch);
    expect(batch.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "HP-BATCH-B-03 · Chicken Tenders" })).toBeTruthy();
  });

  it("shows the product name", () => {
    renderAt("/overview");
    const header = within(screen.getByRole("banner", { name: "Recovery+ portal" }));
    for (const label of ["FeedMe Portal", "Recovery+", "Powered by MouManTAI", "Concept integration", "Synthetic data"]) {
      expect(header.getByText(label, { exact: true })).toBeTruthy();
    }
    expect(header.getByText(/Happy Potato — Demo Outlet/)).toBeTruthy();
  });

  it("redirects / to /overview", () => {
    const router = renderAt("/");
    expect(router.state.location.pathname).toBe("/overview");
    expect(heading()).toBe("Overview");
  });

  it("shows Not Found for unknown routes", () => {
    renderAt("/does-not-exist");
    expect(heading()).toBe("Page not found");
  });
});

describe("navigation", () => {
  it("hides a collapsed group and restores its named links on expansion", () => {
    renderAt("/overview");
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    const disclosure = nav.getByRole("button", { name: "System" });
    const list = document.getElementById(disclosure.getAttribute("aria-controls") ?? "");
    expect(nav.getByRole("link", { name: "Channel Connections" })).toBeTruthy();
    fireEvent.click(disclosure);
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    expect(list?.hasAttribute("hidden")).toBe(true);
    expect(nav.queryByRole("link", { name: "Channel Connections" })).toBeNull();
    fireEvent.click(disclosure);
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    expect(nav.getByRole("link", { name: "Channel Connections" })).toBeTruthy();
  });

  it("can collapse the active group and opens it again when navigation returns", async () => {
    const router = renderAt("/settings");
    const nav = within(screen.getByRole("navigation", { name: "Main navigation" }));
    const disclosure = nav.getByRole("button", { name: "System" });
    const settings = nav.getByRole("link", { name: "Settings" });
    expect(settings.getAttribute("aria-current")).toBe("page");
    fireEvent.click(disclosure);
    expect(nav.queryByRole("link", { name: "Settings" })).toBeNull();
    await act(() => router.navigate("/overview"));
    await act(() => router.navigate(-1));
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    expect(nav.getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBe("page");
  });

  it("links every navigation item to its route", () => {
    renderAt("/overview");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(NAV_ITEMS.map((item) => item.path));
  });

  it("navigates on click, highlights the active item, and supports back/forward", async () => {
    const router = renderAt("/overview");
    const nav = screen.getByRole("navigation", { name: "Main navigation" });

    fireEvent.click(nav.querySelector('a[href="/recovery/plan-a"]')!);
    expect(await screen.findByRole("heading", { name: "Plan A — Supplier Recovery" })).toBeTruthy();
    const active = nav.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute("href")).toBe("/recovery/plan-a");
    expect(active?.className).toContain("nav__link--active");
    expect(nav.querySelectorAll('a[aria-current="page"]').length).toBe(1);

    await router.navigate(-1);
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy();
    expect(nav.querySelector('a[aria-current="page"]')?.getAttribute("href")).toBe("/overview");

    await router.navigate(1);
    expect(await screen.findByRole("heading", { name: "Plan A — Supplier Recovery" })).toBeTruthy();
  });
});

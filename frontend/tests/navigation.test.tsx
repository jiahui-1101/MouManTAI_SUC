import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { PAGE_ROUTES, routes } from "../src/app/router";
import { NAV_ITEMS } from "../src/constants/navigation";

afterEach(cleanup);

/** Routes whose pages are implemented (P5: /recovery/compare, /approvals, /execution, /outcomes, /decision-memory). */
const IMPLEMENTED_PAGES = new Set([
  "/recovery/compare",
  "/approvals",
  "/execution",
  "/outcomes",
  "/decision-memory",
]);

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

describe("pages", () => {
  it.each(NAV_ITEMS.map((item) => [item.path, item.title]))(
    "%s shows heading %s and an empty body",
    (path, title) => {
      renderAt(path);
      expect(heading()).toBe(title);
      const body = screen.getByTestId("page-body");
      // Pages that have been implemented by their owning team are no longer empty placeholders.
      if (IMPLEMENTED_PAGES.has(path)) return;
      expect(body.childElementCount).toBe(0);
      expect(body.textContent).toBe("");
    },
  );

  it("shows the product name", () => {
    renderAt("/overview");
    expect(screen.getByText("MouManTAI Recovery+")).toBeTruthy();
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

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { inboxStore } from "../src/features/messaging/inboxStore";

beforeEach(() => inboxStore.reset());
afterEach(cleanup);
function renderSettings() { render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/settings"] })} />); }

describe("mock messaging settings", () => {
  it("shows the canonical synthetic supplier registry and rule summary", () => {
    renderSettings();
    for (const supplier of ["Demo Poultry Supply A", "Demo Poultry Supply B", "Demo Budget Frozen Foods", "Demo Frozen Fries Distributor"]) expect(screen.getByText(supplier)).toBeTruthy();
    expect(screen.getByText("RULE_EXTRACTION")).toBeTruthy();
    expect(screen.getByText("UNAVAILABLE · 20.000 kg expected · 0.000 kg claimed")).toBeTruthy();
    expect(screen.getByText("No credentials used or requested")).toBeTruthy();
    expect(screen.getByText(/never stores, displays, validates or requests/)).toBeTruthy();
  });

  it("updates shared demo preferences", () => {
    renderSettings();
    const unread = screen.getByRole("checkbox", { name: /Show unread messages first/ });
    const timeline = screen.getByRole("checkbox", { name: /Show processing timeline/ });
    fireEvent.click(unread);
    fireEvent.click(timeline);
    expect(inboxStore.getSnapshot().preferences).toEqual({ unreadFirst: true, showProcessingTimeline: false });
  });

  it("resets fixture messages, read state and preferences", () => {
    inboxStore.loadFixture("EMPTY");
    inboxStore.setPreference("unreadFirst", true);
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Reset demo" }));
    const state = inboxStore.getSnapshot();
    expect(state.activeFixture).toBe("REVIEW_STATES");
    expect(state.messages).toHaveLength(5);
    expect(state.preferences).toEqual({ unreadFirst: false, showProcessingTimeline: true });
  });
});

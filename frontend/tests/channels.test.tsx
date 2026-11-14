import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { inboxStore } from "../src/features/messaging/inboxStore";

beforeEach(() => inboxStore.reset());
afterEach(cleanup);

function renderChannels() { render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/channels"] })} />); }

describe("mock channel sources", () => {
  it("shows three simulated sources with fixture counts, times and scenarios", () => {
    renderChannels();
    expect(screen.getAllByText("Synthetic fixture source")).toHaveLength(3);
    expect(screen.getByText("SIMULATED_CHANNEL only")).toBeTruthy();
    for (const name of ["WhatsApp", "Outlook", "Telegram"]) expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getAllByText("SIMULATED_CHANNEL")).toHaveLength(3);
    expect(screen.getByText("Canonical outage · Unverified sender")).toBeTruthy();
  });

  it("loads core, empty and reset fixtures through the shared store", () => {
    renderChannels();
    fireEvent.click(screen.getByRole("button", { name: /Core three-channel scenario/ }));
    expect(inboxStore.getSnapshot().messages).toHaveLength(3);
    expect(screen.getByRole("status").textContent).toContain("3 messages loaded");
    fireEvent.click(screen.getByRole("button", { name: /Empty inbox/ }));
    expect(inboxStore.getSnapshot().messages).toHaveLength(0);
    expect(screen.getAllByText("No fixture event loaded")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Reset shared demo" }));
    expect(inboxStore.getSnapshot().messages).toHaveLength(5);
    expect(inboxStore.getSnapshot().activeFixture).toBe("REVIEW_STATES");
  });

  it("keeps channel counts derived from shared state", () => {
    renderChannels();
    const outlook = screen.getByRole("heading", { name: "Outlook" }).closest("article")!;
    expect(within(outlook).getByText("1")).toBeTruthy();
    const whatsapp = screen.getByRole("heading", { name: "WhatsApp" }).closest("article")!;
    expect(within(whatsapp).getByText("2")).toBeTruthy();
  });
});

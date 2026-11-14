import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { inboxStore } from "../src/features/messaging/inboxStore";

beforeEach(() => inboxStore.reset());
afterEach(cleanup);

function renderInbox() {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/inbox"] })} />);
}

describe("unified supplier inbox", () => {
  it("renders all three shared simulated channel messages and canonical extraction", () => {
    renderInbox();
    const list = screen.getByRole("region", { name: "Messages" });
    expect(within(list).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByText("Simulation only · no channels connected")).toBeTruthy();
    expect(screen.getByText("20.000 kg shortfall")).toBeTruthy();
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(screen.getByText(/shortfall is not multiplied/)).toBeTruthy();
  });

  it.each(["WhatsApp", "Outlook", "Telegram"])("filters to %s messages", (channel) => {
    renderInbox();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${channel}`) }));
    expect(within(screen.getByRole("region", { name: "Messages" })).getAllByRole("button")).toHaveLength(1);
  });

  it("searches canonical content and shows an empty state", () => {
    renderInbox();
    const search = screen.getByRole("textbox", { name: "Search messages" });
    fireEvent.change(search, { target: { value: "HP-PO-1042" } });
    expect(within(screen.getByRole("region", { name: "Messages" })).getAllByRole("button")).toHaveLength(3);
    fireEvent.change(search, { target: { value: "not in fixtures" } });
    expect(screen.getByText("No messages found")).toBeTruthy();
  });

  it("opens a message, marks it read, and shows immutable detail metadata", () => {
    renderInbox();
    fireEvent.click(screen.getByRole("button", { name: /Demo Poultry Supply A09:03 MYT/ }));
    expect(screen.getByRole("heading", { name: "HP-PO-1042 delivery update", level: 2 })).toBeTruthy();
    expect(screen.getByText("SIMULATED_CHANNEL · not live")).toBeTruthy();
    expect(screen.getByText(/Hi Happy Potato, sorry/)).toBeTruthy();
    expect(inboxStore.getSnapshot().messages.find((message) => message.id === "HP-MSG-OL-001")?.read).toBe(true);
  });
});

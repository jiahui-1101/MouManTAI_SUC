import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { inboxStore } from "../src/features/messaging/inboxStore";

beforeEach(() => inboxStore.reset());
afterEach(cleanup);

function renderInbox() {
  const router = createMemoryRouter(routes, { initialEntries: ["/inbox"] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("unified supplier inbox", () => {
  it("announces message counts and supports arrow-key selection", () => {
    renderInbox();
    expect(screen.getByText(/5 simulated messages available/)).toBeTruthy();
    const buttons = within(screen.getByRole("region", { name: "Messages" })).getAllByRole("button");
    fireEvent.keyDown(buttons[0]!, { key: "ArrowDown" });
    expect(inboxStore.getSnapshot().selectedId).toBe("HP-MSG-OL-001");
    expect(document.activeElement).toBe(buttons[1]);
  });
  it.each(["LOADING", "ERROR"] as const)("recovers from mock %s state", (status) => {
    inboxStore.setMockLoadStatus(status);
    renderInbox();
    fireEvent.click(screen.getByRole("button", { name: status === "ERROR" ? "Retry local fixture" : "Finish mock loading" }));
    expect(screen.getByRole("region", { name: "Messages" })).toBeTruthy();
  });
  it("opens an empty shared fixture without crashing", () => {
    inboxStore.loadFixture("EMPTY");
    renderInbox();
    expect(screen.getByText("No fixture messages loaded")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Choose a demo scenario" }).getAttribute("href")).toBe("/channels");
  });
  it("renders all three shared simulated channel messages and canonical extraction", () => {
    renderInbox();
    const list = screen.getByRole("region", { name: "Messages" });
    expect(within(list).getAllByRole("button")).toHaveLength(5);
    expect(screen.getByText("Simulation only · no channels connected")).toBeTruthy();
    expect(screen.getByText("20.000 kg")).toBeTruthy();
    expect(screen.getByText("Unknown")).toBeTruthy();
    expect(screen.getByText(/shortfall is not multiplied/)).toBeTruthy();
    expect(screen.getByText("1 duplicate suppressed")).toBeTruthy();
  });

  it.each([["WhatsApp", 2], ["Outlook", 1], ["Telegram", 2]])("filters to %s messages", (channel, count) => {
    renderInbox();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${channel}`) }));
    expect(within(screen.getByRole("region", { name: "Messages" })).getAllByRole("button")).toHaveLength(count as number);
  });

  it("searches canonical content and shows an empty state", () => {
    renderInbox();
    const search = screen.getByRole("textbox", { name: "Search messages" });
    fireEvent.change(search, { target: { value: "HP-PO-1042" } });
    expect(within(screen.getByRole("region", { name: "Messages" })).getAllByRole("button")).toHaveLength(4);
    fireEvent.change(search, { target: { value: "not in fixtures" } });
    expect(screen.getByText("No messages found")).toBeTruthy();
  });

  it("opens a message, marks it read, and shows immutable detail metadata", () => {
    renderInbox();
    fireEvent.click(screen.getByRole("button", { name: /Demo Poultry Supply A09:03 MYT/ }));
    expect(screen.getByRole("heading", { name: "HP-PO-1042 delivery update", level: 2 })).toBeTruthy();
    const detail = screen.getByRole("article", { name: "Selected message" });
    expect(within(detail).getByText(/SIMULATED_CHANNEL/)).toBeTruthy();
    expect(within(detail).getByText(/Hi Happy Potato, sorry/)).toBeTruthy();
    expect(inboxStore.getSnapshot().messages.find((message) => message.id === "HP-MSG-OL-001")?.read).toBe(true);
  });

  it("renders unverified and unmatched canonical states without publishing an incident", () => {
    renderInbox();
    fireEvent.click(screen.getByRole("button", { name: /Unknown demo contact09:09 MYT/ }));
    expect(screen.getByText("Unmatched message.", { exact: false })).toBeTruthy();
    expect(screen.getByText("Human review required.", { exact: false })).toBeTruthy();
    expect(screen.getByText("No matched PO")).toBeTruthy();
    expect(screen.getByText("Not linked")).toBeTruthy();
    expect(within(screen.getByRole("article", { name: "Selected message" })).getByText("Hi, can you call me?")).toBeTruthy();
  });

  it("navigates the selected canonical message to Message Intelligence", async () => {
    const router = renderInbox();
    fireEvent.click(screen.getByRole("link", { name: "Open in Message Intelligence" }));
    expect(router.state.location.pathname).toBe("/message-intelligence");
    expect(router.state.location.search).toBe("?message=HP-MSG-WA-001");
    expect(await screen.findByRole("heading", { name: "Message Intelligence" })).toBeTruthy();
  });
});

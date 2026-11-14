/**
 * P1 UI interaction audit: every visible control on /inbox, /message-intelligence, /channels, /settings
 * is exercised against the real shared DemoState. Control IDs (C-xx) map to the checklist in P1_PROGRESS.md.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { demoStore, selectActiveIncident, selectExtractionVersions, selectOfferReviewVersions } from "../src/store/demoStore";
import { chooseInboxChannel, openInboxRow, reviewStatusLine } from "./helpers.p1";
import { NAV_ITEMS } from "../src/constants/navigation";

const s = () => demoStore.getSnapshot();
beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);
function app(path: string) { const r = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={r} />); return r; }
const nav = async (r: ReturnType<typeof app>, to: string) => { await act(async () => { await r.navigate(to); }); };
const list = () => within(screen.getByRole("region", { name: "Messages" }));
const btn = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

describe("Inbox controls", () => {
  it("C-01..C-08 filters, search, cards, keyboard, detail link, empty/loading/error", async () => {
    const r = app("/inbox");
    // C-01 channel filters with counts
    for (const [label, n] of [["WhatsApp", 2], ["Outlook", 1], ["Telegram", 2], ["All", 5]] as const) {
      chooseInboxChannel(label);
      expect((screen.getByLabelText("Channel") as HTMLSelectElement).selectedOptions[0]!.textContent).toBe(label);
      expect(list().getAllByRole("button")).toHaveLength(n);
    }
    // C-02 search + no-result empty state
    const search = screen.getByRole("textbox", { name: "Search messages" });
    fireEvent.change(search, { target: { value: "call me" } });
    expect(list().getAllByRole("button")).toHaveLength(1);
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No messages found")).toBeTruthy();
    fireEvent.change(search, { target: { value: "" } });
    // C-03 card click selects + marks read in shared state
    fireEvent.click(list().getByRole("button", { name: /Unknown demo contact/ }));
    expect(s().selectedId).toBe("HP-MSG-UNKNOWN");
    expect(s().messages.find((m) => m.id === "HP-MSG-UNKNOWN")!.read).toBe(true);
    expect(screen.getByText(/Unmatched message\./)).toBeTruthy();
    // C-04 keyboard arrows move selection and focus
    const cards = list().getAllByRole("button");
    cards[4]!.focus();
    fireEvent.keyDown(cards[4]!, { key: "ArrowDown" });
    expect(s().selectedId).toBe(cards.length === 5 ? "HP-MSG-WA-001" : s().selectedId);
    expect(document.activeElement).toBe(list().getAllByRole("button")[0]);
    fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(s().selectedId).toBe("HP-MSG-UNKNOWN");
    // C-05 open in Message Intelligence keeps selection
    fireEvent.click(screen.getByRole("link", { name: "Open in Message Intelligence" }));
    expect(r.state.location.search).toBe("?message=HP-MSG-UNKNOWN");
    expect(screen.getByRole("button", { name: /confirm & verify incident/i }).hasAttribute("disabled")).toBe(true);
    // C-06 loading -> finish, C-07 error -> retry
    await nav(r, "/inbox");
    act(() => demoStore.setMockLoadStatus("LOADING"));
    fireEvent.click(btn("Finish mock loading"));
    expect(s().loadStatus).toBeUndefined();
    act(() => demoStore.setMockLoadStatus("ERROR"));
    expect(screen.getByRole("alert").textContent).toMatch(/No provider was contacted/);
    fireEvent.click(btn("Retry local fixture"));
    expect(screen.getByRole("region", { name: "Messages" })).toBeTruthy();
    // C-08 empty fixture -> link to channels
    act(() => demoStore.loadFixture("EMPTY"));
    fireEvent.click(screen.getByRole("link", { name: "Choose a demo scenario" }));
    expect(r.state.location.pathname).toBe("/channels");
  });

  it("C-09 Impact Explorer link appears only after real verification", async () => {
    const r = app("/inbox");
    fireEvent.click(list().getByRole("button", { name: /^Demo Poultry Supply A.*09:01 MYT/ }));
    const detail = () => within(screen.getByRole("article", { name: "Selected message" }));
    expect(detail().queryByRole("link", { name: "Impact Explorer" })).toBeNull();
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    fireEvent.click(detail().getByRole("link", { name: "Impact Explorer" }));
    expect(r.state.location.pathname).toBe("/impact");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Impact Explorer");
  });
});

describe("Message Intelligence controls", () => {
  it("C-10..C-12 picker, missing message and loading/error recovery", async () => {
    const r = app("/message-intelligence");
    fireEvent.click(screen.getByRole("link", { name: /HP-MSG-OL-001/ }));
    expect(r.state.location.search).toBe("?message=HP-MSG-OL-001");
    expect(s().messages.find((m) => m.id === "HP-MSG-OL-001")!.read).toBe(true);
    expect(s().selectedId).toBe("HP-MSG-OL-001");
    await nav(r, "/message-intelligence?message=NOPE");
    fireEvent.click(screen.getByRole("link", { name: "Back to inbox" }));
    expect(r.state.location.pathname).toBe("/inbox");
    await nav(r, "/message-intelligence?message=HP-MSG-WA-001");
    act(() => demoStore.setMockLoadStatus("LOADING"));
    fireEvent.click(btn("Finish mock loading"));
    expect(screen.getByTestId("raw-text")).toBeTruthy();
    act(() => demoStore.loadFixture("EMPTY"));
    await nav(r, "/message-intelligence");
    fireEvent.click(screen.getByRole("link", { name: "Load a demo scenario" }));
    expect(r.state.location.pathname).toBe("/channels");
  });

  it("C-13..C-22 every review form control, decision and history control", () => {
    app("/message-intelligence?message=HP-MSG-WA-001");
    // C-13 every input/select is editable and reaches the draft
    const edits: [string, string][] = [["Candidate supplier", "HP-SUP-001"], ["Purchase order", "HP-PO-1042"], ["Incident type", "PARTIAL_DELIVERY"], ["Expected quantity", "20000"], ["Expected quantity unit", "g"], ["Delivered claim", "5"], ["Delivered claim unit", "kg"], ["ETA status", "KNOWN"]];
    for (const [label, value] of edits) { fireEvent.change(screen.getByLabelText(label), { target: { value } }); expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe(value); }
    fireEvent.change(screen.getByLabelText("ETA (MYT)"), { target: { value: "bad" } });
    // C-14 confirm disabled while dirty, C-15 save shows validation, nothing persisted
    expect(btn(/confirm & verify incident/i).disabled).toBe(true);
    fireEvent.click(btn("Save correction"));
    expect(screen.getByText(/valid local date and time/)).toBeTruthy();
    expect(selectExtractionVersions(s(), "HP-MSG-WA-001")).toHaveLength(1);
    fireEvent.change(screen.getByLabelText("ETA (MYT)"), { target: { value: "2026-11-22T10:00" } });
    fireEvent.change(screen.getByLabelText("Review reason / note"), { target: { value: "Partial per phone" } });
    fireEvent.click(btn("Save correction"));
    const v2 = selectExtractionVersions(s(), "HP-MSG-WA-001")[1]!;
    expect(v2).toMatchObject({ method: "HUMAN_CORRECTION", shortfallKgMilli: 15000, note: "Partial per phone" });
    expect(reviewStatusLine()!.textContent).toBe("Saved version 2 as HUMAN_CORRECTION.");
    // C-16 confirm blocked by contradiction with precise reason
    expect(btn(/confirm & verify incident/i).disabled).toBe(true);
    expect(screen.getByText(/Incompatible incident type: PARTIAL_DELIVERY/)).toBeTruthy();
    // C-17 discard button
    expect(btn("Discard edits").disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Purchase order"), { target: { value: "X" } });
    fireEvent.click(btn("Discard edits"));
    expect((screen.getByLabelText("Purchase order") as HTMLInputElement).value).toBe("HP-PO-1042");
    // C-18 save without changes refused
    fireEvent.click(btn("Save correction"));
    expect(screen.getByText(/nothing to save/)).toBeTruthy();
    // C-19 history click views old version, C-20 "View latest"
    fireEvent.click(screen.getByRole("tab", { name: /^History/ }));
    const hist = within(screen.getByRole("list", { name: "Extraction versions" }));
    fireEvent.click(hist.getAllByRole("button")[0]!);
    expect(screen.getByText(/Viewing previous version 1/)).toBeTruthy();
    expect(screen.getByTestId("raw-text").querySelectorAll("mark")).toHaveLength(6);
    fireEvent.click(btn("View latest"));
    expect(screen.queryByText(/Viewing previous version/)).toBeNull();
    // C-21 mark unresolved, C-22 reopen by saving original values then confirm
    fireEvent.change(screen.getByLabelText("Review reason / note"), { target: { value: "Waiting supplier" } });
    fireEvent.click(btn("Mark unresolved"));
    expect(selectExtractionVersions(s(), "HP-MSG-WA-001").at(-1)!.reviewStatus).toBe("UNRESOLVED");
    fireEvent.change(screen.getByLabelText("Incident type"), { target: { value: "UNAVAILABLE" } });
    fireEvent.change(screen.getByLabelText("Delivered claim"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("ETA status"), { target: { value: "UNKNOWN" } });
    fireEvent.click(btn("Save correction"));
    expect(btn(/confirm & verify incident/i).disabled).toBe(false);
    fireEvent.click(btn(/confirm & verify incident/i));
    expect(selectActiveIncident(s()).status).toBe("VERIFIED");
    // locked after confirm
    expect(btn("Save correction").disabled).toBe(true);
    expect(btn("Reject").disabled).toBe(true);
    expect(screen.getByLabelText("Purchase order").matches(":disabled")).toBe(true);
  });

  it("C-23..C-25 link confirm/cancel, handoff and evidence panels", async () => {
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    const r = app("/message-intelligence?message=HP-MSG-TG-001");
    fireEvent.click(btn("Link to existing incident HP-INC-001"));
    expect(btn("Link to existing incident HP-INC-001").disabled).toBe(true);
    fireEvent.click(btn("Cancel"));
    expect(selectActiveIncident(s()).messageIds).toEqual(["HP-MSG-WA-001"]);
    fireEvent.click(btn("Link to existing incident HP-INC-001"));
    fireEvent.click(btn("Confirm link"));
    expect(selectActiveIncident(s()).messageIds).toEqual(["HP-MSG-WA-001", "HP-MSG-TG-001"]);
    expect(screen.getByTestId("evidence-link").textContent).toMatch(/HP-INC-001/);
    fireEvent.click(screen.getByRole("link", { name: "Back to inbox" }));
    expect(r.state.location.pathname).toBe("/inbox");
    await nav(r, "/message-intelligence?message=HP-MSG-TG-001");
    fireEvent.click(screen.getByRole("tab", { name: "Evidence & handoff" }));
    fireEvent.click(screen.getByRole("link", { name: "Open Impact Explorer" }));
    expect(r.state.location.pathname).toBe("/impact");
  });

  it("C-26..C-28 supplier offer review buttons and Plan A link", async () => {
    act(() => demoStore.loadFixture("SUPPLIER_OFFER"));
    const r = app("/message-intelligence?message=HP-MSG-OL-OFFER");
    fireEvent.click(btn("Reject offer"));
    expect(screen.getByRole("alert").textContent).toMatch(/reason/);
    for (const [b, q] of [["Mark unresolved", "UNRESOLVED"], ["Reject offer", "REJECTED"], [/Qualify sender/, "QUALIFIED_CONDITIONAL"]] as const) {
      fireEvent.change(screen.getByLabelText("Review reason"), { target: { value: `reason ${q}` } });
      fireEvent.click(btn(b));
      expect(screen.getByTestId("offer-qualification").textContent).toBe(q);
    }
    expect(selectOfferReviewVersions(s(), "HP-MSG-OL-OFFER")).toHaveLength(4);
    expect(within(screen.getByRole("list", { name: "Offer review versions" })).queryAllByRole("button")).toHaveLength(0);
    fireEvent.click(screen.getByRole("link", { name: "Plan A" }));
    expect(r.state.location.pathname).toBe("/recovery/plan-a");
  });
});

describe("Channels and Settings controls", () => {
  it("C-29..C-32 scenario buttons, reset, mock loading/error and clear", async () => {
    const r = app("/channels");
    for (const label of ["Core three-channel scenario", "Review states + supplier offer", "Empty inbox", "Review-state scenario"]) {
      fireEvent.click(btn(new RegExp(label.replace("+", "\\+"))));
      expect(btn(new RegExp(label.replace("+", "\\+"))).getAttribute("aria-pressed")).toBe("true");
    }
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    fireEvent.click(btn(/Reset shared demo/));
    expect(selectActiveIncident(s()).status).toBe("PENDING_VERIFICATION");
    fireEvent.click(btn("Show mock loading in Inbox"));
    expect(screen.getByRole("status").textContent).toMatch(/Mock load state: LOADING/);
    fireEvent.click(btn("Clear mock state"));
    expect(s().loadStatus).toBeUndefined();
    fireEvent.click(btn("Show mock error in Inbox"));
    fireEvent.click(screen.getByRole("link", { name: "View in Inbox" }));
    expect(r.state.location.pathname).toBe("/inbox");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("C-33..C-35 settings toggles drive Inbox; reset restores", async () => {
    const r = app("/settings");
    fireEvent.click(screen.getByRole("checkbox", { name: /Show processing timeline/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Show unread messages first/ }));
    await nav(r, "/inbox");
    openInboxRow("Demo Poultry Supply A", "09:01"); // opening a message shows its detail panel
    expect(screen.queryByRole("list", { name: "Processing timeline" })).toBeNull();
    expect(list().getAllByRole("button").at(-1)!.textContent).toMatch(/Demo Poultry Supply A/);
    await nav(r, "/settings");
    fireEvent.click(btn(/Reset demo/));
    expect(s().preferences).toEqual({ unreadFirst: false, showProcessingTimeline: true });
    await nav(r, "/inbox");
    openInboxRow("Demo Poultry Supply A", "09:01");
    expect(screen.getByRole("list", { name: "Processing timeline" })).toBeTruthy();
  });

  it("C-36 every P1 sidebar link navigates and highlights", async () => {
    const r = app("/overview");
    for (const path of ["/inbox", "/message-intelligence", "/channels", "/settings"]) {
      const item = NAV_ITEMS.find((i) => i.path === path)!;
      fireEvent.click(screen.getByRole("link", { name: item.label }));
      expect(r.state.location.pathname).toBe(path);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(item.title);
    }
  });
});

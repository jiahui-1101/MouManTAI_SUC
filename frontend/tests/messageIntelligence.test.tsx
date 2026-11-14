import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { demoStore, selectExtractionVersions } from "../src/store/demoStore";
import { CANONICAL_MESSAGE } from "../src/features/messaging/mockMessageRegistry";
import { confirmBlockers, ruleExtractionVersion, validateDraft, draftFromValues } from "../src/features/messaging/messageReview";

beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
const open = (id = "HP-MSG-WA-001") => renderAt(`/message-intelligence?message=${id}`);
const confirmButton = () => screen.getByRole("button", { name: /confirm & verify incident/i }) as HTMLButtonElement;
const versions = (id = "HP-MSG-WA-001") => selectExtractionVersions(demoStore.getSnapshot(), id);

describe("Message Intelligence page", () => {
  it("shows empty, missing, loading and error states", () => {
    const router = renderAt("/message-intelligence");
    // No ?message: the review queue opens the shared selection instead of an empty picker.
    expect(router.state.location.search).toBe("?message=HP-MSG-WA-001");
    expect(screen.getByTestId("raw-text")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open review HP-MSG-OL-001/ })).toBeTruthy();
    cleanup();
    open("HP-MSG-NOPE");
    expect(screen.getByRole("alert").textContent).toContain("HP-MSG-NOPE");
    cleanup();
    act(() => demoStore.setMockLoadStatus("LOADING"));
    open();
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    act(() => demoStore.setMockLoadStatus("ERROR"));
    fireEvent.click(screen.getByRole("button", { name: /retry local fixture/i }));
    expect(screen.getByText("Rule-based extraction — no AI model used.")).toBeTruthy();
  });

  it("renders immutable raw text with exact evidence offsets and extracted fields", () => {
    open();
    const raw = screen.getByTestId("raw-text");
    expect(raw.textContent).toBe(CANONICAL_MESSAGE);
    const marks = raw.querySelectorAll("mark");
    expect(marks).toHaveLength(6);
    marks.forEach((mark) => {
      const start = Number(mark.getAttribute("data-start"));
      const end = Number(mark.getAttribute("data-end"));
      expect(CANONICAL_MESSAGE.slice(start, end)).toBe(mark.textContent);
    });
    expect(raw.querySelector('[data-field="claimedDeliveryKgMilli"]')?.textContent).toBe("0kg");
    const fields = screen.getByRole("region", { name: /structured extraction/i });
    for (const text of ["HP-SUP-001 · Demo Poultry Supply A", "HP-PO-1042", "MATCHED", "UNAVAILABLE", "20.000 kg", "0.000 kg"]) expect(within(fields).getAllByText(new RegExp(text)).length).toBeGreaterThan(0);
    expect(within(fields).getByText(/UNKNOWN \(update promise/)).toBeTruthy();
    expect(within(fields).getByText("Rule extraction is pending explicit human confirmation.")).toBeTruthy();
  });

  it("validates quantities, units, PO/supplier relationship and contradictions without saving", () => {
    open();
    fireEvent.change(screen.getByLabelText("Expected quantity"), { target: { value: "-5" } });
    fireEvent.change(screen.getByLabelText("Delivered claim unit"), { target: { value: "L" } });
    fireEvent.change(screen.getByLabelText("Candidate supplier"), { target: { value: "HP-SUP-002" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    expect(screen.getByText("Expected quantity must be a nonnegative number.")).toBeTruthy();
    expect(screen.getByText(/unit L is not compatible/)).toBeTruthy();
    expect(screen.getByText("HP-PO-1042 belongs to HP-SUP-001, not HP-SUP-002.")).toBeTruthy();
    expect(screen.getByText("Validation failed. Nothing was saved.")).toBeTruthy();
    expect(versions()).toHaveLength(1);
    const base = draftFromValues(ruleExtractionVersion({ id: "x", rawText: CANONICAL_MESSAGE, senderRegistryId: "HP-SUP-001" }).values);
    expect(validateDraft({ ...base, claimedQty: "5" }).errors.incidentType).toMatch(/Contradiction/);
    expect(validateDraft({ ...base, claimedQty: "25" }).errors.claimedQty).toMatch(/exceed/);
    expect(validateDraft({ ...base, poId: "HP-PO-9999" }).errors.poId).toMatch(/not in the canonical/);
    expect(validateDraft({ ...base, claimedQty: "0", claimedUnit: "g" }).values?.claimedDeliveryKgMilli).toBe(0);
  });

  it("saves a HUMAN_CORRECTION version with provenance and human assertions, keeping v1 and raw text intact", () => {
    open();
    const v1 = versions()[0]!;
    fireEvent.change(screen.getByLabelText("ETA status"), { target: { value: "KNOWN" } });
    fireEvent.change(screen.getByLabelText("ETA (MYT)"), { target: { value: "2026-11-22T10:00" } });
    fireEvent.change(screen.getByLabelText("Review reason / note"), { target: { value: "Phoned supplier" } });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    const all = versions();
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual(v1);
    expect(all[0]!.method).toBe("RULE_EXTRACTION");
    const v2 = all[1]!;
    expect(v2).toMatchObject({ version: 2, method: "HUMAN_CORRECTION", reviewStatus: "PENDING", actor: "Demo operator (demo-reviewer-01)", note: "Phoned supplier" });
    expect(Number.isNaN(Date.parse(v2.createdAtIso))).toBe(false);
    expect(v2.changedFields.map((c) => c.field)).toEqual(["etaStatus", "etaLocal"]);
    expect(v2.humanAssertedFields).toEqual(expect.arrayContaining(["etaStatus", "etaLocal"]));
    expect(v2.evidenceSpans.some((s) => s.field === "etaStatus")).toBe(false);
    v2.evidenceSpans.forEach((s) => expect(CANONICAL_MESSAGE.slice(s.start, s.end)).toBe(s.text));
    expect(Object.isFrozen(all[1])).toBe(true);
    expect(demoStore.getSnapshot().messages[0]!.rawText).toBe(CANONICAL_MESSAGE);
    expect(screen.getByText("Saved version 2 as HUMAN_CORRECTION.")).toBeTruthy();
    expect(screen.getByText("Human assertion · no source span")).toBeTruthy();
    expect(screen.getByTestId("raw-text").querySelector('[data-field="etaStatus"]')).toBeNull();
    expect(screen.getByText(/ETA UNKNOWN → KNOWN/)).toBeTruthy();
  });

  it("allows viewing previous versions and keyboard navigation through history", () => {
    act(() => { demoStore.decideExtractionReview("HP-MSG-WA-001", "MARKED_UNRESOLVED", "Need call-back", "2026-11-21T09:30:00+08:00"); });
    open();
    const history = screen.getByRole("list", { name: "Extraction versions" });
    const buttons = within(history).getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[1]!.getAttribute("aria-current")).toBe("true");
    buttons[1]!.focus();
    fireEvent.keyDown(buttons[1]!, { key: "ArrowUp" });
    expect(buttons[0]!.getAttribute("aria-current")).toBe("true");
    expect(document.activeElement).toBe(buttons[0]);
    expect(screen.getByText(/Viewing previous version 1/)).toBeTruthy();
    fireEvent.keyDown(buttons[0]!, { key: "End" });
    expect(buttons[1]!.getAttribute("aria-current")).toBe("true");
    expect(screen.getByText(/Note: Need call-back/)).toBeTruthy();
  });

  it("discards unsaved edits with Escape and blocks confirm while dirty", () => {
    open();
    expect(confirmButton().disabled).toBe(false);
    const po = screen.getByLabelText("Purchase order") as HTMLInputElement;
    fireEvent.change(po, { target: { value: "HP-PO-9" } });
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText(/Unsaved edits/)).toBeTruthy();
    fireEvent.keyDown(po, { key: "Escape" });
    expect(po.value).toBe("HP-PO-1042");
    expect(confirmButton().disabled).toBe(false);
  });

  it("disables confirmation with explicit reasons for unsafe identity, unmatched PO and unresolved evidence", () => {
    open("HP-MSG-SPOOF");
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText(/Unsafe sender identity/)).toBeTruthy();
    // A candidate supplier edit cannot override unsafe identity.
    act(() => { demoStore.saveExtractionCorrection("HP-MSG-SPOOF", { ...versions("HP-MSG-SPOOF")[0]!.values, poId: "HP-PO-1042", supplierId: "HP-SUP-001", incidentType: "UNAVAILABLE", expectedKgMilli: 20000, claimedDeliveryKgMilli: 0, etaStatus: "KNOWN", etaLocal: "2026-11-22T10:00" }); });
    expect(confirmButton().disabled).toBe(true);
    expect(() => demoStore.confirmExtractionReview("HP-MSG-SPOOF")).toThrow(/Unsafe sender identity/);
    expect(demoStore.getSnapshot().incident.status).toBe("PENDING_VERIFICATION");
    cleanup();
    open("HP-MSG-UNKNOWN");
    expect(screen.getByText(/Unmatched PO/)).toBeTruthy();
    expect(screen.getAllByText(/Unresolved evidence/).length).toBeGreaterThan(0);
    expect(confirmButton().disabled).toBe(true);
    const v = versions()[0]!;
    expect(confirmBlockers({ ...v, values: { ...v.values, supplierId: "HP-SUP-002" } }, { senderRegistryId: "HP-SUP-001", canonicalIncidentShortfallKgMilli: 20000, incidentPoId: "HP-PO-1042" }).join(" ")).toMatch(/cannot override sender identity/);
  });

  it("rejects, reopens and confirms a safe message, verifying the shared incident", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByText(/Enter a review reason/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Review reason / note"), { target: { value: "Wrong thread" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(versions()[1]!.reviewStatus).toBe("REJECTED");
    expect(confirmButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    expect(versions()[2]!.reviewStatus).toBe("PENDING");
    expect(confirmButton().disabled).toBe(false);
    fireEvent.click(confirmButton());
    const s = demoStore.getSnapshot();
    expect(versions()[3]!).toMatchObject({ reviewStatus: "VERIFIED", decision: "CONFIRMED" });
    expect(s.incident).toMatchObject({ id: "HP-INC-001", status: "VERIFIED", claimedShortfallKgMilli: 20000, messageIds: ["HP-MSG-WA-001"] });
    expect(s.messages.find((m) => m.id === "HP-MSG-WA-001")!.stage).toBe("LINKED");
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText(/Already linked to HP-INC-001/)).toBeTruthy();
  });

  it("keeps saved reviews visible after navigating away and back", async () => {
    const router = open();
    fireEvent.change(screen.getByLabelText("Review reason / note"), { target: { value: "Pending call" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark unresolved" }));
    await act(async () => { await router.navigate("/inbox"); });
    expect(screen.queryByText(/Review history/)).toBeNull();
    await act(async () => { await router.navigate("/message-intelligence?message=HP-MSG-WA-001"); });
    expect(within(screen.getByRole("list", { name: "Extraction versions" })).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText(/v2 · RULE_EXTRACTION · UNRESOLVED/)).toBeTruthy();
  });
});

describe("Review queue", () => {
  it("lists active reviews, searches, opens items and moves confirmed ones to history", () => {
    const router = renderAt("/message-intelligence");
    const queue = () => within(screen.getByRole("list", { name: "Review queue items" }));
    expect(screen.getByText("5 active")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search review queue"), { target: { value: "not allowlisted" } });
    expect(queue().getAllByRole("listitem")).toHaveLength(1);
    fireEvent.click(queue().getByRole("link", { name: /Open review HP-MSG-SPOOF/ }));
    expect(router.state.location.search).toBe("?message=HP-MSG-SPOOF");
    fireEvent.change(screen.getByLabelText("Search review queue"), { target: { value: "" } });
    fireEvent.click(queue().getByRole("link", { name: /Open review HP-MSG-WA-001/ }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & verify incident/i }));
    expect(screen.getByText("4 active")).toBeTruthy();
    expect(queue().queryByRole("link", { name: /HP-MSG-WA-001/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(queue().getByText("In incident HP-INC-001")).toBeTruthy();
    expect(queue().getByRole("link", { name: /Open review HP-MSG-WA-001/ }).getAttribute("aria-current")).toBe("page");
  });
});

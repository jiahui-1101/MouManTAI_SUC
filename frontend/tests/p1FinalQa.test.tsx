import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import pkg from "../package.json";
import { routes } from "../src/app/router";
import { demoStore, selectActiveIncident, selectExtractionVersions, selectMessagesForIncident, selectOperationalSnapshot, selectPublishedEvents, CANONICAL_MOCK_ENVELOPES } from "../src/store/demoStore";
import { inboxStore } from "../src/features/messaging/inboxStore";
import { selectIncidentEvidence, selectMessageEvidence, selectSupplierOfferEvidence } from "../src/features/messaging/evidenceSelectors";

const s = () => demoStore.getSnapshot();
beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);
function renderAt(path: string) { const r = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={r} />); return r; }

describe("P1 final QA — end-to-end offline flow", () => {
  it("Inbox → Intelligence → review → INCIDENT_VERIFIED → link, one incident, 20 kg, typed events with snapshot", async () => {
    const router = renderAt("/inbox");
    const ids = ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"];
    for (const [i, id] of ids.entries()) {
      await act(async () => { await router.navigate("/inbox"); });
      act(() => inboxStore.select(id));
      fireEvent.click(screen.getByRole("link", { name: "Open in Message Intelligence" }));
      expect(router.state.location.search).toBe(`?message=${id}`);
      if (i === 0) {
        fireEvent.click(screen.getByRole("button", { name: /confirm & verify incident/i }));
      } else {
        fireEvent.click(screen.getByRole("button", { name: "Link to existing incident HP-INC-001" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirm link" }));
      }
    }
    const inc = selectActiveIncident(s());
    expect(inc).toMatchObject({ id: "HP-INC-001", status: "VERIFIED", claimedShortfallKgMilli: 20000, messageIds: ids, snapshotId: "HP-SNAP-001" });
    expect(selectMessagesForIncident(s()).map((m) => m.stage)).toEqual(["LINKED", "LINKED", "LINKED"]);
    const verified = selectPublishedEvents(s()).filter((e) => e.type === "INCIDENT_VERIFIED");
    expect(verified).toHaveLength(3);
    expect(verified.every((e) => e.type === "INCIDENT_VERIFIED" && e.claimedShortfallKgMilli === 20000 && e.snapshotId === "HP-SNAP-001" && e.snapshotRevision === 1)).toBe(true);
    expect(verified.at(-1)).toMatchObject({ messageIds: ids });
    expect(selectOperationalSnapshot(s()).ingredientLots.find((l) => l.ingredientId === "HP-ING-CHICKEN")!.onHandMilli).toBe(10000);
    expect(selectIncidentEvidence(s(), "HP-INC-001")!.messages).toHaveLength(3);
    await act(async () => { await router.navigate("/inbox"); });
    expect(screen.getByTestId("inbox-incident-status").textContent).toMatch(/3 linked messages; the 20\.000 kg/);
  });

  it("P1-T08: human quantity change keeps raw text, increments and audits version, and blocks unsafe confirm", () => {
    const raw = s().messages[0]!.rawText;
    const v1 = selectExtractionVersions(s(), "HP-MSG-WA-001")[0]!;
    demoStore.saveExtractionCorrection("HP-MSG-WA-001", { ...v1.values, incidentType: "PARTIAL_DELIVERY", claimedDeliveryKgMilli: 5000 }, { at: "2026-11-21T09:30:00+08:00" });
    const v = selectExtractionVersions(s(), "HP-MSG-WA-001");
    expect(v[0]).toEqual(v1);
    expect(v[1]).toMatchObject({ version: 2, method: "HUMAN_CORRECTION", shortfallKgMilli: 15000 });
    expect(v[1]!.changedFields).toEqual([{ field: "incidentType", from: "UNAVAILABLE", to: "PARTIAL_DELIVERY" }, { field: "claimedDeliveryKgMilli", from: 0, to: 5000 }]);
    expect(v[1]!.humanAssertedFields).toEqual(expect.arrayContaining(["incidentType", "claimedDeliveryKgMilli"]));
    expect(s().messages[0]!.rawText).toBe(raw);
    expect(() => demoStore.confirmExtractionReview("HP-MSG-WA-001")).toThrow(/Contradictory data|Incompatible incident type/);
    expect(selectActiveIncident(s()).status).toBe("PENDING_VERIFICATION");
  });

  it("P1-T03/T09: ingestion, dedup with one notification, scenario switching and reset", () => {
    renderAt("/inbox");
    const env = CANONICAL_MOCK_ENVELOPES[0]!;
    act(() => { demoStore.loadFixture("EMPTY"); });
    expect(screen.getByText("No fixture messages loaded")).toBeTruthy();
    act(() => { expect(demoStore.ingestMockMessage(env).status).toBe("INGESTED"); });
    act(() => { expect(demoStore.ingestMockMessage(env).status).toBe("DUPLICATE"); });
    expect(s().messages).toHaveLength(1);
    expect(screen.getAllByText(/1 simulated messages available/)).toHaveLength(1);
    expect(screen.getByText("1 duplicate suppressed")).toBeTruthy();
    act(() => { demoStore.loadFixture("SUPPLIER_OFFER"); });
    expect(s().messages).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: /^Outlook/ }));
    expect(within(screen.getByRole("region", { name: "Messages" })).getAllByRole("button")).toHaveLength(2);
    act(() => { demoStore.dispatch({ type: "DEMO_RESET" }); });
    expect(s()).toMatchObject({ activeFixture: "REVIEW_STATES", suppressedDuplicateCount: 0, extractionHistory: [], offerReviews: [], publishedEvents: [] });
    expect(s().messages).toHaveLength(5);
  });

  it("P1-T05/T07: invalid senders and unresolved PO can never verify via store or UI", () => {
    for (const id of ["HP-MSG-SPOOF", "HP-MSG-UNKNOWN"]) {
      expect(() => demoStore.confirmExtractionReview(id)).toThrow();
      renderAt(`/message-intelligence?message=${id}`);
      expect((screen.getByRole("button", { name: /confirm & verify incident/i }) as HTMLButtonElement).disabled).toBe(true);
      cleanup();
    }
    const unknown = selectExtractionVersions(s(), "HP-MSG-UNKNOWN")[0]!;
    expect(unknown).toMatchObject({ method: "UNRESOLVED", evidenceSpans: [] });
    expect(unknown.values.poId).toBeNull();
    expect(selectActiveIncident(s()).messageIds).toEqual([]);
  });

  it("P3/P5 selectors read the same shared state and expose non-authorizing limits", () => {
    demoStore.loadFixture("SUPPLIER_OFFER");
    demoStore.reviewSupplierOffer("HP-MSG-OL-OFFER", "QUALIFIED", "approved");
    const offer = selectSupplierOfferEvidence(s())[0]!;
    expect(offer.matchesCanonicalOfferId).toBe(s().business.supplierOffers[0]!.id);
    expect(selectMessageEvidence(s(), "HP-MSG-OL-OFFER")!.offerReviewVersions).toEqual(offer.reviewVersions);
    expect(offer.reviewVersions).toHaveLength(2);
    expect(Object.values(offer.limits).every((v) => v === false)).toBe(true);
  });
});

describe("P1 final QA — architecture audit", () => {
  const sources = import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const files = Object.keys(sources);
  const src = (p: string) => sources[p]!;

  it("has no network, provider SDK, OAuth or webhook code", () => {
    for (const f of files) expect(src(f), f).not.toMatch(/\bfetch\(|XMLHttpRequest|new WebSocket|EventSource|navigator\.sendBeacon|axios|whatsapp-web|googleapis|msal|telegraf|grammy/i);
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["lucide-react", "react", "react-dom", "react-router-dom"]);
  });

  it("uses one canonical DemoState and one business fixture", () => {
    expect(inboxStore).toBe(demoStore);
    expect(files.filter((f) => /useSyncExternalStore\(/.test(src(f)))).toHaveLength(1);
    const businessImporters = files.filter((f) => /data\/fixtures\/happyPotato/.test(src(f)));
    expect(businessImporters.map((f) => f.split("/src/")[1])).toEqual(["store/demoStore.ts"]);
    expect(files.filter((f) => /"HP-OFFER-002"/.test(src(f))).map((f) => f.split(/[\\/]/).pop())).toEqual(["happyPotato.ts"]);
  });
});

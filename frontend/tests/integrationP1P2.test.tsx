/** Cross-module integration: P1 review -> P2 incident/impact through the one shared business slice. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { demoStore, selectActiveImpact, selectActiveIncident, selectBusinessIncident, selectOperationalSnapshot } from "../src/store/demoStore";
import { getP2State, resetDemo, simulateChickenRecount } from "../src/services/mock/restaurantStore";
import { isImpactStale } from "../src/services/mock/restaurantState";

const s = () => demoStore.getSnapshot();
const p2 = () => getP2State().restaurant;
const chicken = () => selectOperationalSnapshot(s()).ingredientLots.find((l) => l.id === "HP-LOT-CH-001")!.onHandMilli;
beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);
function app(path: string) { const r = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={r} />); return r; }
const go = async (r: ReturnType<typeof app>, to: string) => { await act(async () => { await r.navigate(to); }); };

describe("P1 -> P2 shared state", () => {
  it("A: Inbox -> Intelligence -> confirm -> P2 Incidents -> Assess impact -> P1 handoff acknowledged", async () => {
    const r = app("/inbox");
    expect(p2().incidents).toHaveLength(0);
    act(() => demoStore.select("HP-MSG-WA-001"));
    fireEvent.click(screen.getByRole("link", { name: "Open in Message Intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: /confirm & verify incident/i }));
    // P2 received the same incident immediately, via its production reducer.
    expect(p2().incidents).toHaveLength(1);
    expect(p2().incidents[0]).toMatchObject({ id: "HP-INC-001", poId: "HP-PO-1042", ingredientId: "HP-ING-CHICKEN", status: "VERIFIED", claimedShortfallKgMilli: 20000, messageIds: ["HP-MSG-WA-001"] });
    expect(getP2State().messages.map((m) => m.id)).toEqual(["HP-MSG-WA-001"]);
    expect(p2().snapshot.supplierClaims).toEqual([expect.objectContaining({ poId: "HP-PO-1042", claimedDeliveryTodayKgMilli: 0, etaLocal: null })]);
    expect(chicken()).toBe(10000);
    expect(screen.getByTestId("p2-incident-status").textContent).toMatch(/VERIFIED · 1 message/);
    expect(selectActiveIncident(s()).handoff.status).toBe("AWAITING_P2_CONSUMER");
    await go(r, "/incidents");
    expect(screen.getAllByText("HP-INC-001").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Assess impact" }));
    expect(selectActiveImpact(s())?.status).toMatch(/ASSESSED|BREACH_RISK/);
    expect(selectBusinessIncident(s())!.status).toBe("IMPACT_ASSESSED");
    expect(selectActiveIncident(s()).handoff.status).toBe("ACKNOWLEDGED_BY_P2");
    await go(r, "/message-intelligence?message=HP-MSG-WA-001");
    expect(screen.getByTestId("handoff-status").textContent).toBe("Acknowledged by P2 Impact consumer.");
    await go(r, "/impact");
    expect(screen.getAllByText(/HP-INC-001/).length).toBeGreaterThan(0);
  });

  it("B: three channels -> one P2 incident, one 20 kg claim, one snapshot claim", () => {
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); demoStore.linkMessageToIncident("HP-MSG-OL-001"); demoStore.linkMessageToIncident("HP-MSG-TG-001"); });
    act(() => { demoStore.linkMessageToIncident("HP-MSG-TG-001"); });
    expect(p2().incidents).toHaveLength(1);
    expect(p2().incidents[0]!.messageIds).toEqual(["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"]);
    expect(p2().incidents[0]!.claimedShortfallKgMilli).toBe(20000);
    expect(p2().snapshot.supplierClaims).toHaveLength(1);
    expect(p2().snapshot.revision).toBe(2);
    expect(selectActiveIncident(s()).messageIds).toEqual(p2().incidents[0]!.messageIds);
    expect(getP2State().activity.filter((e) => e.type === "MESSAGE_LINKED")).toHaveLength(2);
    expect(chicken()).toBe(10000);
  });

  it("F/G: rejected, unresolved, unsafe or unmatched messages never reach P2", () => {
    act(() => { demoStore.decideExtractionReview("HP-MSG-WA-001", "REJECTED", "wrong thread"); });
    act(() => { demoStore.decideExtractionReview("HP-MSG-OL-001", "MARKED_UNRESOLVED", "unclear"); });
    for (const id of ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-SPOOF", "HP-MSG-UNKNOWN"]) expect(() => demoStore.confirmExtractionReview(id)).toThrow();
    expect(p2().incidents).toHaveLength(0);
    expect(p2().snapshot.revision).toBe(1);
  });

  it("H: P1 reset resets P2; P2 reset resets P1 (no loop)", () => {
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    act(() => demoStore.reset());
    expect(p2().incidents).toHaveLength(0);
    expect(p2().snapshot.revision).toBe(1);
    act(() => { demoStore.loadFixture("CORE_CHANNELS"); demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    act(() => resetDemo());
    expect(selectActiveIncident(s())).toMatchObject({ status: "PENDING_VERIFICATION", messageIds: [] });
    expect(s().extractionHistory).toHaveLength(0);
    expect(s().activeFixture).toBe("CORE_CHANNELS");
    expect(s().restaurant).toBe(p2());
  });

  it("I: snapshot change makes P2 impact stale everywhere until reassessed", async () => {
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    const r = app("/incidents");
    fireEvent.click(screen.getByRole("button", { name: "Assess impact" }));
    act(() => simulateChickenRecount(8000));
    expect(chicken()).toBe(8000);
    expect(selectActiveImpact(s())).toBeNull();
    expect(isImpactStale(p2(), "HP-INC-001")).toBe(true);
    await go(r, "/message-intelligence?message=HP-MSG-WA-001");
    expect(screen.getByTestId("p2-impact-status").textContent).toMatch(/STALE/);
  });
});

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { assessImpactAction } from "../src/services/mock/restaurantStore";
import { routes } from "../src/app/router";
import { demoStore, incidentLinkBlockers, selectActiveIncident, selectExtractionVersions, selectMessagesForIncident, selectOperationalSnapshot } from "../src/store/demoStore";

beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);
const s = () => demoStore.getSnapshot();
function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("incident verification and cross-channel correlation", () => {
  it("mandatory flow: confirm WhatsApp, link Outlook + Telegram, one 20 kg incident, reset to pending", async () => {
    act(() => demoStore.dispatch({ type: "DEMO_RESET" }));
    expect(selectActiveIncident(s()).status).toBe("PENDING_VERIFICATION");
    const router = renderAt("/message-intelligence?message=HP-MSG-WA-001");
    expect(screen.getByTestId("handoff-status").textContent).toMatch(/Not published/);
    fireEvent.click(screen.getByRole("button", { name: /confirm & verify incident/i }));

    const incident = selectActiveIncident(s());
    expect(incident).toMatchObject({ id: "HP-INC-001", poId: "HP-PO-1042", ingredientId: "HP-ING-CHICKEN", snapshotId: "HP-SNAP-001", snapshotRevision: 1, type: "UNAVAILABLE", status: "VERIFIED", claimedShortfallKgMilli: 20000, messageIds: ["HP-MSG-WA-001"] });
    expect(incident.handoff.status).toBe("AWAITING_P2_CONSUMER");
    expect(screen.getByTestId("handoff-status").textContent).toMatch(/Impact has not been calculated/);
    expect(screen.getByRole("link", { name: "Open Impact Explorer" }).getAttribute("href")).toBe("/impact");

    for (const id of ["HP-MSG-OL-001", "HP-MSG-TG-001"]) {
      await act(async () => { await router.navigate(`/message-intelligence?message=${id}`); });
      expect(screen.queryByRole("button", { name: /confirm & verify incident/i })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Link to existing incident HP-INC-001" }));
      expect(selectActiveIncident(s()).messageIds).not.toContain(id); // explicit confirmation still required
      fireEvent.click(screen.getByRole("button", { name: "Confirm link" }));
    }

    const linked = selectMessagesForIncident(s());
    expect(linked.map((m) => m.id)).toEqual(["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"]);
    expect(linked.every((m) => m.stage === "LINKED" && m.linkedIncidentId === "HP-INC-001")).toBe(true);
    expect(selectActiveIncident(s()).claimedShortfallKgMilli).toBe(20000);
    expect(screen.getByTestId("incident-shortfall").textContent).toMatch(/^20\.000 kg/);
    expect(screen.getByTestId("incident-messages").textContent).toMatch(/HP-MSG-WA-001.*HP-MSG-OL-001.*HP-MSG-TG-001/);
    expect(selectOperationalSnapshot(s()).ingredientLots.find((l) => l.ingredientId === "HP-ING-CHICKEN")!.onHandMilli).toBe(10000);

    await act(async () => { await router.navigate("/inbox"); });
    expect(screen.getByTestId("inbox-incident-status").textContent).toMatch(/verified with 3 linked messages; the 20\.000 kg/);

    act(() => demoStore.dispatch({ type: "DEMO_RESET" }));
    expect(selectActiveIncident(s())).toMatchObject({ status: "PENDING_VERIFICATION", messageIds: [], verifiedAtIso: null });
    expect(selectActiveIncident(s()).handoff.status).toBe("NOT_PUBLISHED");
    expect(selectMessagesForIncident(s())).toHaveLength(0);
    expect(s().extractionHistory).toHaveLength(0);
  });

  it("is idempotent for repeated confirm, link and INCIDENT_VERIFIED", () => {
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    const after = s();
    expect(demoStore.confirmExtractionReview("HP-MSG-WA-001").status).toBe("ALREADY_LINKED");
    act(() => demoStore.dispatch({ type: "INCIDENT_VERIFIED", messageIds: ["HP-MSG-WA-001"] }));
    expect(s()).toBe(after);
    act(() => { demoStore.linkMessageToIncident("HP-MSG-OL-001"); });
    const linkedState = s();
    expect(demoStore.linkMessageToIncident("HP-MSG-OL-001").status).toBe("ALREADY_LINKED");
    expect(s()).toBe(linkedState);
    expect(selectActiveIncident(s()).messageIds).toEqual(["HP-MSG-WA-001", "HP-MSG-OL-001"]);
    expect(selectExtractionVersions(s(), "HP-MSG-OL-001").filter((v) => v.decision === "CONFIRMED")).toHaveLength(1);
    expect(() => demoStore.confirmExtractionReview("HP-MSG-TG-001")).toThrow(/use Link to existing incident/);
  });

  it("requires a verified incident before linking and rejects incompatible links", () => {
    expect(() => demoStore.linkMessageToIncident("HP-MSG-OL-001")).toThrow(/No verified incident/);
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    const base = selectExtractionVersions(s(), "HP-MSG-OL-001")[0]!.values;
    act(() => { demoStore.saveExtractionCorrection("HP-MSG-OL-001", { ...base, incidentType: "DELAY" }); });
    expect(incidentLinkBlockers(s(), "HP-MSG-OL-001").join(" ")).toMatch(/Incompatible incident type/);
    expect(() => demoStore.linkMessageToIncident("HP-MSG-OL-001")).toThrow(/Incompatible incident type/);
    act(() => { demoStore.decideExtractionReview("HP-MSG-TG-001", "MARKED_UNRESOLVED", "Unclear thread"); });
    expect(() => demoStore.linkMessageToIncident("HP-MSG-TG-001")).toThrow(/UNRESOLVED/);
    expect(() => demoStore.linkMessageToIncident("HP-MSG-SPOOF")).toThrow(/Unsafe sender identity/);
    expect(() => demoStore.linkMessageToIncident("HP-MSG-UNKNOWN")).toThrow(/Unmatched PO/);
    expect(selectActiveIncident(s())).toMatchObject({ messageIds: ["HP-MSG-WA-001"], claimedShortfallKgMilli: 20000 });
  });

  it("shows the acknowledged handoff only after a P2 consumer acknowledges", () => {
    act(() => demoStore.acknowledgeIncidentHandoff());
    expect(selectActiveIncident(s()).handoff.status).toBe("NOT_PUBLISHED");
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); demoStore.acknowledgeIncidentHandoff(); });
    expect(selectActiveIncident(s()).handoff.status).toBe("AWAITING_P2_CONSUMER"); // no P2 impact yet: manual ack refused
    act(() => assessImpactAction("HP-INC-001")); // real P2 consumption acknowledges automatically
    renderAt("/message-intelligence?message=HP-MSG-WA-001");
    expect(screen.getByTestId("handoff-status").textContent).toBe("Acknowledged by P2 Impact consumer.");
  });
});

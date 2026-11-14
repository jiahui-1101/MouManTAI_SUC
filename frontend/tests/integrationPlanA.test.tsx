/** P1/P2 -> P3: the production Plan A page consumes real shared state. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { demoStore } from "../src/store/demoStore";
import { assessImpactAction, simulateChickenRecount } from "../src/services/mock/restaurantStore";
import { adaptPlanAInputs } from "../src/features/recovery/plan-a/integration";
import { selectPlanAInputRead, selectPlanAOfferEvidence } from "../src/integration/planAShared";

const s = () => demoStore.getSnapshot();
beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);
function app(path: string) { const r = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={r} />); return r; }
const verifyAndAssess = () => act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); assessImpactAction("HP-INC-001"); });

describe("Plan A shared inputs", () => {
  it("stays pending until P1 verification and P2 impact exist", () => {
    app("/recovery/plan-a");
    expect(screen.getByText("External supply workspace is waiting")).toBeTruthy();
    expect(screen.getByTestId("plan-a-pending").textContent).toMatch(/incident.*impact/);
    act(() => { demoStore.confirmExtractionReview("HP-MSG-WA-001"); });
    expect(screen.getByTestId("plan-a-pending").textContent).toMatch(/impact/);
    expect(screen.getByTestId("plan-a-pending").textContent).not.toMatch(/incident,/);
  });

  it("C: P2 assessment drives the real supply need; offer B is conditionally eligible, frozen offer C is not", () => {
    verifyAndAssess();
    const adapted = adaptPlanAInputs(selectPlanAInputRead(s()));
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    expect(adapted.value.source.incident).toMatchObject({ id: "HP-INC-001", status: "IMPACT_ASSESSED", messageIds: ["HP-MSG-WA-001"] });
    expect(adapted.value.source.snapshot.fingerprint).toBe(s().restaurant.snapshot.fingerprint);
    expect(adapted.value.scenarioMetadata).toMatchObject({ scenarioId: "HP-SC-A-001", version: s().restaurant.snapshot.revision });
    app("/recovery/plan-a");
    expect(screen.getByText(/HP-INC-001 · PO HP-PO-1042/)).toBeTruthy();
    const selectB = screen.getAllByRole("button").find((b) => /select/i.test(b.textContent ?? "") && !(b as HTMLButtonElement).disabled);
    expect(selectB).toBeTruthy();
    fireEvent.click(selectB!);
    fireEvent.click(screen.getByRole("button", { name: "Generate preview" }));
    expect(screen.getAllByText(/RM\s?255(\.00)?/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/goods received|PO approved/i)).toBeNull();
  });

  it("P1 offer review changes P3 evidence: unreviewed/rejected claim blocks B, qualification restores it", () => {
    verifyAndAssess();
    act(() => demoStore.loadFixture("SUPPLIER_OFFER"));
    // loadFixture resets the shared demo; re-verify on the offer scenario
    verifyAndAssess();
    const spec = () => selectPlanAOfferEvidence(s()).find((e) => e.offerId === "HP-OFFER-002")!;
    expect(spec().specEvidenceStatus).toBe("UNVERIFIED");
    const v1 = selectPlanAInputRead(s()).scenarioMetadata!.version;
    act(() => { demoStore.reviewSupplierOffer("HP-MSG-OL-OFFER", "REJECTED", "price not confirmed"); });
    expect(spec().specEvidenceStatus).toBe("REJECTED");
    act(() => { demoStore.reviewSupplierOffer("HP-MSG-OL-OFFER", "QUALIFIED", "approved supplier B"); });
    expect(spec()).toMatchObject({ specEvidenceStatus: "SYNTHETIC_DEMO_APPROVED", availabilityStatus: "UNCONFIRMED" });
    expect(spec().evidenceRef).toMatch(/^HP-MSG-OL-OFFER#/);
    expect(selectPlanAInputRead(s()).scenarioMetadata!.version).toBe(v1 + 2);
    expect(selectPlanAInputRead(s()).scenarioMetadata!.evidenceRefs).toContain(spec().evidenceRef);
    expect(s().restaurant.snapshot.ingredientLots.find((l) => l.id === "HP-LOT-CH-001")!.onHandMilli).toBe(10000);
  });

  it("I: snapshot change makes Plan A pending again (stale impact is never used)", () => {
    verifyAndAssess();
    act(() => simulateChickenRecount(8000));
    const adapted = adaptPlanAInputs(selectPlanAInputRead(s()));
    expect(adapted.ok).toBe(false);
    act(() => assessImpactAction("HP-INC-001"));
    const again = adaptPlanAInputs(selectPlanAInputRead(s()));
    expect(again.ok && again.value.source.snapshot.revision).toBe(3);
  });
});

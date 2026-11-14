import { afterEach, beforeEach, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { demoStore } from "../src/store/demoStore";
import { selectMessageEvidence, selectSupplierOfferEvidence } from "../src/features/messaging/evidenceSelectors";
import { CANONICAL_OFFER_MESSAGE } from "../src/features/messaging/supplierOffer";

beforeEach(() => { demoStore.dispatch({ type: "DEMO_RESET" }); demoStore.loadFixture("SUPPLIER_OFFER"); });
afterEach(cleanup);
function renderAt(path: string) { const r = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={r} />); return r; }

it("shows the offer in Inbox and reviews it in Message Intelligence with evidence preserved across navigation", async () => {
  const router = renderAt("/inbox");
  fireEvent.click(screen.getByRole("button", { name: "Next page" })); // 6 messages, 5 per page
  fireEvent.click(screen.getByRole("button", { name: /Demo Poultry Supply B/ }));
  expect(screen.getByTestId("inbox-offer-note").textContent).toMatch(/UNREVIEWED.*not goods received/);
  await act(async () => { await router.navigate("/message-intelligence?message=HP-MSG-OL-OFFER"); });
  expect(screen.getByTestId("raw-text").textContent).toBe(CANONICAL_OFFER_MESSAGE);
  expect(screen.getByTestId("raw-text").querySelectorAll("mark")).toHaveLength(7);
  expect(screen.getByTestId("offer-limits").textContent).toMatch(/HP-OFFER-002 is unchanged/);
  expect(screen.getByText(/RM16.00\/kg · RM15.00 freight/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Qualify sender/ }));
  expect(screen.getByRole("alert").textContent).toMatch(/reason/);
  fireEvent.change(screen.getByLabelText("Review reason"), { target: { value: "Registry-approved supplier B" } });
  fireEvent.click(screen.getByRole("button", { name: /Qualify sender/ }));
  expect(screen.getByTestId("offer-qualification").textContent).toBe("QUALIFIED_CONDITIONAL");
  const ref = selectSupplierOfferEvidence(demoStore.getSnapshot())[0]!.evidenceRef;
  expect(screen.getByTestId("evidence-ref").textContent).toBe(ref);
  await act(async () => { await router.navigate("/inbox"); });
  await act(async () => { await router.navigate("/message-intelligence?message=HP-MSG-OL-OFFER"); });
  expect(screen.getByText(/v2 · HUMAN_REVIEW · QUALIFIED_CONDITIONAL/)).toBeTruthy();
});

it("shows the audit evidence panel and incident link for a confirmed disruption message", () => {
  renderAt("/message-intelligence?message=HP-MSG-WA-001");
  expect(screen.getByTestId("evidence-link").textContent).toBe("Not linked");
  fireEvent.click(screen.getByRole("button", { name: /confirm & verify incident/i }));
  const ev = selectMessageEvidence(demoStore.getSnapshot(), "HP-MSG-WA-001")!;
  expect(screen.getByTestId("evidence-link").textContent).toContain(ev.incidentLink!.incidentId);
  expect(screen.getByTestId("evidence-ref").textContent).toBe(ev.evidenceRef);
});

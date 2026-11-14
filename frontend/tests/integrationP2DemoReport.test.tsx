/** P2 "Supplier disruption demo" reports appear in the P1 inbox and are reviewed through P1. */
import { afterEach, beforeEach, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import { demoStore, selectActiveIncident } from "../src/store/demoStore";
import { getP2State, simulateSupplierReport } from "../src/services/mock/restaurantStore";

const s = () => demoStore.getSnapshot();
beforeEach(() => demoStore.dispatch({ type: "DEMO_RESET" }));
afterEach(cleanup);
const app = (path: string) => { const r = createMemoryRouter(routes, { initialEntries: [path] }); render(<RouterProvider router={r} />); return r; };

it("a simulated report on the chosen channel shows in Inbox and Message Intelligence and can be confirmed in P1", async () => {
  let id = "";
  act(() => { id = simulateSupplierReport("OUTLOOK", "PENDING"); });
  const msg = s().messages.find((m) => m.id === id)!;
  expect(msg).toMatchObject({ channel: "OUTLOOK", provenance: "SIMULATED_CHANNEL", senderRegistryId: "HP-SUP-001", subject: "HP-PO-1042 delivery update", read: false, stage: "PARSED" });
  // Same event is not duplicated in P1 and a redelivery is deduplicated.
  act(() => { simulateSupplierReport("OUTLOOK", "PENDING"); });
  expect(s().messages.filter((m) => m.channel === "OUTLOOK")).toHaveLength(3); // fixture OL + 2 distinct simulated reports

  const r = app("/message-intelligence");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: id } }); // 7 messages: find it in the queue
  expect(screen.getByRole("link", { name: new RegExp(`Open review ${id}`) })).toBeTruthy();
  await act(async () => { await r.navigate(`/message-intelligence?message=${encodeURIComponent(id)}`); });
  fireEvent.click(screen.getByRole("button", { name: /confirm & verify incident/i }));
  expect(selectActiveIncident(s())).toMatchObject({ status: "VERIFIED", messageIds: [id] });
  const p2 = getP2State();
  expect(p2.restaurant.incidents).toHaveLength(1);
  expect(p2.restaurant.incidents[0]).toMatchObject({ status: "VERIFIED", claimedShortfallKgMilli: 20000 });
  expect(p2.messages.filter((m) => m.id === id)).toHaveLength(1);
});

it("WhatsApp/Telegram choices map to the same channel in the P1 inbox", () => {
  act(() => { simulateSupplierReport("TELEGRAM", "VERIFIED"); simulateSupplierReport("WHATSAPP", "PENDING"); });
  expect(s().messages.filter((m) => m.id.startsWith("sim:")).map((m) => m.channel)).toEqual(["TELEGRAM", "WHATSAPP"]);
});

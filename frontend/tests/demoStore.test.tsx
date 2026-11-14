import { beforeEach, expect, it } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { demoStore, useDemoState, selectActiveIncident, selectMessagesForIncident, selectOperationalSnapshot, fingerprint } from "../src/store/demoStore";
import { inboxStore } from "../src/features/messaging/inboxStore";
beforeEach(() => { cleanup(); demoStore.dispatch({ type: "DEMO_RESET" }); });
it("publishes P1 review and verification to a subscribed shared selector consumer", () => {
  function Consumer() { const state = useDemoState(); return <p>{selectActiveIncident(state).status}:{selectMessagesForIncident(state).length}</p>; }
  render(<Consumer />);
  const original = selectOperationalSnapshot(demoStore.getSnapshot());
  expect(original.id).toBe("HP-SNAP-001");
  expect(original.revision).toBe(1);
  expect(original.purchaseOrders[0]?.state).toBe("OPEN");
  expect(original.ingredientLots[0]?.onHandMilli).toBe(10000);
  expect(original.fingerprint).toBe(fingerprint(demoStore.getSnapshot().business));
  act(() => {
    for (const messageId of ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"] as const) inboxStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId });
    inboxStore.dispatch({ type: "INCIDENT_VERIFIED", messageIds: ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"] });
  });
  expect(screen.getByText("VERIFIED:3")).toBeTruthy();
  expect(selectActiveIncident(demoStore.getSnapshot()).claimedShortfallKgMilli).toBe(20000);
  expect(selectOperationalSnapshot(demoStore.getSnapshot())).toEqual(original);
  expect(inboxStore.getSnapshot()).toBe(demoStore.getSnapshot());
});
it("deduplicates envelopes and rejects unsafe or unreviewed verification", () => {
  const message = demoStore.getSnapshot().messages[0]!;
  const count = demoStore.getSnapshot().messages.length;
  demoStore.dispatch({ type: "MESSAGE_RECEIVED", message });
  expect(demoStore.getSnapshot().messages).toHaveLength(count);
  expect(() => demoStore.dispatch({ type: "INCIDENT_VERIFIED", messageIds: [message.id] })).toThrow();
  expect(() => demoStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId: "HP-MSG-SPOOF" })).toThrow();
  demoStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId: message.id });
  expect(demoStore.getSnapshot().reviews[0]?.extraction.rawText).toBe(message.rawText);
});

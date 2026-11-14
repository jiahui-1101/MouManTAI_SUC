import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { routes } from "../src/app/router";
import {
  demoStore,
  selectActiveIncident,
  selectMessagesForIncident,
  CANONICAL_MOCK_ENVELOPES,
} from "../src/store/demoStore";

beforeEach(() => {
  demoStore.reset();
});

afterEach(cleanup);

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("Offline mock messaging state operations", () => {
  it("idempotently suppresses duplicate mock messages and tracks actual ingestion counts", () => {
    renderRoute("/inbox");

    // Initially 0 duplicates suppressed - never a hardcoded seed
    expect(demoStore.getSnapshot().suppressedDuplicateCount).toBe(0);
    expect(screen.getByText("0 duplicates suppressed")).toBeTruthy();

    const initialCount = demoStore.getSnapshot().messages.length;

    // Ingest the canonical WhatsApp envelope again
    const waEnvelope = CANONICAL_MOCK_ENVELOPES[0]!;
    act(() => {
      const result = demoStore.ingestMockMessage(waEnvelope);
      expect(result.status).toBe("DUPLICATE");
      expect(result.suppressedDuplicateCount).toBe(1);
    });

    // Message list length unchanged
    expect(demoStore.getSnapshot().messages).toHaveLength(initialCount);
    expect(demoStore.getSnapshot().suppressedDuplicateCount).toBe(1);

    // Immediately reflected in UI
    expect(screen.getByText("1 duplicate suppressed")).toBeTruthy();

    // Reingesting a second time increments count again
    act(() => {
      const result = demoStore.ingestMockMessage(waEnvelope);
      expect(result.status).toBe("DUPLICATE");
      expect(result.suppressedDuplicateCount).toBe(2);
    });

    expect(demoStore.getSnapshot().messages).toHaveLength(initialCount);
    expect(screen.getByText("2 duplicates suppressed")).toBeTruthy();
  });

  it("preserves three separate records for distinct canonical channel messages", () => {
    renderRoute("/channels");

    const messages = demoStore.getSnapshot().messages;
    const wa = messages.find((m) => m.id === "HP-MSG-WA-001");
    const ol = messages.find((m) => m.id === "HP-MSG-OL-001");
    const tg = messages.find((m) => m.id === "HP-MSG-TG-001");

    expect(wa).toBeDefined();
    expect(ol).toBeDefined();
    expect(tg).toBeDefined();

    // Distinct channels and simulated identifiers
    expect(wa?.channel).toBe("WHATSAPP");
    expect(ol?.channel).toBe("OUTLOOK");
    expect(tg?.channel).toBe("TELEGRAM");

    expect(wa?.channelAccountId).toBe("demo-whatsapp");
    expect(ol?.channelAccountId).toBe("demo-outlook");
    expect(tg?.channelAccountId).toBe("demo-telegram");

    // All must be SIMULATED_CHANNEL
    for (const msg of [wa, ol, tg]) {
      expect(msg?.provenance).toBe("SIMULATED_CHANNEL");
    }

    // Channels view displays accurate counts for each distinct simulated source
    const whatsappCard = screen.getByRole("heading", { name: "WhatsApp" }).closest("article")!;
    const outlookCard = screen.getByRole("heading", { name: "Outlook" }).closest("article")!;
    const telegramCard = screen.getByRole("heading", { name: "Telegram" }).closest("article")!;

    expect(within(whatsappCard).getByText("2")).toBeTruthy(); // WA-001 + SPOOF
    expect(within(outlookCard).getByText("1")).toBeTruthy(); // OL-001
    expect(within(telegramCard).getByText("2")).toBeTruthy(); // TG-001 + UNKNOWN
  });

  it("ensures no incident is verified before human confirmation and HP-MSG-TG-001 starts unlinked", () => {
    const state = demoStore.getSnapshot();
    const incident = selectActiveIncident(state);

    // Initial state must be pending verification with no messages correlated
    expect(incident.status).toBe("PENDING_VERIFICATION");
    expect(incident.messageIds).toHaveLength(0);

    // HP-MSG-TG-001 must not start LINKED without review
    const tg = state.messages.find((m) => m.id === "HP-MSG-TG-001")!;
    expect(tg.stage).toBe("PARSED");
    expect(tg.linkedIncidentId).toBeUndefined();

    // HP-MSG-WA-001 and HP-MSG-OL-001 also start as PARSED
    const wa = state.messages.find((m) => m.id === "HP-MSG-WA-001")!;
    const ol = state.messages.find((m) => m.id === "HP-MSG-OL-001")!;
    expect(wa.stage).toBe("PARSED");
    expect(ol.stage).toBe("PARSED");

    // Verification fails if messages have not undergone human review
    expect(() =>
      demoStore.dispatch({ type: "INCIDENT_VERIFIED", messageIds: ["HP-MSG-TG-001"] })
    ).toThrow("Reviewed messages required");

    // Unsafe senders cannot be reviewed
    expect(() =>
      demoStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId: "HP-MSG-SPOOF" })
    ).toThrow("Unsafe review");

    // Incident remains unverified
    expect(selectActiveIncident(demoStore.getSnapshot()).status).toBe("PENDING_VERIFICATION");
  });

  it("dynamically derives processing stages and ensures inbox badges and timeline match actual state", () => {
    renderRoute("/inbox");

    // Click on Telegram message HP-MSG-TG-001
    const tgButton = screen.getByRole("button", { name: /Demo Poultry Supply A09:05 MYT/ });
    fireEvent.click(tgButton);

    const detail = screen.getByRole("article", { name: "Selected message" });
    const timeline = within(detail).getByRole("list", { name: "Processing timeline" });
    const steps = within(timeline).getAllByRole("listitem");

    // Initial stage: PARSED
    expect(within(detail).getByText("Parsed", { selector: ".message-detail__status" })).toBeTruthy();
    expect(steps[0]?.classList.contains("is-done")).toBe(true); // Received
    expect(steps[1]?.classList.contains("is-done")).toBe(true); // Parsed
    expect(steps[2]?.classList.contains("is-done")).toBe(false); // Review
    expect(steps[3]?.classList.contains("is-done")).toBe(false); // Linked to Incident

    // Review extraction
    act(() => {
      demoStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId: "HP-MSG-TG-001" });
    });

    // Stage updates to REVIEW_PENDING
    expect(within(detail).getByText("Review pending", { selector: ".message-detail__status" })).toBeTruthy();
    expect(steps[0]?.classList.contains("is-done")).toBe(true); // Received
    expect(steps[1]?.classList.contains("is-done")).toBe(true); // Parsed
    expect(steps[2]?.classList.contains("is-done")).toBe(true); // Review
    expect(steps[3]?.classList.contains("is-done")).toBe(false); // Linked to Incident

    // Human verification into incident
    act(() => {
      demoStore.dispatch({ type: "INCIDENT_VERIFIED", messageIds: ["HP-MSG-TG-001"] });
    });

    // Stage updates to LINKED
    expect(within(detail).getByText("Linked to incident", { selector: ".message-detail__status" })).toBeTruthy();
    expect(steps[0]?.classList.contains("is-done")).toBe(true); // Received
    expect(steps[1]?.classList.contains("is-done")).toBe(true); // Parsed
    expect(steps[2]?.classList.contains("is-done")).toBe(true); // Review
    expect(steps[3]?.classList.contains("is-done")).toBe(true); // Linked to Incident

    const updatedState = demoStore.getSnapshot();
    expect(selectActiveIncident(updatedState).status).toBe("VERIFIED");
    expect(selectMessagesForIncident(updatedState)).toHaveLength(1);
    expect(selectMessagesForIncident(updatedState)[0]?.id).toBe("HP-MSG-TG-001");
  });

  it("clears verification and linking history upon demo reset and scenario load", () => {
    // Review and verify messages
    act(() => {
      demoStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId: "HP-MSG-WA-001" });
      demoStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId: "HP-MSG-TG-001" });
      demoStore.dispatch({
        type: "INCIDENT_VERIFIED",
        messageIds: ["HP-MSG-WA-001", "HP-MSG-TG-001"],
      });
      demoStore.ingestMockMessage(CANONICAL_MOCK_ENVELOPES[0]!); // create duplicate count
    });

    let state = demoStore.getSnapshot();
    expect(state.incident.status).toBe("VERIFIED");
    expect(state.incident.messageIds).toHaveLength(2);
    expect(state.reviews).toHaveLength(2);
    expect(state.suppressedDuplicateCount).toBe(1);

    // Perform reset
    act(() => {
      demoStore.reset();
    });

    state = demoStore.getSnapshot();
    expect(state.incident.status).toBe("PENDING_VERIFICATION");
    expect(state.incident.messageIds).toHaveLength(0);
    expect(state.reviews).toHaveLength(0);
    expect(state.suppressedDuplicateCount).toBe(0);

    // All messages restored to unreviewed/unlinked state
    for (const msg of state.messages) {
      expect(msg.stage).not.toBe("LINKED");
      expect(msg.stage).not.toBe("REVIEW_PENDING");
      expect(msg.linkedIncidentId).toBeUndefined();
    }

    // Now test loadFixture("CORE_CHANNELS")
    act(() => {
      demoStore.dispatch({ type: "MESSAGE_EXTRACTION_REVIEWED", messageId: "HP-MSG-WA-001" });
      demoStore.dispatch({ type: "INCIDENT_VERIFIED", messageIds: ["HP-MSG-WA-001"] });
      demoStore.loadFixture("CORE_CHANNELS");
    });

    state = demoStore.getSnapshot();
    expect(state.messages).toHaveLength(3);
    expect(state.activeFixture).toBe("CORE_CHANNELS");
    expect(state.incident.status).toBe("PENDING_VERIFICATION");
    expect(state.incident.messageIds).toHaveLength(0);
    expect(state.reviews).toHaveLength(0);
    expect(state.suppressedDuplicateCount).toBe(0);
    expect(state.messages.every((m) => m.stage === "PARSED")).toBe(true);
  });
});

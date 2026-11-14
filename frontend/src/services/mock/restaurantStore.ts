/**
 * P2-facing subscription adapter over the Stage 1 `RestaurantState` slice.
 *
 * Integration boundary: this holds ONLY the restaurant slice plus P2's activity
 * view and the local test-mode messages. When the unified `DemoState` exists,
 * replace `getState/dispatch/subscribe` here with selectors on that store; pages
 * only use `useRestaurantStore()` and the action functions below.
 *
 * Nothing here talks to a provider, FeedMe or a backend.
 */
import { useSyncExternalStore } from "react";
import type { Channel, SourceKind } from "../../types/common";
import type { IncidentStatus } from "../../types/restaurant";
import { HP_IDS, HP_LOCKED_MESSAGE } from "../../data/fixtures/happyPotato";
import {
  assessIncidentImpact,
  createInitialRestaurantState,
  recordSupplierIncident,
  reviseSnapshot,
  type RestaurantState,
  type SupplierIncidentReport,
} from "./restaurantState";

export type ActivityType =
  | "MESSAGE_RECEIVED"
  | "MESSAGE_LINKED"
  | "INCIDENT_REPORTED"
  | "INCIDENT_VERIFIED"
  | "SNAPSHOT_CHANGED"
  | "IMPACT_ASSESSED"
  | "DEMO_RESET";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  /** Browser time the local event was recorded (not the synthetic business clock). */
  recordedAtIso: string;
  incidentId?: string;
  fromStatus?: IncidentStatus;
  toStatus?: IncidentStatus;
  provenance: SourceKind;
  detail: string;
}

/**
 * Local test-mode message record. P1 owns real inbound messages; these exist only
 * so P2 can be exercised before P1 integration and are always SIMULATED_CHANNEL.
 */
export interface SimulatedMessage {
  id: string;
  channel: Channel;
  provenance: "SIMULATED_CHANNEL";
  receivedAtIso: string;
  senderLabel: string;
  subject?: string;
  text: string;
  incidentId: string;
}

export interface P2StoreState {
  restaurant: RestaurantState;
  messages: SimulatedMessage[];
  activity: ActivityEvent[];
}

let now: () => Date = () => new Date();
let counter = 0;

function initial(): P2StoreState {
  return { restaurant: createInitialRestaurantState(), messages: [], activity: [] };
}

let state: P2StoreState = initial();
const listeners = new Set<() => void>();

function setState(next: P2StoreState) {
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
}

export function getP2State(): P2StoreState {
  return state;
}

export function subscribeP2(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRestaurantStore(): P2StoreState {
  return useSyncExternalStore(subscribeP2, getP2State, getP2State);
}

function event(partial: Omit<ActivityEvent, "id" | "recordedAtIso">): ActivityEvent {
  counter += 1;
  return { id: `p2-evt-${counter}`, recordedAtIso: now().toISOString(), ...partial };
}

/* actions ------------------------------------------------------------------ */

const CHANNEL_LABEL: Record<Channel, string> = { WHATSAPP: "WhatsApp", OUTLOOK: "Outlook", TELEGRAM: "Telegram" };

/**
 * TEST MODE ONLY: inject the locked supplier message as a SIMULATED_CHANNEL report.
 * `verification: "VERIFIED"` stands in for P1's sender/PO verification and is
 * labelled as simulated everywhere it is shown.
 */
export function simulateSupplierReport(channel: Channel, verification: "PENDING" | "VERIFIED"): string {
  const sequence = state.messages.filter((m) => m.channel === channel).length + 1;
  const messageId = `sim:${channel.toLowerCase()}:${String(sequence).padStart(3, "0")}`;
  const expected = HP_LOCKED_MESSAGE.expected;
  const before = state.restaurant;
  const prior = before.incidents.find((i) => i.poId === expected.poId && i.type === expected.incidentType);

  const restaurant = recordSupplierIncident(before, {
    incidentId: HP_IDS.incident,
    messageId,
    poId: expected.poId,
    supplierId: HP_IDS.supplierOriginal,
    ingredientId: expected.ingredientId,
    incidentType: expected.incidentType,
    claimedDeliveryTodayKgMilli: expected.claimedDeliveryTodayKgMilli,
    etaLocal: expected.etaLocal,
    verification,
  });
  const incident = restaurant.incidents.find((i) => i.poId === expected.poId && i.type === expected.incidentType)!;

  const message: SimulatedMessage = {
    id: messageId,
    channel,
    provenance: "SIMULATED_CHANNEL",
    receivedAtIso: now().toISOString(),
    senderLabel: verification === "VERIFIED" ? "Demo Poultry Supply A (simulated verified contact)" : "Unverified sender (simulated)",
    subject: channel === "OUTLOOK" ? HP_LOCKED_MESSAGE.outlookSubject : undefined,
    text: HP_LOCKED_MESSAGE.text,
    incidentId: incident.id,
  };

  const events: ActivityEvent[] = [
    event({ type: "MESSAGE_RECEIVED", incidentId: incident.id, provenance: "SIMULATED_CHANNEL", detail: `Simulated ${CHANNEL_LABEL[channel]} message ${messageId}` }),
  ];
  if (!prior) {
    events.push(event({ type: "INCIDENT_REPORTED", incidentId: incident.id, toStatus: incident.status === "VERIFIED" ? "PENDING_VERIFICATION" : incident.status, provenance: "SIMULATED_CHANNEL", detail: `Incident opened for ${incident.poId}` }));
  } else {
    events.push(event({ type: "MESSAGE_LINKED", incidentId: incident.id, provenance: "SIMULATED_CHANNEL", detail: `${messageId} linked to ${incident.id}; no additional shortage applied` }));
  }
  if (incident.status === "VERIFIED" && prior?.status !== "VERIFIED") {
    events.push(event({ type: "INCIDENT_VERIFIED", incidentId: incident.id, fromStatus: "PENDING_VERIFICATION", toStatus: "VERIFIED", provenance: "SIMULATED_CHANNEL", detail: "Sender and PO verification simulated (P1 test mode)" }));
  }
  if (restaurant.snapshot.revision !== before.snapshot.revision) {
    events.push(snapshotEvent(restaurant, incident.id));
  }

  setState({ restaurant, messages: [...state.messages, message], activity: [...state.activity, ...events] });
  return messageId;
}

/** TEST MODE ONLY: simulate P1 completing verification of an existing pending incident. */
export function simulateVerification(incidentId: string): void {
  const incident = state.restaurant.incidents.find((i) => i.id === incidentId);
  const message = state.messages.find((m) => m.incidentId === incidentId);
  if (!incident || incident.status !== "PENDING_VERIFICATION" || !message) return;
  const expected = HP_LOCKED_MESSAGE.expected;
  const before = state.restaurant;
  const restaurant = recordSupplierIncident(before, {
    incidentId,
    messageId: message.id,
    poId: incident.poId,
    supplierId: incident.supplierId,
    ingredientId: incident.ingredientId,
    incidentType: incident.type,
    claimedDeliveryTodayKgMilli: expected.claimedDeliveryTodayKgMilli,
    etaLocal: expected.etaLocal,
    verification: "VERIFIED",
  });
  const events = [
    event({ type: "INCIDENT_VERIFIED", incidentId, fromStatus: "PENDING_VERIFICATION", toStatus: "VERIFIED", provenance: "SIMULATED_CHANNEL", detail: "Sender and PO verification simulated (P1 test mode)" }),
  ];
  if (restaurant.snapshot.revision !== before.snapshot.revision) events.push(snapshotEvent(restaurant, incidentId));
  setState({
    ...state,
    restaurant,
    messages: state.messages.map((m) => (m.incidentId === incidentId ? { ...m, senderLabel: "Demo Poultry Supply A (simulated verified contact)" } : m)),
    activity: [...state.activity, ...events],
  });
}

/** A P1-reviewed supplier message forwarded to P2 by the shared-state bridge (store/demoStore.ts). */
export interface VerifiedSupplierMessage {
  incidentId: string;
  messageId: string;
  channel: Channel;
  receivedAtIso: string;
  senderLabel: string;
  subject?: string;
  text: string;
  poId: string;
  supplierId: string;
  ingredientId: string;
  incidentType: SupplierIncidentReport["incidentType"];
  claimedDeliveryTodayKgMilli: number;
  etaLocal: SupplierIncidentReport["etaLocal"];
}

/**
 * Production INCIDENT_VERIFIED consumer for P1. Uses the same pure reducer as the
 * test-mode path, so a second channel links to the existing incident (no extra
 * claim) and physical stock is never modified. Idempotent per message ID.
 */
export function applyVerifiedSupplierMessage(report: VerifiedSupplierMessage): void {
  const before = state.restaurant;
  const prior = before.incidents.find((i) => i.poId === report.poId && i.type === report.incidentType);
  if (prior?.messageIds.includes(report.messageId) && prior.status !== "PENDING_VERIFICATION") return;
  const restaurant = recordSupplierIncident(before, { ...report, verification: "VERIFIED" });
  if (restaurant === before) return;
  const incident = restaurant.incidents.find((i) => i.poId === report.poId && i.type === report.incidentType)!;
  const message: SimulatedMessage = {
    id: report.messageId,
    channel: report.channel,
    provenance: "SIMULATED_CHANNEL",
    receivedAtIso: report.receivedAtIso,
    senderLabel: report.senderLabel,
    subject: report.subject,
    text: report.text,
    incidentId: incident.id,
  };
  const events: ActivityEvent[] = [event({ type: "MESSAGE_RECEIVED", incidentId: incident.id, provenance: "SIMULATED_CHANNEL", detail: `P1 reviewed ${CHANNEL_LABEL[report.channel]} message ${report.messageId}` })];
  if (prior) events.push(event({ type: "MESSAGE_LINKED", incidentId: incident.id, provenance: "SIMULATED_CHANNEL", detail: `${report.messageId} linked to ${incident.id}; no additional shortage applied` }));
  if (incident.status === "VERIFIED" && prior?.status !== "VERIFIED") {
    events.push(event({ type: "INCIDENT_VERIFIED", incidentId: incident.id, fromStatus: "PENDING_VERIFICATION", toStatus: "VERIFIED", provenance: "SIMULATED_CHANNEL", detail: "Sender and PO verified by P1 human review" }));
  }
  if (restaurant.snapshot.revision !== before.snapshot.revision) events.push(snapshotEvent(restaurant, incident.id));
  setState({
    restaurant,
    messages: state.messages.some((m) => m.id === message.id) ? state.messages : [...state.messages, message],
    activity: [...state.activity, ...events],
  });
}

/** P2-owned IMPACT_ASSESSED. */
export function assessImpactAction(incidentId: string): void {
  const before = state.restaurant.incidents.find((i) => i.id === incidentId);
  const restaurant = assessIncidentImpact(state.restaurant, incidentId);
  const after = restaurant.incidents.find((i) => i.id === incidentId);
  const impact = restaurant.impacts[incidentId];
  setState({
    ...state,
    restaurant,
    activity: [
      ...state.activity,
      event({
        type: "IMPACT_ASSESSED",
        incidentId,
        fromStatus: before?.status,
        toStatus: after?.status,
        provenance: "SIMULATED_CALCULATION",
        detail: `Impact ${impact?.status ?? "UNKNOWN"} on snapshot revision ${restaurant.snapshot.revision}`,
      }),
    ],
  });
}

/** TEST MODE ONLY: simulate a physical recount of accepted chicken (material snapshot change). */
export function simulateChickenRecount(onHandKgMilli: number): void {
  const restaurant = reviseSnapshot(state.restaurant, `Simulated recount: accepted chicken ${onHandKgMilli / 1000} kg`, (d) => {
    const lot = d.ingredientLots.find((l) => l.id === "HP-LOT-CH-001");
    if (lot) lot.onHandMilli = onHandKgMilli;
  });
  if (restaurant === state.restaurant) return;
  setState({ ...state, restaurant, activity: [...state.activity, snapshotEvent(restaurant)] });
}

export function resetDemo(): void {
  counter = 0;
  setState({ ...initial(), activity: [event({ type: "DEMO_RESET", provenance: "SYNTHETIC_BUSINESS", detail: "Canonical synthetic state HP-SNAP-001 restored" })] });
}

function snapshotEvent(restaurant: RestaurantState, incidentId?: string): ActivityEvent {
  const change = restaurant.changeLog.at(-1)!;
  return event({ type: "SNAPSHOT_CHANGED", incidentId, provenance: "SYNTHETIC_BUSINESS", detail: `Revision ${change.revision}: ${change.reason}` });
}

/** Tests only: restore the pristine seed and optionally pin the clock. */
export function __resetP2StoreForTests(clock?: () => Date): void {
  counter = 0;
  now = clock ?? (() => new Date());
  state = initial();
  listeners.forEach((l) => l());
}

import { useSyncExternalStore } from "react";
import { CANONICAL_MESSAGE } from "./mockMessageRegistry";

export type InboxChannel = "WHATSAPP" | "OUTLOOK" | "TELEGRAM";
export type InboxStage = "PARSED" | "REVIEW_PENDING" | "LINKED" | "UNMATCHED" | "UNVERIFIED";

export interface InboxMessage {
  id: "HP-MSG-WA-001" | "HP-MSG-OL-001" | "HP-MSG-TG-001" | "HP-MSG-UNKNOWN" | "HP-MSG-SPOOF";
  channel: InboxChannel;
  provenance: "SIMULATED_CHANNEL";
  channelAccountId: string;
  providerMessageId: string;
  senderDisplay: string;
  senderRegistryId: "HP-SUP-001" | null;
  receivedAtIso: string;
  subject?: string;
  rawText: string;
  verification: "VERIFIED_DEMO_CONTACT" | "UNVERIFIED_SENDER";
  stage: InboxStage;
  read: boolean;
  poId: "HP-PO-1042" | null;
  extraction: "RULE_EXTRACTION" | "UNRESOLVED";
  linkedIncidentId?: "HP-INC-001";
}

export interface InboxState {
  messages: readonly InboxMessage[];
  selectedId: InboxMessage["id"];
  suppressedDuplicateCount: number;
  activeFixture: DemoFixtureId;
}

export type DemoFixtureId = "CORE_CHANNELS" | "REVIEW_STATES" | "EMPTY";

const base = {
  provenance: "SIMULATED_CHANNEL",
  senderDisplay: "Demo Poultry Supply A",
  senderRegistryId: "HP-SUP-001",
  rawText: CANONICAL_MESSAGE,
  verification: "VERIFIED_DEMO_CONTACT",
  poId: "HP-PO-1042",
  extraction: "RULE_EXTRACTION",
} as const;

export const SHARED_MOCK_INBOX: readonly InboxMessage[] = [
  { ...base, id: "HP-MSG-WA-001", channel: "WHATSAPP", channelAccountId: "demo-whatsapp", providerMessageId: "sim:whatsapp:001", receivedAtIso: "2026-11-21T09:01:00+08:00", stage: "REVIEW_PENDING", read: false },
  { ...base, id: "HP-MSG-OL-001", channel: "OUTLOOK", channelAccountId: "demo-outlook", providerMessageId: "sim:outlook:001", receivedAtIso: "2026-11-21T09:03:00+08:00", subject: "HP-PO-1042 delivery update", stage: "PARSED", read: false },
  { ...base, id: "HP-MSG-TG-001", channel: "TELEGRAM", channelAccountId: "demo-telegram", providerMessageId: "sim:telegram:001", receivedAtIso: "2026-11-21T09:05:00+08:00", stage: "LINKED", read: true, linkedIncidentId: "HP-INC-001" },
  { ...base, id: "HP-MSG-SPOOF", channel: "WHATSAPP", channelAccountId: "demo-whatsapp", providerMessageId: "sim:whatsapp:spoof", senderDisplay: "Unverified demo sender", senderRegistryId: null, receivedAtIso: "2026-11-21T09:07:00+08:00", verification: "UNVERIFIED_SENDER", stage: "UNVERIFIED", read: false },
  { ...base, id: "HP-MSG-UNKNOWN", channel: "TELEGRAM", channelAccountId: "demo-telegram", providerMessageId: "sim:telegram:unknown", senderDisplay: "Unknown demo contact", senderRegistryId: null, receivedAtIso: "2026-11-21T09:09:00+08:00", rawText: "Hi, can you call me?", verification: "UNVERIFIED_SENDER", poId: null, extraction: "UNRESOLVED", stage: "UNMATCHED", read: false },
] as const;

export const DEMO_FIXTURES: Readonly<Record<DemoFixtureId, { label: string; description: string; messageIds: readonly InboxMessage["id"][] }>> = {
  CORE_CHANNELS: { label: "Core three-channel scenario", description: "One canonical PO message per synthetic source.", messageIds: ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"] },
  REVIEW_STATES: { label: "Review-state scenario", description: "Core messages plus unverified and unmatched review cases.", messageIds: SHARED_MOCK_INBOX.map((message) => message.id) },
  EMPTY: { label: "Empty inbox", description: "No fixture messages loaded.", messageIds: [] },
} as const;

const fixtureMessages = (fixture: DemoFixtureId) => DEMO_FIXTURES[fixture].messageIds.map((id) => SHARED_MOCK_INBOX.find((message) => message.id === id)!);
const initialState = (): InboxState => ({ messages: fixtureMessages("REVIEW_STATES"), selectedId: "HP-MSG-WA-001", suppressedDuplicateCount: 1, activeFixture: "REVIEW_STATES" });
let state: InboxState = initialState();
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }

export const inboxStore = {
  getSnapshot: () => state,
  select(id: InboxMessage["id"]) {
    state = { ...state, selectedId: id, messages: state.messages.map((message) => message.id === id ? { ...message, read: true } : message) };
    emit();
  },
  loadFixture(fixture: DemoFixtureId) {
    const messages = fixtureMessages(fixture);
    state = { messages, selectedId: messages[0]?.id ?? "HP-MSG-WA-001", suppressedDuplicateCount: fixture === "EMPTY" ? 0 : 1, activeFixture: fixture };
    emit();
  },
  reset() { state = initialState(); emit(); },
};

export function useInboxState() {
  return useSyncExternalStore(subscribe, inboxStore.getSnapshot, inboxStore.getSnapshot);
}

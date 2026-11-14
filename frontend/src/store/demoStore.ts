import { CANONICAL_BUSINESS } from "../data/fixtures/happyPotato";
import { parseMockSupplierMessage } from "../features/messaging/mockMessageRuleExtractor";
import { useSyncExternalStore } from "react";
import { CANONICAL_MESSAGE } from "../features/messaging/mockMessageRegistry";

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
  preferences: DemoPreferences;
  loadStatus?: "LOADING" | "ERROR";
}

export interface DemoPreferences { unreadFirst: boolean; showProcessingTimeline: boolean; }

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
  { ...base, id: "HP-MSG-TG-001", channel: "TELEGRAM", channelAccountId: "demo-telegram", providerMessageId: "sim:telegram:001", receivedAtIso: "2026-11-21T09:05:00+08:00", stage: "PARSED", read: false },
  { ...base, id: "HP-MSG-SPOOF", channel: "WHATSAPP", channelAccountId: "demo-whatsapp", providerMessageId: "sim:whatsapp:spoof", senderDisplay: "Unverified demo sender", senderRegistryId: null, receivedAtIso: "2026-11-21T09:07:00+08:00", verification: "UNVERIFIED_SENDER", stage: "UNVERIFIED", read: false },
  { ...base, id: "HP-MSG-UNKNOWN", channel: "TELEGRAM", channelAccountId: "demo-telegram", providerMessageId: "sim:telegram:unknown", senderDisplay: "Unknown demo contact", senderRegistryId: null, receivedAtIso: "2026-11-21T09:09:00+08:00", rawText: "Hi, can you call me?", verification: "UNVERIFIED_SENDER", poId: null, extraction: "UNRESOLVED", stage: "UNMATCHED", read: false },
] as const;

export const DEMO_FIXTURES: Readonly<Record<DemoFixtureId, { label: string; description: string; messageIds: readonly InboxMessage["id"][] }>> = {
  CORE_CHANNELS: { label: "Core three-channel scenario", description: "One canonical PO message per synthetic source.", messageIds: ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"] },
  REVIEW_STATES: { label: "Review-state scenario", description: "Core messages plus unverified and unmatched review cases.", messageIds: SHARED_MOCK_INBOX.map((message) => message.id) },
  EMPTY: { label: "Empty inbox", description: "No fixture messages loaded.", messageIds: [] },
} as const;

const fixtureMessages = (fixture: DemoFixtureId) => DEMO_FIXTURES[fixture].messageIds.map((id) => SHARED_MOCK_INBOX.find((message) => message.id === id)!);
export const DEFAULT_DEMO_PREFERENCES: DemoPreferences = { unreadFirst: false, showProcessingTimeline: true };
const initialState = (): InboxState => ({ messages: fixtureMessages("REVIEW_STATES"), selectedId: "HP-MSG-WA-001", suppressedDuplicateCount: 1, activeFixture: "REVIEW_STATES", preferences: DEFAULT_DEMO_PREFERENCES });
let state = createDemoState();
const listeners = new Set<() => void>();

function freeze(value: unknown): void { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } }
freeze(state);
function emit() { freeze(state); listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); }

export const demoStore = {
  subscribe,
  dispatch,
  getSnapshot: () => state,
  select(id: InboxMessage["id"]) {
    state = { ...state, selectedId: id, messages: state.messages.map((message) => message.id === id ? { ...message, read: true } : message) };
    emit();
  },
  loadFixture(fixture: DemoFixtureId) {
    const messages = fixtureMessages(fixture);
    state = { ...state, messages, selectedId: messages[0]?.id ?? "HP-MSG-WA-001", suppressedDuplicateCount: fixture === "EMPTY" ? 0 : 1, activeFixture: fixture };
    emit();
  },
  setMockLoadStatus(loadStatus?: "LOADING" | "ERROR") { state = { ...state, loadStatus }; emit(); },
  setPreference<K extends keyof DemoPreferences>(key: K, value: DemoPreferences[K]) { state = { ...state, preferences: { ...state.preferences, [key]: value } }; emit(); },
  reset() { state = createDemoState(); emit(); },
};

export function useDemoState() {
  return useSyncExternalStore(subscribe, demoStore.getSnapshot, demoStore.getSnapshot);
}
export function fingerprint(value: unknown): string {
 let hash = 2166136261;
 for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
 return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
}
function createDemoState() {
 return { ...initialState(), business: CANONICAL_BUSINESS, snapshot: { ...CANONICAL_BUSINESS.snapshot, fingerprint: fingerprint(CANONICAL_BUSINESS) }, incident: { id: "HP-INC-001", poId: "HP-PO-1042", ingredientId: "HP-ING-CHICKEN", status: "PENDING_VERIFICATION" as "PENDING_VERIFICATION" | "VERIFIED", claimedShortfallKgMilli: 20000, messageIds: [] as InboxMessage["id"][] }, reviews: [] as { messageId: InboxMessage["id"]; version: number; extraction: ReturnType<typeof parseMockSupplierMessage> }[] };
}
export type DemoState = ReturnType<typeof createDemoState>;
export type DemoEvent = { type: "DEMO_RESET" } | { type: "MESSAGE_RECEIVED"; message: InboxMessage } | { type: "MESSAGE_EXTRACTION_REVIEWED"; messageId: InboxMessage["id"] } | { type: "INCIDENT_VERIFIED"; messageIds: InboxMessage["id"][] };
function dispatch(event: DemoEvent) {
 if (event.type === "DEMO_RESET") state = createDemoState();
 else if (event.type === "MESSAGE_RECEIVED") {
  const message = event.message;
  if (state.messages.some(item => item.channel === message.channel && item.channelAccountId === message.channelAccountId && item.providerMessageId === message.providerMessageId)) state = { ...state, suppressedDuplicateCount: state.suppressedDuplicateCount + 1 };
  else if (state.messages.some(item => item.id === message.id)) throw new Error("Message ID collision");
  else state = { ...state, messages: [...state.messages, structuredClone(message)] };
 } else if (event.type === "MESSAGE_EXTRACTION_REVIEWED") {
  const message = state.messages.find(item => item.id === event.messageId);
  if (!message) throw new Error("Unknown message");
  const extraction = parseMockSupplierMessage(message);
  if (extraction.senderVerification !== "VERIFIED_DEMO_CONTACT" || extraction.poMatch !== "MATCHED") throw new Error("Unsafe review");
  state = { ...state, reviews: [...state.reviews, { messageId: message.id, version: state.reviews.filter(item => item.messageId === message.id).length + 1, extraction }] };
 } else {
  if (!event.messageIds.length || event.messageIds.some(id => !state.reviews.some(review => review.messageId === id))) throw new Error("Reviewed messages required");
  const messageIds = [...new Set([...state.incident.messageIds, ...event.messageIds])];
  state = { ...state, incident: { ...state.incident, status: "VERIFIED", messageIds }, messages: state.messages.map(message => messageIds.includes(message.id) ? { ...message, linkedIncidentId: "HP-INC-001", stage: "LINKED" } : message) };
 }
 emit();
}
export const selectActiveIncident = (value: DemoState) => value.incident;
export const selectMessagesForIncident = (value: DemoState) => value.messages.filter(message => value.incident.messageIds.includes(message.id));
export const selectOperationalSnapshot = (value: DemoState) => ({ ...value.snapshot, capturedAtIso: "2026-11-21T09:00:00+08:00", demoBusinessDate: value.business.fixtureBusinessDate, ingredientLots: value.business.inventoryLots, purchaseOrders: value.business.purchaseOrders, menuItems: value.business.menuItems, confirmedOrders: value.business.confirmedOrderGroups, forecasts: value.business.forecastDemands, resources: value.business.resources });


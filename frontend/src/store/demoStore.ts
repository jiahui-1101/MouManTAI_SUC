import { CANONICAL_BUSINESS } from "../data/fixtures/happyPotatoP1Contract";
import { parseMockSupplierMessage } from "../features/messaging/mockMessageRuleExtractor";
import { useSyncExternalStore } from "react";
import { CANONICAL_MESSAGE } from "../features/messaging/mockMessageRegistry";
import {
  CANONICAL_OFFER_MESSAGE,
  isOfferMessage,
  offerQualificationBlockers,
  parseMockSupplierOffer,
  type OfferQualification,
  type OfferReviewVersion,
} from "../features/messaging/supplierOffer";
import {
  DEMO_REVIEW_ACTOR,
  RULE_ENGINE_ACTOR,
  buildCorrectionVersion,
  buildDecisionVersion,
  confirmBlockers,
  ruleExtractionVersion,
  type CandidateValues,
  type ExtractionVersion,
} from "../features/messaging/messageReview";

export type InboxChannel = "WHATSAPP" | "OUTLOOK" | "TELEGRAM";
export type InboxStage = "PARSED" | "REVIEW_PENDING" | "LINKED" | "UNMATCHED" | "UNVERIFIED";

export interface InboxMessage {
  id: "HP-MSG-WA-001" | "HP-MSG-OL-001" | "HP-MSG-TG-001" | "HP-MSG-UNKNOWN" | "HP-MSG-SPOOF" | string;
  channel: InboxChannel;
  provenance: "SIMULATED_CHANNEL";
  channelAccountId: string;
  providerMessageId: string;
  senderDisplay: string;
  senderRegistryId: string | null;
  receivedAtIso: string;
  subject?: string;
  rawText: string;
  verification: "VERIFIED_DEMO_CONTACT" | "UNVERIFIED_SENDER";
  stage: InboxStage;
  read: boolean;
  poId: "HP-PO-1042" | null;
  extraction: "RULE_EXTRACTION" | "UNRESOLVED";
  linkedIncidentId?: "HP-INC-001";
  /** Disruption reports can link to incidents; supplier offers are claims for P3 and never stock receipt. */
  kind: "DISRUPTION_REPORT" | "SUPPLIER_OFFER";
  offerQualification?: OfferQualification;
}

export interface MockMessageEnvelope {
  id: InboxMessage["id"];
  channel: InboxChannel;
  provenance: "SIMULATED_CHANNEL";
  channelAccountId: string;
  providerMessageId: string;
  senderDisplay: string;
  senderRegistryId: string | null;
  receivedAtIso: string;
  subject?: string;
  rawText: string;
}

export type IngestMockMessageInput =
  | MockMessageEnvelope
  | (Omit<MockMessageEnvelope, "provenance" | "senderDisplay"> & {
      provenance?: "SIMULATED_CHANNEL";
      senderDisplay?: string;
      read?: boolean;
    })
  | InboxMessage;

export interface IngestResult {
  status: "INGESTED" | "DUPLICATE";
  message?: InboxMessage;
  suppressedDuplicateCount: number;
}

export interface InboxState {
  messages: readonly InboxMessage[];
  selectedId: InboxMessage["id"];
  suppressedDuplicateCount: number;
  activeFixture: DemoFixtureId;
  preferences: DemoPreferences;
  loadStatus?: "LOADING" | "ERROR";
}

export interface DemoPreferences {
  unreadFirst: boolean;
  showProcessingTimeline: boolean;
}

export type IncidentHandoffStatus = "NOT_PUBLISHED" | "AWAITING_P2_CONSUMER" | "ACKNOWLEDGED_BY_P2";

export type P1PublishedEvent =
  | { type: "MESSAGE_EXTRACTION_REVIEWED"; sequence: number; messageId: string; extractionVersionId: string; atIso: string }
  | { type: "INCIDENT_VERIFIED"; sequence: number; incidentId: "HP-INC-001"; poId: "HP-PO-1042"; ingredientId: "HP-ING-CHICKEN"; messageIds: readonly string[]; snapshotId: "HP-SNAP-001"; snapshotRevision: 1; claimedShortfallKgMilli: number; atIso: string };

export type DemoFixtureId = "CORE_CHANNELS" | "REVIEW_STATES" | "SUPPLIER_OFFER" | "EMPTY";

export const CANONICAL_MOCK_ENVELOPES: readonly MockMessageEnvelope[] = [
  {
    id: "HP-MSG-WA-001",
    channel: "WHATSAPP",
    provenance: "SIMULATED_CHANNEL",
    channelAccountId: "demo-whatsapp",
    providerMessageId: "sim:whatsapp:001",
    senderDisplay: "Demo Poultry Supply A",
    senderRegistryId: "HP-SUP-001",
    receivedAtIso: "2026-11-21T09:01:00+08:00",
    rawText: CANONICAL_MESSAGE,
  },
  {
    id: "HP-MSG-OL-001",
    channel: "OUTLOOK",
    provenance: "SIMULATED_CHANNEL",
    channelAccountId: "demo-outlook",
    providerMessageId: "sim:outlook:001",
    senderDisplay: "Demo Poultry Supply A",
    senderRegistryId: "HP-SUP-001",
    receivedAtIso: "2026-11-21T09:03:00+08:00",
    subject: "HP-PO-1042 delivery update",
    rawText: CANONICAL_MESSAGE,
  },
  {
    id: "HP-MSG-TG-001",
    channel: "TELEGRAM",
    provenance: "SIMULATED_CHANNEL",
    channelAccountId: "demo-telegram",
    providerMessageId: "sim:telegram:001",
    senderDisplay: "Demo Poultry Supply A",
    senderRegistryId: "HP-SUP-001",
    receivedAtIso: "2026-11-21T09:05:00+08:00",
    rawText: CANONICAL_MESSAGE,
  },
  {
    id: "HP-MSG-SPOOF",
    channel: "WHATSAPP",
    provenance: "SIMULATED_CHANNEL",
    channelAccountId: "demo-whatsapp",
    providerMessageId: "sim:whatsapp:spoof",
    senderDisplay: "Unverified demo sender",
    senderRegistryId: null,
    receivedAtIso: "2026-11-21T09:07:00+08:00",
    rawText: CANONICAL_MESSAGE,
  },
  {
    id: "HP-MSG-UNKNOWN",
    channel: "TELEGRAM",
    provenance: "SIMULATED_CHANNEL",
    channelAccountId: "demo-telegram",
    providerMessageId: "sim:telegram:unknown",
    senderDisplay: "Unknown demo contact",
    senderRegistryId: null,
    receivedAtIso: "2026-11-21T09:09:00+08:00",
    rawText: "Hi, can you call me?",
  },
  {
    id: "HP-MSG-OL-OFFER",
    channel: "OUTLOOK",
    provenance: "SIMULATED_CHANNEL",
    channelAccountId: "demo-outlook",
    providerMessageId: "sim:outlook:offer",
    senderDisplay: "Demo Poultry Supply B",
    senderRegistryId: "HP-SUP-002",
    receivedAtIso: "2026-11-21T09:12:00+08:00",
    subject: "Re: HP-RFQ-1042",
    rawText: CANONICAL_OFFER_MESSAGE,
  },
] as const;

export function deriveMessageState(
  message: {
    id: InboxMessage["id"];
    rawText: string;
    senderRegistryId: string | null;
  },
  reviews: readonly { messageId: InboxMessage["id"] }[],
  incident: { messageIds: readonly InboxMessage["id"][] },
  offerReviews: readonly OfferReviewVersion[] = []
): {
  verification: "VERIFIED_DEMO_CONTACT" | "UNVERIFIED_SENDER";
  poId: "HP-PO-1042" | null;
  extraction: "RULE_EXTRACTION" | "UNRESOLVED";
  stage: InboxStage;
  linkedIncidentId?: "HP-INC-001";
  kind: InboxMessage["kind"];
  offerQualification?: OfferQualification;
} {
  if (isOfferMessage(message.rawText)) {
    const latest = offerReviews.filter((v) => v.messageId === message.id).at(-1);
    const offerQualification = latest?.qualification ?? "UNREVIEWED";
    const offer = parseMockSupplierOffer({ rawText: message.rawText, senderRegistryId: message.senderRegistryId });
    return {
      kind: "SUPPLIER_OFFER",
      offerQualification,
      verification: offerQualification === "QUALIFIED_CONDITIONAL" ? "VERIFIED_DEMO_CONTACT" : "UNVERIFIED_SENDER",
      poId: null,
      extraction: offer.method,
      stage: offerQualification === "QUALIFIED_CONDITIONAL" ? "PARSED" : offerQualification === "UNREVIEWED" ? "UNVERIFIED" : "REVIEW_PENDING",
    };
  }
  const parseResult = parseMockSupplierMessage({
    rawText: message.rawText,
    senderRegistryId: message.senderRegistryId,
  });

  const isLinked = incident.messageIds.includes(message.id);
  const isReviewed = reviews.some((r) => r.messageId === message.id);

  let stage: InboxStage;
  if (isLinked) {
    stage = "LINKED";
  } else if (isReviewed) {
    stage = "REVIEW_PENDING";
  } else if (parseResult.extraction.method === "UNRESOLVED" || parseResult.poMatch === "UNRESOLVED") {
    stage = "UNMATCHED";
  } else if (parseResult.senderVerification === "UNVERIFIED_SENDER") {
    stage = "UNVERIFIED";
  } else {
    stage = "PARSED";
  }

  return {
    verification: parseResult.senderVerification,
    poId: (parseResult.extraction.poId as "HP-PO-1042" | undefined) ?? null,
    extraction: parseResult.extraction.method,
    stage,
    linkedIncidentId: isLinked ? "HP-INC-001" : undefined,
    kind: "DISRUPTION_REPORT",
  };
}

export function buildMessageFromEnvelope(
  envelope: IngestMockMessageInput,
  reviews: readonly { messageId: InboxMessage["id"] }[],
  incident: { messageIds: readonly InboxMessage["id"][] },
  read = false,
  offerReviews: readonly OfferReviewVersion[] = []
): InboxMessage {
  const senderRegistryId = (envelope.senderRegistryId as string | null) ?? null;
  const derived = deriveMessageState(
    {
      id: envelope.id as InboxMessage["id"],
      rawText: envelope.rawText,
      senderRegistryId,
    },
    reviews,
    incident,
    offerReviews
  );

  return {
    id: envelope.id as InboxMessage["id"],
    channel: envelope.channel,
    provenance: "SIMULATED_CHANNEL",
    channelAccountId: envelope.channelAccountId,
    providerMessageId: envelope.providerMessageId,
    senderDisplay:
      envelope.senderDisplay ??
      (senderRegistryId === "HP-SUP-001" ? "Demo Poultry Supply A" : "Unknown demo contact"),
    senderRegistryId,
    receivedAtIso: envelope.receivedAtIso,
    subject: envelope.subject,
    rawText: envelope.rawText,
    verification: derived.verification,
    stage: derived.stage,
    read: (envelope as Partial<InboxMessage>).read ?? read,
    poId: derived.poId,
    extraction: derived.extraction,
    linkedIncidentId: derived.linkedIncidentId,
    kind: derived.kind,
    offerQualification: derived.offerQualification,
  };
}

export const SHARED_MOCK_INBOX: readonly InboxMessage[] = CANONICAL_MOCK_ENVELOPES.map((env) =>
  buildMessageFromEnvelope(env, [], { messageIds: [] })
);

export const DEMO_FIXTURES: Readonly<
  Record<DemoFixtureId, { label: string; description: string; messageIds: readonly InboxMessage["id"][] }>
> = {
  CORE_CHANNELS: {
    label: "Core three-channel scenario",
    description: "One canonical PO message per synthetic source.",
    messageIds: ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001"],
  },
  REVIEW_STATES: {
    label: "Review-state scenario",
    description: "Core messages plus unverified and unmatched review cases.",
    messageIds: ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001", "HP-MSG-SPOOF", "HP-MSG-UNKNOWN"],
  },
  SUPPLIER_OFFER: {
    label: "Review states + supplier offer",
    description: "Adds the optional HP-MSG-OL-OFFER claim for P3 sender-qualification review.",
    messageIds: ["HP-MSG-WA-001", "HP-MSG-OL-001", "HP-MSG-TG-001", "HP-MSG-SPOOF", "HP-MSG-UNKNOWN", "HP-MSG-OL-OFFER"],
  },
  EMPTY: { label: "Empty inbox", description: "No fixture messages loaded.", messageIds: [] },
} as const;

function fixtureMessages(
  fixture: DemoFixtureId,
  reviews: readonly { messageId: InboxMessage["id"] }[] = [],
  incident: { messageIds: readonly InboxMessage["id"][] } = { messageIds: [] }
): InboxMessage[] {
  const ids = DEMO_FIXTURES[fixture].messageIds;
  return CANONICAL_MOCK_ENVELOPES.filter((env) => ids.includes(env.id)).map((env) =>
    buildMessageFromEnvelope(env, reviews, incident)
  );
}

export const DEFAULT_DEMO_PREFERENCES: DemoPreferences = {
  unreadFirst: false,
  showProcessingTimeline: true,
};

function initialIncident() {
  return {
    id: "HP-INC-001" as const,
    poId: "HP-PO-1042" as const,
    ingredientId: "HP-ING-CHICKEN" as const,
    supplierId: "HP-SUP-001" as const,
    type: "UNAVAILABLE" as const,
    snapshotId: "HP-SNAP-001" as const,
    snapshotRevision: 1 as const,
    status: "PENDING_VERIFICATION" as "PENDING_VERIFICATION" | "VERIFIED",
    claimedShortfallKgMilli: 20000,
    messageIds: [] as InboxMessage["id"][],
    verifiedAtIso: null as string | null,
    /** P1 -> P2 handoff. P1 never computes impact; P2 acknowledges when its consumer has run. */
    handoff: { target: "/impact" as const, status: "NOT_PUBLISHED" as IncidentHandoffStatus },
  };
}

function initialState(): InboxState {
  const messages = fixtureMessages("REVIEW_STATES");
  return {
    messages,
    selectedId: messages[0]?.id ?? "HP-MSG-WA-001",
    suppressedDuplicateCount: 0,
    activeFixture: "REVIEW_STATES",
    preferences: DEFAULT_DEMO_PREFERENCES,
  };
}

function createDemoState() {
  const incident = initialIncident();
  return {
    ...initialState(),
    business: CANONICAL_BUSINESS,
    snapshot: {
      ...CANONICAL_BUSINESS.snapshot,
      fingerprint: fingerprint(CANONICAL_BUSINESS),
    },
    incident,
    reviews: [] as {
      messageId: InboxMessage["id"];
      version: number;
      extraction: ReturnType<typeof parseMockSupplierMessage>;
    }[],
    /** Appended human review versions (v2+). Version 1 is derived from the rule extractor. */
    extractionHistory: [] as ExtractionVersion[],
    /** Typed P1 events published to downstream consumers (append-only, offline). */
    publishedEvents: [] as P1PublishedEvent[],
    /** Appended supplier-offer qualification decisions (v2+). */
    offerReviews: [] as OfferReviewVersion[],
  };
}

let state: DemoState = createDemoState();
const listeners = new Set<() => void>();

function freeze(value: unknown): void {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}
freeze(state);

function emit() {
  freeze(state);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function executeIngestMockMessage(input: IngestMockMessageInput): IngestResult {
  const isDuplicate = state.messages.some(
    (item) =>
      item.channel === input.channel &&
      item.channelAccountId === input.channelAccountId &&
      item.providerMessageId === input.providerMessageId
  );

  if (isDuplicate) {
    state = {
      ...state,
      suppressedDuplicateCount: state.suppressedDuplicateCount + 1,
    };
    emit();
    return {
      status: "DUPLICATE",
      suppressedDuplicateCount: state.suppressedDuplicateCount,
    };
  }

  if (state.messages.some((item) => item.id === input.id)) {
    throw new Error("Message ID collision");
  }

  const message = buildMessageFromEnvelope(input, state.reviews, state.incident, false, state.offerReviews);
  state = {
    ...state,
    messages: [...state.messages, message],
  };
  emit();
  return { status: "INGESTED", message, suppressedDuplicateCount: state.suppressedDuplicateCount };
}

export const demoStore = {
  subscribe,
  dispatch,
  getSnapshot: () => state,
  ingestMockMessage(input: IngestMockMessageInput) {
    return executeIngestMockMessage(input);
  },
  select(id: InboxMessage["id"]) {
    state = {
      ...state,
      selectedId: id,
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, read: true } : message
      ),
    };
    emit();
  },
  loadFixture(fixture: DemoFixtureId) {
    const freshIncident = initialIncident();
    const freshReviews: DemoState["reviews"] = [];
    const messages = fixtureMessages(fixture, freshReviews, freshIncident);
    state = {
      ...state,
      messages,
      selectedId: messages[0]?.id ?? "HP-MSG-WA-001",
      suppressedDuplicateCount: 0,
      activeFixture: fixture,
      reviews: freshReviews,
      incident: freshIncident,
      extractionHistory: [],
      offerReviews: [],
      publishedEvents: [],
    };
    emit();
  },
  setMockLoadStatus(loadStatus?: "LOADING" | "ERROR") {
    state = { ...state, loadStatus };
    emit();
  },
  setPreference<K extends keyof DemoPreferences>(key: K, value: DemoPreferences[K]) {
    state = { ...state, preferences: { ...state.preferences, [key]: value } };
    emit();
  },
  reset() {
    state = createDemoState();
    emit();
  },
  /** Appends an immutable HUMAN_CORRECTION version; raw text and earlier versions are untouched. */
  saveExtractionCorrection(messageId: InboxMessage["id"], values: CandidateValues, options: { at?: string; note?: string } = {}) {
    const latest = latestVersionOrThrow(messageId);
    const next = buildCorrectionVersion(latest, values, options.at ?? new Date().toISOString(), undefined, options.note);
    appendVersion(next);
    return next;
  },
  decideExtractionReview(messageId: InboxMessage["id"], decision: "REJECTED" | "MARKED_UNRESOLVED", note: string, at?: string) {
    if (!note.trim()) throw new Error("A reason is required");
    const latest = latestVersionOrThrow(messageId);
    if (latest.reviewStatus === "VERIFIED") throw new Error("Confirmed reviews cannot be rejected here");
    const next = buildDecisionVersion(latest, decision, at ?? new Date().toISOString(), undefined, note.trim());
    appendVersion(next);
    return next;
  },
  /** First safe confirmation: verifies HP-INC-001. Idempotent for an already-linked message. */
  confirmExtractionReview(messageId: InboxMessage["id"], at?: string) {
    if (state.incident.messageIds.includes(messageId)) return { status: "ALREADY_LINKED" as const };
    if (state.incident.status === "VERIFIED") throw new Error(`${state.incident.id} is already verified; use Link to existing incident.`);
    commitIncidentLink(messageId, at ?? new Date().toISOString());
    return { status: "VERIFIED" as const };
  },
  /** Links a further safely reviewed message to the existing verified incident. Idempotent. */
  linkMessageToIncident(messageId: InboxMessage["id"], at?: string) {
    if (state.incident.messageIds.includes(messageId)) return { status: "ALREADY_LINKED" as const };
    if (state.incident.status !== "VERIFIED") throw new Error("No verified incident to link to; confirm the first message instead.");
    commitIncidentLink(messageId, at ?? new Date().toISOString());
    return { status: "LINKED" as const };
  },
  /** Explicit sender/claim qualification for a supplier offer. Never creates stock, POs or business offers. */
  reviewSupplierOffer(messageId: InboxMessage["id"], decision: "QUALIFIED" | "REJECTED" | "MARKED_UNRESOLVED", note: string, at?: string) {
    const message = state.messages.find((m) => m.id === messageId);
    if (!message || message.kind !== "SUPPLIER_OFFER") throw new Error("Not a supplier offer message");
    if (!note.trim()) throw new Error("A review reason is required");
    const versions = selectOfferReviewVersions(state, messageId);
    const latest = versions[versions.length - 1]!;
    const qualification: OfferQualification = decision === "QUALIFIED" ? "QUALIFIED_CONDITIONAL" : decision === "REJECTED" ? "REJECTED" : "UNRESOLVED";
    if (latest.qualification === qualification) return latest; // idempotent
    if (decision === "QUALIFIED") {
      const blockers = offerQualificationBlockers(message.senderRegistryId, parseMockSupplierOffer(message));
      if (blockers.length) throw new Error(blockers.join(" "));
    }
    const next: OfferReviewVersion = {
      id: `${messageId}-OFR-v${latest.version + 1}`, messageId, version: latest.version + 1, method: "HUMAN_REVIEW",
      qualification, decision, actor: DEMO_REVIEW_ACTOR, createdAtIso: at ?? new Date().toISOString(), note: note.trim(),
    };
    const offerReviews = [...state.offerReviews, next];
    state = { ...state, offerReviews, messages: state.messages.map((m) => buildMessageFromEnvelope(m, state.reviews, state.incident, m.read, offerReviews)) };
    emit();
    return next;
  },
  /** Called by the P2 consumer once it has actually processed the verified incident. */
  acknowledgeIncidentHandoff() {
    if (state.incident.status !== "VERIFIED" || state.incident.handoff.status === "ACKNOWLEDGED_BY_P2") return;
    state = { ...state, incident: { ...state.incident, handoff: { ...state.incident.handoff, status: "ACKNOWLEDGED_BY_P2" } } };
    emit();
  },
};

export function selectOfferReviewVersions(value: DemoState, messageId: InboxMessage["id"]): readonly OfferReviewVersion[] {
  const message = value.messages.find((m) => m.id === messageId);
  if (!message || message.kind !== "SUPPLIER_OFFER") return [];
  const v1: OfferReviewVersion = { id: `${messageId}-OFR-v1`, messageId, version: 1, method: "RULE_EXTRACTION", qualification: "UNREVIEWED", decision: "EXTRACTED", actor: RULE_ENGINE_ACTOR, createdAtIso: message.receivedAtIso };
  return [v1, ...value.offerReviews.filter((v) => v.messageId === messageId)];
}

export function incidentLinkBlockers(value: DemoState, messageId: InboxMessage["id"]): string[] {
  const message = value.messages.find((item) => item.id === messageId);
  if (!message) return ["Unknown message."];
  const versions = selectExtractionVersions(value, messageId);
  const latest = versions[versions.length - 1]!;
  if (value.incident.messageIds.includes(messageId)) return [];
  if (message.kind === "SUPPLIER_OFFER") return ["Supplier offers are P3 offer claims and cannot be linked as disruption evidence."];
  return confirmBlockers(latest, {
    senderRegistryId: message.senderRegistryId,
    canonicalIncidentShortfallKgMilli: value.incident.claimedShortfallKgMilli,
    incidentPoId: value.incident.poId,
    incidentSupplierId: value.incident.supplierId,
    incidentType: value.incident.type,
  });
}

/** Atomic: CONFIRMED version + review record + incident messageIds + derived message stages, one emit. */
function commitIncidentLink(messageId: InboxMessage["id"], at: string) {
  const blockers = incidentLinkBlockers(state, messageId);
  if (blockers.length) throw new Error(blockers.join(" "));
  const message = state.messages.find((item) => item.id === messageId)!;
  const latest = latestVersionOrThrow(messageId);
  const extraction = parseMockSupplierMessage(message);
  const reviews = [
    ...state.reviews,
    { messageId, version: state.reviews.filter((r) => r.messageId === messageId).length + 1, extraction },
  ];
  const wasVerified = state.incident.status === "VERIFIED";
  const confirmed = buildDecisionVersion(latest, "CONFIRMED", at, undefined, wasVerified ? `Linked to ${state.incident.id}` : `Verified ${state.incident.id}`);
  const incident = {
    ...state.incident,
    status: "VERIFIED" as const,
    messageIds: [...state.incident.messageIds, messageId],
    verifiedAtIso: state.incident.verifiedAtIso ?? at,
    handoff: wasVerified ? state.incident.handoff : { ...state.incident.handoff, status: "AWAITING_P2_CONSUMER" as const },
  };
  state = {
    ...state,
    reviews,
    incident,
    extractionHistory: [...state.extractionHistory, confirmed],
    publishedEvents: [
      ...state.publishedEvents,
      { type: "MESSAGE_EXTRACTION_REVIEWED", sequence: state.publishedEvents.length + 1, messageId, extractionVersionId: confirmed.id, atIso: at },
      verifiedEvent(incident, state.publishedEvents.length + 2, at),
    ],
    messages: state.messages.map((m) => buildMessageFromEnvelope(m, reviews, incident, m.read, state.offerReviews)),
  };
  emit();
}

export function selectExtractionVersions(value: DemoState, messageId: InboxMessage["id"]): readonly ExtractionVersion[] {
  const message = value.messages.find((item) => item.id === messageId);
  if (!message) return [];
  return [ruleExtractionVersion(message), ...value.extractionHistory.filter((v) => v.messageId === messageId)];
}

function latestVersionOrThrow(messageId: InboxMessage["id"]): ExtractionVersion {
  const versions = selectExtractionVersions(state, messageId);
  const latest = versions[versions.length - 1];
  if (!latest) throw new Error("Unknown message");
  return latest;
}

function appendVersion(version: ExtractionVersion) {
  state = { ...state, extractionHistory: [...state.extractionHistory, version] };
  emit();
}

export function useDemoState() {
  return useSyncExternalStore(subscribe, demoStore.getSnapshot, demoStore.getSnapshot);
}

export function fingerprint(value: unknown): string {
  let hash = 2166136261;
  for (const char of JSON.stringify(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
}

export type DemoState = ReturnType<typeof createDemoState>;

export type DemoEvent =
  | { type: "DEMO_RESET" }
  | { type: "MESSAGE_RECEIVED"; message: IngestMockMessageInput }
  | { type: "MESSAGE_EXTRACTION_REVIEWED"; messageId: InboxMessage["id"] }
  | { type: "INCIDENT_VERIFIED"; messageIds: InboxMessage["id"][] };

function verifiedEvent(incident: DemoState["incident"], sequence: number, atIso: string): P1PublishedEvent {
  return {
    type: "INCIDENT_VERIFIED", sequence, incidentId: incident.id, poId: incident.poId, ingredientId: incident.ingredientId,
    messageIds: [...incident.messageIds], snapshotId: incident.snapshotId, snapshotRevision: incident.snapshotRevision,
    claimedShortfallKgMilli: incident.claimedShortfallKgMilli, atIso,
  };
}

export const selectPublishedEvents = (value: DemoState): readonly P1PublishedEvent[] => value.publishedEvents;

function dispatch(event: DemoEvent) {
  if (event.type === "DEMO_RESET") {
    state = createDemoState();
  } else if (event.type === "MESSAGE_RECEIVED") {
    executeIngestMockMessage(event.message);
    return;
  } else if (event.type === "MESSAGE_EXTRACTION_REVIEWED") {
    const message = state.messages.find((item) => item.id === event.messageId);
    if (!message) throw new Error("Unknown message");
    const extraction = parseMockSupplierMessage(message);
    if (extraction.senderVerification !== "VERIFIED_DEMO_CONTACT" || extraction.poMatch !== "MATCHED") {
      throw new Error("Unsafe review");
    }
    const newReviews = [
      ...state.reviews,
      {
        messageId: message.id,
        version: state.reviews.filter((item) => item.messageId === message.id).length + 1,
        extraction,
      },
    ];
    const newMessages = state.messages.map((m) =>
      buildMessageFromEnvelope(m, newReviews, state.incident, m.read, state.offerReviews)
    );
    state = {
      ...state,
      reviews: newReviews,
      messages: newMessages,
      publishedEvents: [...state.publishedEvents, { type: "MESSAGE_EXTRACTION_REVIEWED" as const, sequence: state.publishedEvents.length + 1, messageId: message.id, extractionVersionId: `${message.id}-EXT-v1`, atIso: new Date().toISOString() }],
    };
  } else {
    if (
      !event.messageIds.length ||
      event.messageIds.some((id) => !state.reviews.some((review) => review.messageId === id))
    ) {
      throw new Error("Reviewed messages required");
    }
    if (state.incident.status === "VERIFIED" && event.messageIds.every((id) => state.incident.messageIds.includes(id))) return;
    const messageIds = [...new Set([...state.incident.messageIds, ...event.messageIds])];
    const newIncident = {
      ...state.incident,
      status: "VERIFIED" as const,
      messageIds,
      verifiedAtIso: state.incident.verifiedAtIso ?? new Date().toISOString(),
      handoff: { ...state.incident.handoff, status: state.incident.handoff.status === "NOT_PUBLISHED" ? ("AWAITING_P2_CONSUMER" as const) : state.incident.handoff.status },
    };
    const newMessages = state.messages.map((m) =>
      buildMessageFromEnvelope(m, state.reviews, newIncident, m.read, state.offerReviews)
    );
    state = {
      ...state,
      incident: newIncident,
      messages: newMessages,
      publishedEvents: [...state.publishedEvents, verifiedEvent(newIncident, state.publishedEvents.length + 1, newIncident.verifiedAtIso ?? new Date().toISOString())],
    };
  }
  emit();
}

export const selectActiveIncident = (value: DemoState) => value.incident;
export const selectMessagesForIncident = (value: DemoState) =>
  value.messages.filter((message) => value.incident.messageIds.includes(message.id));
export const selectOperationalSnapshot = (value: DemoState) => ({
  ...value.snapshot,
  capturedAtIso: "2026-11-21T09:00:00+08:00",
  demoBusinessDate: value.business.fixtureBusinessDate,
  ingredientLots: value.business.inventoryLots,
  purchaseOrders: value.business.purchaseOrders,
  menuItems: value.business.menuItems,
  confirmedOrders: value.business.confirmedOrderGroups,
  forecasts: value.business.forecastDemands,
  resources: value.business.resources,
});

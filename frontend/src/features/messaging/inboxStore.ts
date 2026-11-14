export {
  demoStore as inboxStore,
  useDemoState as useInboxState,
  SHARED_MOCK_INBOX,
  CANONICAL_MOCK_ENVELOPES,
  DEMO_FIXTURES,
  DEFAULT_DEMO_PREFERENCES,
  deriveMessageState,
  buildMessageFromEnvelope,
  selectActiveIncident,
  selectMessagesForIncident,
  selectOperationalSnapshot,
  fingerprint,
} from "../../store/demoStore";

export type {
  InboxMessage,
  InboxChannel,
  InboxStage,
  InboxState,
  DemoPreferences,
  DemoFixtureId,
  MockMessageEnvelope,
  IngestMockMessageInput,
  IngestResult,
  DemoState,
  DemoEvent,
} from "../../store/demoStore";

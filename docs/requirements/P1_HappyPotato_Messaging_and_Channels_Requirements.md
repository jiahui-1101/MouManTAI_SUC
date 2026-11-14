# P1 — Happy Potato Unified Messaging & Supplier Intelligence

> **Part:** P1 · **Owner:** Messaging Frontend Developer · **Version:** 1.0 · **Stage:** Implement after Shared Contract G0/G1  
> **Read first:** [`00_SHARED_HappyPotato_Mock_Data_and_Contracts.md`](./00_SHARED_HappyPotato_Mock_Data_and_Contracts.md). Parent specification: M01 (FR-001–012), M11 (FR-107, FR-112–115), M12 read-only/demo constraints.

## 1. Mission and product boundary

Make MouManTAI SUC look and behave like a real **multi-channel supplier operations inbox** for **Happy Potato**. A person sends a supplier message through **WhatsApp, Outlook Email or Telegram**; the authorized inbound bridge (built separately) will eventually deliver it to the website. P1 owns the **frontend interface and shared message event contract**, plus fixed rule extraction and human review. Business recovery itself is performed by P2–P5.

**Real vs mock:** the inbound message envelope can be genuinely `LIVE_CHANNEL` once a channel is connected and tested; extraction is always `RULE_EXTRACTION` / mock intelligence in this MVP. No real LLM. Do not implement an unofficial WhatsApp Web scraper, expose provider credentials in browser, or label a fixture as a live provider event.

**Happy Potato context:** official site lists flavoured fries, chicken snacks and combos; supplier, PO and recipe values are wholly synthetic. The central event is a **20kg chilled-chicken delivery unavailable today**, not the original Chicken Rice example.

## 2. P1 exclusively owns

| Route | Page title | Required UI |
|---|---|---|
| `/inbox` | Unified Supplier Inbox | Channel filters, message list, conversation preview, sender identity, read/unread, source labels, status and linked incident |
| `/message-intelligence` | Message Intelligence | Original text, evidence-highlighted field extraction, PO match, rule status, human review, confirm/create incident |
| `/channels` | Channel Connections | WhatsApp, Outlook, Telegram connection health, last event, delivery mode, troubleshooting and simulation label |
| `/settings` | Messaging Settings | Demo contact registry, extraction rules summary, simulation preferences; **do not build full product settings/RBAC backend** |

All four routes already exist from Phase 1. Retain global AppHeader/Navigation/PageContainer; do not modify shared shell, root router or global tokens without permission. Prefer child panels or query parameters over adding dynamic routes in parallel development.

Code ownership (suggested): `pages/{Inbox,MessageIntelligence,Channels,Settings}/`, `features/messaging/`, `features/supplier-intelligence/`, plus `services/adapters/` interface files assigned by integrator. Shared `types/`, fixture data and store are maintained centrally; P1 consumes/imports them instead of duplicating constants.

## 3. Required user journeys

### Journey P1-01: Live inbound (primary pitch)

1. User opens `/channels`: see three distinct provider cards and truthful `CONNECTED | CONNECTING | DISCONNECTED | SETUP_REQUIRED | ERROR | SIMULATED` states.
2. A team member sends **exactly** the shared contract's locked sentence from an approved sender via any supported live provider.
3. The minimal bridge ingests and normalizes it, then updates P1 through an adapter (SSE/polling choice left to integration owner).
4. `/inbox` inserts an actual received message with a clear channel badge, `LIVE_CHANNEL`, timestamp, and verification status. Refresh should not be necessary when live subscription is available; if only polling exists, show bounded polling indicator.
5. User opens it; original message must be readable without being edited.
6. `/message-intelligence` shows `Rule-based extraction — no AI model used` and exact extracted fields.
7. Verified sender + exact PO match makes review eligible; user explicitly confirms. P1 publishes `INCIDENT_VERIFIED` for `HP-INC-001`, making P2 Impact flow available.
8. Other live channels with the same supplier/PO/event produce separate inbound messages and can be **linked** to the existing incident instead of double-subtracting inventory.

### Journey P1-02: Offline fallback

- Developer-only `Inject Simulated Message` inserts the same canonical text with `SIMULATED_CHANNEL` and synthetic provider ID; a clearly visible simulation label is mandatory. It follows the same parse/review flow without pretending a real platform connection.
- If all providers are unavailable, testers can still complete P1–P5 end-to-end using the synthetic scenario.
- Reset clears demo processing state while protecting connection credentials and actual provider messages.

### Journey P1-03: Unclear or unverified inbound

- Unknown sender: store/display, mark `UNVERIFIED_SENDER`, do not auto-confirm supplier identity, request authorized human review.
- Unrecognized sentence: `UNRESOLVED`, no invented ingredient/PO/quantity.
- Contradictory phrase or unclear timezone: `HUMAN_REVIEW_REQUIRED`, no authoritative ETA.
- Replay with same `(channel, channelAccountId, providerMessageId)` must not create duplicate inbox event or second incident.

## 4. Locked message and expected extraction

**Send exactly this text in WhatsApp and Telegram, or as the Outlook email body** (Outlook subject `HP-PO-1042 delivery update`):

> Hi Happy Potato, sorry. PO HP-PO-1042: we cannot deliver the 20kg chilled chicken scheduled for today. Delivered quantity today will be 0kg. We will update you tomorrow.

The rule engine emits:

```json
{
  "incident_type": "UNAVAILABLE",
  "po_id": "HP-PO-1042",
  "ingredient_id": "HP-ING-CHICKEN",
  "expected_quantity_kg": "20.000",
  "claimed_delivery_today_kg": "0.000",
  "claimed_shortfall_kg": "20.000",
  "new_eta": null,
  "new_eta_status": "UNKNOWN",
  "method": "RULE_EXTRACTION",
  "review_status": "PENDING"
}
```

`We will update you tomorrow` is **not** a promised delivery ETA; `cannot deliver today` is a disruption claim, **not physical zero stock**. Internal `HP-LOT-CH-001` remains 10kg accepted on hand; P2 owns that calculation. `Happy Potato` in the salutation is recipient, not supplier identity. Sender identity must come from registry/provider envelope.

### Extraction rules (bounded and testable)

| Rule | Allowed inference | Failure mode |
|---|---|---|
| Exact/supported PO pattern | `HP-PO-1042` from original text | Unknown or not in registry → human linking |
| Units | `20kg`, `0kg`, whitespace/case variations with exact tested grammar | Invalid unit or ambiguous quantity → unresolved |
| Ingredient alias | `chilled chicken` → synthetic `HP-ING-CHICKEN` | Unknown protein/spec → review |
| Delivery meaning | Cannot deliver scheduled quantity today → `UNAVAILABLE` | "May be late", negation, mixed events → review |
| Difference | `20 - 0 = 20kg` when PO matches | No matched expected PO → no unverified deficit publication |
| Date | "today" anchored to received event's MYT date | No timezone or message out of window → review |
| Tomorrow update | No ETA inferred | Never set delivery to tomorrow without explicit commitment |
| Allowed sender | Provider-specific ID from private config → synthetic supplier mapping | Unknown → cannot confirm |

Support additional **predefined** messages for `PARTIAL_DELIVERY`, `DELAY`, `PRICE_CHANGE`, `QUALITY_REJECTED`, `CANCELLED`, `SPEC_CHANGE` if time permits, but keep unknown input fail-closed. The 20kg canonical scenario is the acceptance-critical happy path.

Evidence highlight must use actual start/end spans from the raw text, not invented line numbers or model-generated citations. Manual edits create a new `MessageExtraction.version` without altering original. Do not display arbitrary fake confidence percentages.

## 5. Inbox requirements

| ID | Priority | Requirement / interaction |
|---|---|---|
| P1-FR01 | MUST | Channel filters: All, WhatsApp, Outlook, Telegram; each filter returns accurate items |
| P1-FR02 | MUST | Search by masked sender, subject, PO ID, content text; no unauthorised real PII leak |
| P1-FR03 | MUST | Message list displays channel, real/simulated provenance, received date/time, processing stage |
| P1-FR04 | MUST | Detail panel shows full immutable message, sender status, subject (email), provider ID masked/truncated |
| P1-FR05 | MUST | Handle unread/open/reviewed state in one shared store, not local-only per page |
| P1-FR06 | MUST | Correlate approved messages to `HP-INC-001`; same underlying event from multiple channels must not multiply shortages |
| P1-FR07 | MUST | Visible empty, loading, connection-error, duplicate-suppressed, unverified-sender and unmatched-message states |
| P1-FR08 | MUST | Announce new inbound message accessibly, no disruptive auto-navigation |
| P1-FR09 | SHOULD | Desktop split view (list + content), tablet stacked view, keyboard reachability |
| P1-FR10 | SHOULD | Show processing timeline: Received → Parsed → Review → Linked to Incident |

## 6. Message Intelligence + Review requirements

| ID | Priority | Requirement / interaction |
|---|---|---|
| P1-FR11 | MUST | Original vs structured extraction side-by-side; provenance clear |
| P1-FR12 | MUST | PO and sender match from canonical registry; show `MATCHED`, `UNVERIFIED`, or `CONFLICT` |
| P1-FR13 | MUST | Editable candidate fields in human review; validate quantity nonnegative, unit consistent, PO allowed |
| P1-FR14 | MUST | Confirm button disabled when sender/PO/evidence state unsafe; show precise reason |
| P1-FR15 | MUST | On verified review, dispatch typed `INCIDENT_VERIFIED`; include message IDs and snapshot reference |
| P1-FR16 | MUST | Never silently alter raw provider payload or inferred quantity; preserve review history/version |
| P1-FR17 | MUST | Avoid real LLM wording: label `RULE_EXTRACTION` or `HUMAN_CORRECTION` |
| P1-FR18 | SHOULD | Secondary message can be linked as an update to existing incident with explicit user confirmation |
| P1-FR19 | SHOULD | A preview of which menu/PO is impacted can link to P2 but must not compute separate inventory totals |

## 7. Channel Connections — three independent provider cards

| Provider | What P1 shows | Bridge method targeted (not implemented by P1) | Known gate |
|---|---|---|---|
| WhatsApp | Account status, masked test number, last inbound, webhook test diagnostics | Official Meta WhatsApp Cloud API inbound webhook over HTTPS | Meta onboarding/test-number sender/payment restrictions need real account check |
| Outlook | Mailbox connected, scope `Mail.Read`, last poll, last inbound, OAuth status | Microsoft Graph authorized demo mailbox polling/delta | Personal Outlook app registration / consent viability must be validated |
| Telegram | Authorized bot/chat status, last update ID, last inbound | Telegram Bot API long polling, or verified webhook | Token/chat scope configured server-side; never expose in UI |

P1 may display **safe status from the bridge**, not retrieve credentials directly. `Connected` must mean verified actual communication, not just an entered setting. Each provider has `provider`, `mode`, `status`, `lastSuccessfulInboundAt`, `lastErrorCode`, `enabled`, `supportsLive`, `simulationFallbackEnabled`. Never show actual access/refresh tokens or full personal identifiers.

**Bridge API sketch, for integration-contract planning only:**

```text
GET  /bridge/v1/health
GET  /bridge/v1/channels
GET  /bridge/v1/messages?cursor=...
GET  /bridge/v1/messages/stream        # SSE optional
POST /bridge/v1/demo/inject            # local-only, admin/flag protected; never public unauthenticated
```

The actual bridge is a separate workstream. Frontend code uses `InboxAdapter` with `MockInboxAdapter` and `LiveInboxAdapter`; it must accept the same `InboundMessage`. No browser-to-Meta/Graph/Telegram API tokens. Do not create unsafe browser direct calls.

## 8. Cross-part handoffs

| Producer → consumer | Exact artifact | Rule |
|---|---|---|
| P1 → P2 | `INCIDENT_VERIFIED` containing `HP-INC-001`, `HP-PO-1042`, `HP-ING-CHICKEN`, `claimedShortfallKgMilli=20000`, `messageIds[]` | P2 recomputes impact from canonical snapshot; P1 must not invent impact numbers |
| P1 → P3 | Optional `HP-MSG-OL-OFFER` normalized offer evidence | P3 still performs synthetic qualification and does not assume offer physically fulfilled |
| P1 → P5 | Evidence refs and review/version timeline | Used for audit only; not an approval token |
| Bridge → P1 | Real provider envelope | `LIVE_CHANNEL` only when actual event received; idempotent |
| Integrator → P1 | Shared `DemoState` actions/types | No second store or `PO` constants |

When the same locked text arrives through three different providers, expect **three message cards** but **one correlated disruption** for `HP-PO-1042`; require explicit correlation review if origin identity is ambiguous. Do not delete the other messages.

## 9. UI specification (design, not generic dashboard)

- Header/sidebar remain Phase 1; PageContainer title shown consistently.
- Inbox: channel-specific small icons, supplier contact name, PO indicator, relative time and exact absolute timestamp in detail; filter counts derived from current state.
- Live/simulated provenance should be in text, not only colors. Unverified contact is visibly distinct from `RULE_EXTRACTION` status.
- Intelligence view: raw sentence in readable message bubble or email-like card; right-hand field evidence grid; human review controls; trace of raw text → matched PO → incident.
- Channel Settings: 3 status cards and per-channel message test notes. Never imply an integration is connected by design alone.
- Use synthetic brand theme from shared UX blueprint; no fake Happy Potato corporate claims or real franchise dashboard branding authorization.
- Interactions must work (filters, open, review, navigate) and use a meaningful shared state change rather than toast-only feedback.

## 10. Test matrix (Vitest/RTL; E2E on integration)

| Test ID | Given / action | Expected |
|---|---|---|
| P1-T01 | Locked sentence via `SIMULATED_CHANNEL` | 20kg expected, 0kg claimed, `UNAVAILABLE`, ETA unknown |
| P1-T02 | Real event envelope from each channel | Channel/actual provider metadata and `LIVE_CHANNEL` preserved correctly |
| P1-T03 | Repeated exact provider event | One stored message, one notification, no duplicate incident |
| P1-T04 | Same text from three channels | Three messages, single linked incident after review; no 60kg apparent shortage |
| P1-T05 | Unknown sender with correct words | Cannot mark verified without authorized review |
| P1-T06 | `we will update tomorrow` | Never turn into tomorrow delivery ETA |
| P1-T07 | Unsupported sentence | Review state, no fabricated extraction |
| P1-T08 | Human changes extracted quantity | Raw text unchanged; extraction version incremented and audited |
| P1-T09 | Filters: WhatsApp/Outlook/Telegram | Each shows only corresponding events |
| P1-T10 | Bridge disconnected | Error/Retry/Simulated fallback visible and accurately labelled |
| P1-T11 | Replay event | `REPLAY_CHANNEL` label, no forged live claim |
| P1-T12 | Mobile/tablet & keyboard | Detail opens and controls remain usable; no horizontal overflow |

## 11. Deliverables, dependencies and Definition of Done

**Deliver:** four fully interactive P1 pages; typed inbox adapter; canonical parser fixtures/tests; evidence highlight; sender/PO review flow; incident verification event; channel state UX and developer documentation. No live provider integration is considered complete until independently end-to-end tested by integration workstream.

**Depends on:** Phase 1 shell, shared `InboundMessage`, `MessageExtraction`, `Incident`, `DemoState` and fixed Happy Potato dataset; shared team approval of any type changes.

**P1 is done only when:** locked message is correctly extracted and human-verifiable, original evidence survives edits, all 3 channel types appear in the UI, simulated is never mistaken for real, verified incident updates P2 through one shared state, and all P1 tests/typecheck/build pass. Where real bridge is not yet present, report `LIVE CHANNEL INTEGRATION PENDING`, not success.

**Do not:** change global navigation, create backend OAuth/webhook logic inside React, copy old MouManTAI channel code, use actual supplier PII, invent restaurant numbers, implement P2–P5 business features or claim genuine LLM classification.

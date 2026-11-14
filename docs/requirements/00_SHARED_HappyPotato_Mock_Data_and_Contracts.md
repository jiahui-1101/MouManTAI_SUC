# MouManTAI SUC — SHARED Happy Potato Mock Data & Cross-Team Contracts

> **Document ID:** SUC-SHARED-01 · **Version:** 1.0 · **Owner:** Team integration lead / designated shared-contract maintainer · **Status:** Development baseline · **Last updated:** 2026-11-14  
> **Applies to:** P1 Messaging, P2 Impact, P3 Plan A, P4 Plan B, P5 Decision & Outcomes  
> **Mandatory:** Every part **MUST read this document first**, then its part-specific requirements. Never create a second, incompatible source of truth.

## 0. Source and truth boundaries

**Restaurant brand: Happy Potato.** Happy Potato's official website describes a Malaysian flavoured/shaker fries brand, with fries flavours, chicken snacks, and fries + chicken combos. Official product categories include Chicken Popcorn, Chicken Tenders, and Happy Combo. Source: https://www.happypotato.com.my/menu/ and https://www.happypotato.com.my/ (consulted 2026-11-14).

**Everything below about suppliers, operating quantities, recipes, production times, purchase orders, prices, demand, stock, customers, and costs is fictional/synthetic solely for the SUC demonstration.** It is **not** Happy Potato's actual operating data, endorsed recipe, commercial supplier relationship, FeedMe connection, food-safety certification, or company authorization. Product names may resemble public menu categories; synthetic recipe gram weights and MYR prices are *not official prices/specifications*. No real customer PII is required.

The parent requirement file is `MouManTAI_RecoveryPlus_Complete_Requirements_Architecture_Free.md` (v1.0, 2026-11-13). This shared contract supersedes its *Chicken Rice numerical demo* for the Happy Potato SUC demo; core constraints (source evidence, food safety, confirmed-order protection, stale approval, Plan A/B, verification) remain unchanged. Full requirements: M01–M12, FR-001–122, T-01–T-25. The team's revised implementation scope is **real inbound messages on three channels where officially feasible; rule-based/mock intelligence; shared synthetic restaurant data; frontend-driven simulated recovery; minimal separate inbound bridge**.

### 0.1 Truth labels (mandatory UI and data contract)

| Label / provenance | Meaning | Allowed claims |
|---|---|---|
| `LIVE_CHANNEL` | Content and provider event ID actually received from WhatsApp/Outlook/Telegram | "Received from [channel]" only once the bridge confirms it |
| `REPLAY_CHANNEL` | Previously recorded authorized demo event replayed locally | "Replay of previously received event" |
| `SIMULATED_CHANNEL` | Fixture injected from mock UI; not delivered from provider | "Simulated inbound message" — never display as live |
| `RULE_EXTRACTION` | Deterministic matched template/rules | "Rule-based extraction" — not "LLM successfully understood" |
| `HUMAN_CORRECTION` | User-edited interpretation | "Human reviewed", with original preserved |
| `SYNTHETIC_BUSINESS` | Restaurant/PO/inventory/menu/order/offer data from fixtures | "Happy Potato • Demo data" |
| `SIMULATED_CALCULATION` | Deterministic TypeScript or precomputed, validated scenario | "Demo calculation" — not "OR-Tools optimized" |
| `SIMULATED_ACTION` | Local approval/PO draft/menu task only | Never claim real FeedMe/menu/supplier write |
| `SIMULATED_EVIDENCE` | User-added receipt/prep confirmation in demo | "Demo verification", never actual merchant operational proof |

**One real inbound message does not make the whole workflow real.** Keep real message provenance distinct from simulation and predictions. `SENT ≠ ACCEPTED ≠ DELIVERED ≠ FULFILLED`; no claimed delivery becomes accepted inventory merely by arriving in the inbox.

## 1. One-sentence fixed live demo message — LOCKED

This is the **canonical exact text** for the main demonstration. Send it verbatim from an authorized team-controlled account through **WhatsApp, Outlook Email, or Telegram**:

> Hi Happy Potato, sorry. PO HP-PO-1042: we cannot deliver the 20kg chilled chicken scheduled for today. Delivered quantity today will be 0kg. We will update you tomorrow.

| Extraction field | Fixed result | Evidence |
|---|---|---|
| `po_id` | `HP-PO-1042` | `PO HP-PO-1042` |
| `ingredient_id` | `HP-ING-CHICKEN` | `chilled chicken` |
| `expected_quantity_kg` | `20.000` | `20kg` and matching synthetic PO |
| `claimed_delivery_today_kg` | `0.000` | `0kg` |
| `claimed_shortfall_kg` | `20.000` | `20 - 0` |
| `incident_type` | `UNAVAILABLE` (today; future PO still open) | `cannot deliver ... scheduled for today` |
| `new_eta` | `UNKNOWN` | `update you tomorrow` is **not** a promised delivery time |
| `supplier_id` | `HP-SUP-001` only if provider sender maps to verified demo account | Verified contact registry, **not** extracted from "Happy Potato" salutation |
| `evidence_status` | `CLAIM_VERIFIED_SENDER`, not `GOODS_RECEIVED` | Provider provenance + manual PO match |
| `timezone` | `Asia/Kuala_Lumpur` | Demo business clock; actual provider received_at separately retained |

**Do not silently change this sentence, PO number, quantities or status for one person's implementation.** Any adjustment requires updating this file, fixtures and tests together. **Do not reuse the old 14 → 8 kg / Chicken Rice scenario** in Happy Potato SUC.

### 1.1 Three channels, same pipeline

- **WhatsApp:** teammate sends that exact text to the connected, authorized WhatsApp Business test/business number; provider-authenticated webhook → minimal bridge → normalized `InboundMessage` → P1 inbox. Official Cloud API setup/permissions/cost need actual account verification.
- **Outlook:** teammate emails the connected demo mailbox with subject `HP-PO-1042 delivery update`; body is the exact text; authorized Microsoft Graph mailbox polling/delta → bridge → normalized event → P1 inbox. Do not treat polling as webhook.
- **Telegram:** teammate sends the exact text to the team's authorized Telegram bot/chat; Bot API long polling (or verified webhook) → bridge → normalized event → P1 inbox. A Telegram bot receives messages addressed to it, not arbitrary private user chats.
- Every channel MUST be a first-class inbound target. Fallback for a blocked channel is `SIMULATED_CHANNEL` clearly labelled, **never** forged `LIVE_CHANNEL`.
- A provider redelivery of the same event is de-duplicated by `(channel, provider_message_id, channel_account_id)`; separate actual events across WhatsApp/Outlook/Telegram are kept as **three messages**. If all discuss the same PO and incident, offer to **link** them to the same incident after sender/PO review; do not automatically discard them or create three conflicting inventory shortages.
- If sender not allowlisted, show `UNVERIFIED_SENDER`; no automatic verified case or approved action.
- Never store real credentials, tokens, phone numbers, email addresses, sender IDs, or supplier/customer personal data in checked-in fixtures. Local configuration maps authorized real accounts to synthetic supplier IDs.

### 1.2 Controlled extra messages (optional, NOT the main sentence)

| Key | Channel | Example | Outcome |
|---|---|---|---|
| `HP-MSG-WA-001` | WhatsApp | Main locked message | `UNAVAILABLE`, `HP-PO-1042`, 20kg shortfall |
| `HP-MSG-OL-001` | Outlook | Main locked body; subject `HP-PO-1042 delivery update` | Same synthetic PO; link to existing incident if already open |
| `HP-MSG-TG-001` | Telegram | Main locked message | Same synthetic PO; do not double-subtract 20kg |
| `HP-MSG-OL-OFFER` | Outlook | `Re: HP-RFQ-1042. We can offer 15kg chilled chicken at RM16/kg plus RM15 delivery, ETA 10:15 AM today, subject to confirmation.` | An *offer/claim*, not received stock; requires sender-qualification review |
| `HP-MSG-TG-UPDATE` | Telegram | `Update for PO HP-PO-1042: no chilled chicken today. Tomorrow delivery time is not confirmed.` | Incident follow-up, no new 20kg shortfall |
| `HP-MSG-UNKNOWN` | Any | `Hi, can you call me?` | `UNRESOLVED`, Human Review only |
| `HP-MSG-SPOOF` | Any | Main text sent by an unapproved account | Preserve raw message, block verified impact/approval |

**Demo fallback messages** get synthetic provider IDs like `sim:whatsapp:001`; real events retain real provider IDs. Fixture texts are safe; live display may show masked sender labels only.

## 2. Canonical synthetic restaurant setup

| Field | Value |
|---|---|
| Tenant | `HP-TENANT-DEMO` / `Happy Potato — SUC Demo` |
| Outlet | `HP-OUTLET-001` / `Happy Potato — Demo Outlet` (**fictional**, no real address) |
| Currency | `MYR` |
| Business timezone | `Asia/Kuala_Lumpur` (MYT, UTC+08:00) |
| Fixture date | `2026-11-21` for offline replay; **live demo business date** set to current local date and shown as an illustrative operational clock |
| Simulated business clock at start | `09:00` MYT, labelled `DEMO CLOCK` (do not confuse with actual message receipt timestamp) |
| PO due time | `10:00` MYT |
| Alternate-supplier target ETA | `10:15` MYT; goods receipt/quality check assumed complete `10:30` only in conditional scenario |
| Prep cutoff for incremental supply | `10:45` MYT |
| Service windows | Confirmed portions due by `12:30`; forecast demand window through `14:30` |
| Data mode | `SYNTHETIC_BUSINESS` everywhere except actual externally received message envelope |
| Product menu reference | Happy Potato official site lists flavoured fries, chicken snacks and combos; actual quantities/weights/prices **unknown** |

**Date rule:** One real message saying "today" is parsed as its local receive date when supported. Do not silently equate it to the static 2026-11-21 fixture date. A `DemoScenarioMapping` associates the received live event with the illustrative demo business clock/data; UI must show `Live received at ...` separately from `Demo operational scenario`.

### 2.1 Mock supplier registry

| Supplier ID | Display name (fictional) | Purpose | Status |
|---|---|---|---|
| `HP-SUP-001` | Demo Poultry Supply A | Original supplier, main incident | `VERIFIED_DEMO_CONTACT` when configured real sender matches |
| `HP-SUP-002` | Demo Poultry Supply B | Alternative chilled chicken offer | `APPROVED_DEMO_SUPPLIER`, ETA/spec confirmation still conditional |
| `HP-SUP-003` | Demo Budget Frozen Foods | Cheaper but unsuitable frozen offer | `APPROVED_DEMO_CONTACT`, product **INCOMPATIBLE** |
| `HP-SUP-004` | Demo Frozen Fries Distributor | Existing frozen potato fries source | No disruption in main scenario |

Qualification flags (`halal_doc_verified_for_demo`, temperature suitability, approved product spec) are **fictional fixture attributes**, not real-world supplier certifications. Never use actual business names, phone numbers or emails as examples.

### 2.2 Purchase order and stock

| ID | Ingredient | Original PO / Stock | Business meaning |
|---|---|---:|---|
| `HP-PO-1042` | `HP-ING-CHICKEN` chilled chicken | 20.000 kg expected by 10:00 | `OPEN`; after message `SUPPLIER_CLAIMED_UNAVAILABLE_TODAY` |
| `HP-LOT-CH-001` | Chilled chicken | 10.000 kg physical, quality accepted | Eligible on-hand, BEFORE incident, unchanged by message |
| `HP-LOT-FRIES-001` | Frozen potato fries | 30.000 kg physical | Eligible on-hand; fictional inventory, not raw potato |
| `HP-LOT-SEAS-001` | Seasoning | 3.000 kg physical | Sufficient for this demo |
| `HP-LOT-OIL-001` | Frying oil | 10.000 L physical | Supply assumed sufficient, monitored separately |

**Before disruption:** 10kg physical chicken + 20kg planned incoming = 30kg projected, **not 30kg current stock**.  
**After reported disruption:** 10kg physical + 0kg **supplier-claimed** incoming today = 10kg *time-eligible stock in the no-delivery scenario*, pending confirmation.  
**Supply change:** 20kg expected vs 0kg claimed = **20kg shortage against PO**.  
**Demand shortage:** chicken forecast needs **22kg**; after supplier unavailability only 10kg is projected to be on hand; **12kg forecast ingredient gap**. These **20kg PO delta** and **12kg forecast requirement gap** are different metrics. Do not mix them.

### 2.3 Synthetic menu, BOM and demand (canonical)

**Recipe weights and prices are demo assumptions and not official Happy Potato data.** The menu item names reflect public product categories for a realistic restaurant-focused presentation.

| Menu ID | Display name | Chicken kg / portion | Frozen potato fries kg / portion | Synthetic price (RM) | Forecast (portions) | Confirmed (portions) |
|---|---|---:|---:|---:|---:|---:|
| `HP-MENU-CP` | Chicken Popcorn | 0.150 | 0 | 9.90 | 60 | 25 |
| `HP-MENU-CT` | Chicken Tenders | 0.200 | 0 | 11.90 | 40 | 15 |
| `HP-MENU-HC` | Happy Combo — Chicken Popcorn | 0.100 | 0.180 | 15.90 | 50 | 20 |
| `HP-MENU-FR` | Flavoured Fries (Regular) | 0 | 0.200 | 7.90 | 90 | 35 |
| **TOTAL** | | | | | **240** | **95** |

Notes:
- The three chicken-bearing items have **150 forecast portions and 60 confirmed portions**. The fries-only item has 90 forecast and 35 confirmed, and is **unaffected by the chicken outage**.
- Existing confirmed orders are grouped into synthetic `HP-ORD-*` records; no customer identity is required. Store `service_deadline=12:30` for confirmed sample orders, and `forecast_window_end=14:30` for forecasts. Confirmed is a subset of forecast, **not an extra amount to add to forecast**.
- Chicken forecast requirement: `(60 × 0.150) + (40 × 0.200) + (50 × 0.100) = 9 + 8 + 5 = 22.000kg`.
- Chicken confirmed requirement: `(25 × 0.150) + (15 × 0.200) + (20 × 0.100) = 3.75 + 3 + 2 = 8.750kg`.
- Chicken eligible physical stock: `10.000kg`; discretionary balance AFTER protecting confirmed chicken orders = `1.250kg`.
- Frozen fries forecast requirement: `(50 × 0.180) + (90 × 0.200) = 9 + 18 = 27.000kg`, within the 30kg on-hand. Other ingredients and station constraints are assumed sufficient unless explicitly tested.
- Do not claim fries-only menu items are affected by a chilled chicken incident.
- UI must not invent an exact allergen listing for Happy Potato. Use fictional approved recipe metadata, and require manual review for any substitution.

### 2.4 Canonical Plan A: new external supplier

| Field | Value |
|---|---|
| Plan ID | `HP-SC-A-001` |
| Supplier selected | `HP-SUP-002` (fictional) |
| Offered qty | `15.000kg` chilled chicken |
| Unit cost | `RM16.00/kg` |
| Freight | `RM15.00` |
| Additional landed cost | `15 × 16 + 15 = RM255.00` |
| Stated ETA | `10:15` MYT, **supplier claim** |
| Tentative receipt/quality check | `10:30` (conditional demo step, not a completed event) |
| Prep cutoff | `10:45`; if ETA/acceptance slips beyond it, revise feasibility |
| Projected eligible chicken if received | `10 + 15 = 25kg` |
| Full chicken forecast requirement | `22kg`; projected leftover `3kg` |
| Forecast potentially serviceable | All **150 chicken portions** + **90 fries-only portions**, if other constraints pass |
| Projected forecast portions unmet | `0` **conditional**, not a verified outcome |
| Confirmed-order risk | `0` under the conditional schedule |
| Feasibility | **`CONDITIONAL`** until supplier/receipt/spec/time evidence validated |
| External action | RFQ/PO **draft only**; no actual supplier order sent |

Rejected alternative offer (also synthetic): `HP-OFFER-003`: `15kg frozen chicken @ RM14/kg + RM10 freight = RM220`, ETA `13:30`; **INCOMPATIBLE** for chilled specification and too late for cutoff. It must not win because cheaper. The quote itself is not receipt or acceptance.

### 2.5 Canonical Plan B: NO new purchases

| Field | Value |
|---|---|
| Plan ID | `HP-SC-B-001` |
| External new purchase qty / cost | **0kg / RM0** |
| Chicken available | `10.000kg` physically accepted stock |
| Confirmed chicken portions | **60**, consuming **8.750kg** |
| Additional allocation | **12 × Happy Combo — Chicken Popcorn**, consuming **1.200kg** |
| Total chicken used | `8.750 + 1.200 = 9.950kg` |
| Remaining chicken | `10.000 − 9.950 = 0.050kg` |
| Chicken menu output | 25 Chicken Popcorn + 15 Chicken Tenders + 32 Happy Combo = **72 portions** |
| Chicken forecast unmet | `150 − 72 = 78 portions` (forecast, **not** confirmed breaches) |
| Fries-only output | 90 forecast portions unaffected, if stock/capacity sufficient |
| All-menu projected output | `72 + 90 = 162` of 240 forecast portions |
| Confirmed-order risk | **0**, if the confirmed plan completes by deadlines |
| Feasibility | `FEASIBLE` **within the synthetic scenario assumptions**, still subject to mock approval/execution |
| Menu recommendations | Protect 25 CP, 15 CT, 20 HC confirmed; allow +12 HC new; **limit new CP and CT to 0** for the simulated recovery window; no silent impact on existing orders |

**Allocation policy:** `Protect Confirmed First`, then allocate remaining chicken to **Happy Combo — Chicken Popcorn** because this demo policy prioritises the 0.1kg chicken variant. This is a **selected demonstration policy, not a proven globally optimal profit solution**. The team must not claim CP-SAT optimality or extrapolate arbitrary allocations. For altered demand/stock, recompute via deterministic helper or return `UNKNOWN/NEEDS_RECALCULATION` rather than preserving contradictory figures.

**Projected synthetic gross sales exposure (optional):** unmet CP `35 × RM9.90 = RM346.50`, unmet CT `25 × RM11.90 = RM297.50`, unmet HC `18 × RM15.90 = RM286.20`; total **RM930.20 projected sales revenue at risk**, **not** net loss, margin, verified savings, or ROI. Show only with estimate label and price/quantity source; omit if UI cannot show caveat.

### 2.6 Approved simulated kitchen batch schedule for Plan B

| Batch ID | Station | Virtual time (MYT) | Item | Qty | Chicken used | Deadline |
|---|---|---|---|---:|---:|---|
| `HP-BATCH-B-01` | `HP-FRY-CH-A` | 10:55–11:20 | Chicken Popcorn (confirmed) | 25 | 3.750kg | 12:30 |
| `HP-BATCH-B-02` | `HP-FRY-CH-A` | 11:20–11:40 | Happy Combo Chicken Popcorn (confirmed) | 20 | 2.000kg | 12:30 |
| `HP-BATCH-B-03` | `HP-FRY-CH-A` | 11:40–12:05 | Chicken Tenders (confirmed) | 15 | 3.000kg | 12:30 |
| `HP-BATCH-B-04` | `HP-FRY-CH-A` | 12:05–12:20 | Happy Combo Chicken Popcorn (new) | 12 | 1.200kg | 14:30 |

Other synthetic fryer `HP-FRY-CH-B` exists and may support conditional Plan A batches; it is not necessary for Plan B's selected schedule. `HP-FRY-FRIES-A` handles regular fries and combo fries components separately. Actual equipment ratings, staffing, safe holding and procedures are **synthetic demo assumptions, not certified commercial kitchen instructions**. No two batches on the same station may overlap. Do not use any batch as `COMPLETED` until synthetic evidence is entered.

### 2.7 Canonical comparison summary (one source of truth)

| Metric | Plan A | Plan B |
|---|---|---|
| New external purchase | 15kg | 0kg |
| Additional purchase + freight | **RM255.00** | **RM0.00** |
| Chicken available for scenario | **25kg conditional** | **10kg physical** |
| Chicken forecast potentially served | **150 conditional** | **72 simulated** |
| Chicken forecast unmet | **0 conditional** | **78 simulated** |
| Confirmed chicken portions protected | **60 conditional** | **60 planned** |
| Fries-only forecast potentially served | 90 | 90 |
| Food-safety status | Qualified on provided *synthetic* specs; acceptance pending | Existing accepted synthetic stock |
| Status | `CONDITIONAL` | `FEASIBLE` (mock assumptions) |
| Action state | PO draft, pending approval | Menu/prep tasks, pending approval |
| Verified business outcome | `UNVERIFIED` until simulated evidence | `UNVERIFIED` until simulated evidence |

**Never show `RM255 savings` as Plan B's benefit** without accounting for unmet forecast demand and contribution margins. Plan A's RM255 is projected additional landed cost, not a payment already made.

## 3. Shared domain types (contract, not necessarily final code)

Implement these once in `frontend/src/types/` or a dedicated `frontend/src/shared/contracts/`. Teams may import; do not redefine or independently mutate fields. The following TypeScript interfaces are **illustrative canonical shapes**:

```ts
type Channel = 'WHATSAPP' | 'OUTLOOK' | 'TELEGRAM';
type Provenance = 'LIVE_CHANNEL' | 'REPLAY_CHANNEL' | 'SIMULATED_CHANNEL';
type SourceKind = Provenance | 'SYNTHETIC_BUSINESS' | 'SIMULATED_CALCULATION' | 'SIMULATED_ACTION' | 'SIMULATED_EVIDENCE';
type IncidentKind = 'PARTIAL_DELIVERY' | 'DELAY' | 'UNAVAILABLE' | 'QUALITY_REJECTED' | 'PRICE_CHANGE' | 'CANCELLED' | 'SPEC_CHANGE';
type Feasibility = 'FEASIBLE' | 'CONDITIONAL' | 'INFEASIBLE' | 'UNKNOWN';
type ScenarioStrategy = 'A' | 'B';
type OutcomeStatus = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'UNVERIFIED';

type Money = { amountMinor: number; currency: 'MYR' }; // integer sen (25500 = RM255)
type Quantity = { valueMilli: number; unit: 'kg' | 'L' | 'pcs' }; // 10000 = 10.000kg; domain helper must enforce compatible units

interface InboundMessage {
  id: string;
  channel: Channel;
  provenance: Provenance;
  channelAccountId: string; // non-secret logical ID
  providerMessageId: string;
  senderDisplay: string; // masked, demo safe
  senderRegistryId: string | null;
  receivedAtIso: string; // actual provider event, offset-aware
  subject?: string; // Outlook only
  rawText: string; // immutable original
  contentHash: string;
  verification: 'VERIFIED_DEMO_CONTACT' | 'UNVERIFIED_SENDER' | 'PENDING';
  extractionId?: string;
  linkedIncidentId?: string;
}
interface MessageExtraction {
  id: string;
  messageId: string;
  method: 'RULE_EXTRACTION' | 'HUMAN_CORRECTION' | 'UNRESOLVED';
  incidentType?: IncidentKind;
  poId?: string;
  ingredientId?: string;
  expectedKgMilli?: number;
  claimedDeliveryKgMilli?: number;
  shortfallKgMilli?: number;
  etaLocal?: string | null;
  evidenceSpans: { field: string; start: number; end: number; text: string }[];
  version: number;
  reviewStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'UNRESOLVED';
}
interface OperationalSnapshot {
  id: string;
  revision: number;
  fingerprint: string;
  capturedAtIso: string;
  demoBusinessDate: string;
  dataMode: 'SYNTHETIC_BUSINESS';
  ingredientLots: InventoryLot[];
  menuItems: MenuItem[];
  purchaseOrders: PurchaseOrder[];
  confirmedOrders: ConfirmedOrder[];
  forecasts: ForecastDemand[];
  resources: ProductionResource[];
}
interface InventoryLot { id: string; ingredientId: string; onHandMilli: number; unit: 'kg' | 'L'; accepted: boolean; availableAtLocal: string; expiresAtLocal?: string; }
interface MenuItem { id: string; name: string; priceSen: number; chickenKgMilli: number; potatoFriesKgMilli: number; recipeVersion: string; approvedInDemo: boolean; }
interface PurchaseOrder { id: string; supplierId: string; ingredientId: string; expectedKgMilli: number; dueTimeLocal: string; state: 'OPEN' | 'SUPPLIER_CLAIMED_UNAVAILABLE_TODAY' | 'RECEIVED'; }
interface ConfirmedOrder { id: string; menuId: string; portions: number; dueTimeLocal: string; agreedRecipeVersion: string; status: 'CONFIRMED' | 'FULFILLED' | 'AT_RISK'; }
interface ForecastDemand { menuId: string; portions: number; windowEndLocal: string; }
interface ProductionResource { id: string; name: string; capability: string; }
interface SupplierOffer { id: string; supplierId: string; ingredientId: string; quantityKgMilli: number; pricePerKgSen: number; freightSen: number; etaLocal: string; spec: 'CHILLED' | 'FROZEN'; qualification: 'QUALIFIED_CONDITIONAL' | 'INCOMPATIBLE' | 'UNKNOWN'; evidenceRef: string; }
interface Incident {
  id: string; poId: string; ingredientId: string; type: IncidentKind;
  messageIds: string[]; claimedShortfallKgMilli: number;
  status: 'DETECTED' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'IMPACT_ASSESSED' | 'SCENARIOS_READY' | 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTING' | 'AWAITING_EVIDENCE' | 'CLOSED';
  revision: number; snapshotFingerprint: string;
}
interface ImpactSummary { incidentId: string; snapshotFingerprint: string; affectedMenuIds: string[]; confirmedChickenPortions: number; chickenForecastPortions: number; chickenForecastRequirementKgMilli: number; chickenAvailableKgMilli: number; demandGapKgMilli: number; reasons: string[]; }
interface RecoveryScenario {
  id: string; incidentId: string; strategy: ScenarioStrategy;
  snapshotFingerprint: string; version: number; feasibility: Feasibility;
  newPurchaseKgMilli: number; additionalCostSen: number;
  forecastChickenPortionsServed: number; forecastChickenPortionsUnmet: number;
  confirmedChickenPortionsProtected: number;
  assumptions: string[]; evidenceRefs: string[]; actionIds: string[];
  simulatedCalculation: true;
}
interface ApprovalRecord { id: string; scenarioId: string; scenarioVersion: number; snapshotFingerprint: string; actorRole: string; reason: string; state: 'APPROVED' | 'REJECTED' | 'EXPIRED'; consumed: boolean; }
interface ExecutionAction { id: string; scenarioId: string; actionType: 'PO_DRAFT' | 'MENU_LIMIT_TASK' | 'PREP_BATCH_TASK'; state: 'DRAFT' | 'APPROVED' | 'SIMULATED_EXECUTION' | 'AWAITING_EVIDENCE' | 'VERIFIED'; simulated: true; }
interface VerificationEvidence { id: string; actionId: string; source: 'SIMULATED_EVIDENCE'; kind: 'RECEIPT' | 'PREP' | 'MENU_UPDATE' | 'ORDER_FULFILMENT'; observedAtIso: string; payload: Record<string, unknown>; }
interface RecoveryOutcome { incidentId: string; scenarioId: string; status: OutcomeStatus; predicted: Record<string, unknown>; actual: Record<string, unknown> | null; evidenceIds: string[]; simulated: true; }
```

**Recommended stored numeric representation:** integer milligrams is overkill here; integer `kg × 1000` (gram precision) is sufficient for these synthetic recipes and inventory, and integer sen for MYR. Do not use binary floating point to decide plan quantities. Values in docs such as `0.150 kg` map to `150` under `KgMilli`; `10.000 kg` maps to `10000`. Validate bounds and conversions. If a future ingredient uses pcs/L, use explicit unit conversion rules, never arbitrary addition.

## 4. One state store, one shared event flow

**Authoritative frontend state owner:** the team integration lead implements one global `DemoState` and typed selectors/actions. **Do not let each part create its own independently seeded incident, inventory or scenario.** A lightweight Zustand/Context choice may be approved centrally; this spec is technology-agnostic.

```text
Raw InboundMessage       [P1]
  -> MessageExtraction   [P1]
  -> Incident VERIFIED   [P1 → P2]
  -> ImpactSummary       [P2]
  -> Plan A Scenario     [P3]
  -> Plan B Scenario     [P4]
  -> Compare/Choose      [P5]
  -> Approval            [P5]
  -> Simulated Execution [P5]
  -> Demo Evidence       [P5]
  -> Outcome / Memory    [P5]
```

| Event / action | Producer | Consumer(s) | Invariant |
|---|---|---|---|
| `MESSAGE_RECEIVED` | P1 bridge/mock | P1 + P2 | Raw message immutable; idempotent provider ID |
| `MESSAGE_EXTRACTION_REVIEWED` | P1 | P2 | New version, original unchanged |
| `INCIDENT_VERIFIED` | P1 | P2/P3/P4/P5 | Requires verified demo sender/PO or explicit demo supervisor review |
| `SNAPSHOT_CHANGED` | P2/integrator | P3/P4/P5 | Fingerprint/revision increases, previously approved scenario stale |
| `IMPACT_ASSESSED` | P2 | P3/P4/P5 | Same incident/snapshot source |
| `SCENARIO_A_READY` | P3 | P5 | `HP-SC-A-001`, correct RM255 conditional |
| `SCENARIO_B_READY` | P4 | P5 | `HP-SC-B-001`, no external purchase |
| `SCENARIO_SELECTED` | P5 | P3/P4/P5 | One active selection, no actual external action |
| `PLAN_APPROVED` | P5 | P5 | Bound to scenario+snapshot version and simulated role |
| `ACTION_SIMULATED` | P5 | P5 | No real provider/FeedMe/supplier side effects |
| `EVIDENCE_RECORDED` | P5 | P5 | Explicit simulated evidence needed for `SUCCESS` |
| `OUTCOME_VERIFIED` | P5 | all (read only) | Distinguish predicted and simulated actual |
| `DEMO_RESET` | integrator | all | Reset fixture state; never delete actual provider accounts/credentials |

**Common selectors (recommended):** `selectActiveIncident`, `selectMessagesForIncident`, `selectOperationalSnapshot`, `selectImpact`, `selectScenario('A'|'B')`, `selectSelectedScenario`, `selectPendingApprovals`, `selectExecutionTasks`, `selectOutcome`, `selectOverviewCounts`. Pages must consume these, not copy constants.

**Scenario freshness:** any material update to accepted stock, supplier ETA, PO status, confirmed order, recipe version or capacity increments `snapshot.revision` and fingerprint. P3/P4 results become `STALE`. P5 must refuse approval/execution of stale scenario until recalculated. Merely refreshing a UI tab must not change the fingerprint.

**Incident correlation:** a new message with same verified `supplier_id + po_id + incident_type` may be associated with existing `HP-INC-001`, but the distinct message is always retained. If contradiction or unknown identity, mark review-needed. One PO shortfall is not subtracted three times when sent through three channels.

### 4.1 Stable canonical IDs

| Object | Canonical ID |
|---|---|
| Tenant/outlet | `HP-TENANT-DEMO`, `HP-OUTLET-001` |
| Original supplier / PO | `HP-SUP-001`, `HP-PO-1042` |
| Incident | `HP-INC-001` |
| Initial snapshot | `HP-SNAP-001`, revision `1` |
| Ingredient chicken/fries | `HP-ING-CHICKEN`, `HP-ING-FRIES` |
| Menu products | `HP-MENU-CP`, `HP-MENU-CT`, `HP-MENU-HC`, `HP-MENU-FR` |
| Offer / supplier B | `HP-OFFER-002`, `HP-SUP-002` |
| Rejected offer / supplier C | `HP-OFFER-003`, `HP-SUP-003` |
| Recovery scenarios | `HP-SC-A-001`, `HP-SC-B-001` |
| Selected role for owner approval | `HP-USER-OWNER` (fictional) |

## 5. Exact Happy Potato UI/page ownership — already-created Phase 1 routes

Phase 1 provides a common 15-page shell; **do not rename routes casually**.

| P | Owned routes | Page responsibilities |
|---|---|---|
| **P1** | `/inbox`, `/message-intelligence`, `/channels`, `/settings` | Message and integration presentation; extraction and review; settings limited to channel/demo contact mapping |
| **P2** | `/overview`, `/incidents`, `/impact` | Restaurant status, incident impact, snapshot/demand/BOM projections |
| **P3** | `/recovery/plan-a` | Alternative suppliers, offer comparison, RFQ/PO drafts |
| **P4** | `/recovery/plan-b`, `/prep-planning` | No-purchase allocations, menu recovery, kitchen batches |
| **P5** | `/recovery/compare`, `/approvals`, `/execution`, `/outcomes`, `/decision-memory` | Compare, approve, simulate, verify, learn |

`frontend/src/app/router.tsx`, `frontend/src/constants/navigation.ts`, `frontend/src/layouts/*`, `frontend/src/components/layout/*`, `frontend/src/styles/tokens.css` belong to **shared foundation**. Contributors must not modify these without integration-lead approval. New reusable UI components go in `components/ui/` by a named owner to prevent duplicate buttons/cards/badges. Page code stays within its owned routes and feature directories.

## 6. Required reset and scenario modes

1. **Offline seeded scenario:** three synthetic inbound messages have `SIMULATED_CHANNEL` provenance (use an explicit seed button available only in developer/demo mode). All business data synthetic.
2. **Live inbound demonstration:** start with empty new-event queue; receive actual WhatsApp, Outlook, Telegram events into the same bridge contract. Each actual envelope is `LIVE_CHANNEL`; business scenario and analysis remain synthetic. Never create a fake provider message ID for a live message.
3. **Replay:** choose recorded sanitized envelope `REPLAY_CHANNEL`; labelled as replay, not live.
4. **Reset:** restores `HP-SNAP-001` and a clean local scenario; does not erase external provider events or tokens. Live inbox history purge requires a separately authorized admin-only action; for hackathon, avoid implementing hard delete.
5. **Alternative tests:** unverified sender, duplicate event, changed ETA, no Plan A supplier, incompatible frozen chicken, confirmed-order deficit, stale snapshot, unavailable evidence, unrelated message.

## 7. Cross-team handoff gates and test assertions

| Gate | Owner | Must pass |
|---|---|---|
| `G0` Shared contract approval | Integrator + P1–P5 | This document accepted; no conflicting IDs/field names |
| `G1` Seeded state + selectors | Integrator/P2 | All parts render from same snapshot; no per-page fixture copies |
| `G2` Message flow | P1 | Fixed text → 20kg PO delta; 0kg claimed today; unverified sender blocked |
| `G3` Impact | P2 | 22kg forecast requirement; 8.75kg confirmed; 10kg physical; 12kg demand gap; fries unaffected |
| `G4` Plan A | P3 | RM255; 15kg; alternative frozen RM220 rejected; conditional receipt |
| `G5` Plan B | P4 | 0kg purchase; 9.95kg allocation; 0.05kg remain; 72 chicken portions, 78 forecast unmet |
| `G6` Compare/approval/outcome | P5 | Same snapshot, no stale approval, no verified success without simulated evidence |
| `G7` End-to-end | All | One fixed inbound event → correct same-incident output throughout all 15 routes |
| `G8` Three live channel goals | Integrations + P1 | Real test events displayed separately; official provider setup outcome documented |

Minimum shared tests:

```text
A. 60*.15 + 40*.20 + 50*.10 === 22.000kg
B. 25*.15 + 15*.20 + 20*.10 === 8.750kg
C. 10.000kg physical - 8.750kg confirmed === 1.250kg discretionary
D. 25*.15 + 15*.20 + 32*.10 === 9.950kg
E. 10.000 - 9.950 === 0.050kg
F. 150 - (25+15+32) === 78 forecast chicken portions unmet
G. 15*RM16 + RM15 === RM255 additional Plan A landed cost
H. 30.000kg frozen fries >= 50*.180 + 90*.200 === 27.000kg
I. Re-delivered provider ID does not create second inbound event
J. Three distinct channels can link to the same incident without multiplying shortage
K. No approved plan executes if snapshot fingerprint differs
L. No outcome SUCCESS without appropriate explicitly recorded simulated evidence
```

## 8. Explicit scope boundaries and open decisions

- **P1–P5 implement frontend features only**. The small Node message bridge is a **separate integration workstream** and must meet official API rules. P1 provides UI adapter contracts so live provider events can be connected later.
- WhatsApp official Cloud API test-number availability and account onboarding/payment requirements are **NOT yet confirmed** for this team; do not claim live success until an actual event arrives.
- Outlook Microsoft Graph personal account app-registration/consent capabilities are **NOT yet confirmed** for this team; do not claim live success until tested.
- Telegram Bot API permission/allowed chat must be configured securely; do not bundle bot token in frontend.
- No paid LLM, backend ORM/PostgreSQL, credit card, real FeedMe writes, real supplier PO sends, real customer data, or automatic unsafe recipe substitutes are required for the SUC mock core.
- Product recommendation should display `Not a production food-safety or procurement authorization system` wherever needed. The demo role-switcher is not real RBAC.
- All team-specific requirements refer to this file for numeric truths. **This file is the single shared mock-data source of truth; change only by a reviewed cross-team contract revision.**

## 9. Suggested local code organization (names are proposals)

```text
frontend/src/
  types/{messages,restaurant,recovery}.ts  # shared contracts; one owner
  data/fixtures/{happyPotato,channels,scenarios}.ts  # synthetic and simulated only
  services/mock/{restaurantService,scenarioService}.ts
  services/adapters/{inboxAdapter,liveInboxAdapter,mockInboxAdapter}.ts
  store/demoStore.ts   # single canonical state
  utils/{quantity,money,time,scenarioValidation}.ts
  features/{messaging,incidents,impact,recovery,menu,prep,approvals,outcomes}/
```

No team should create a second set of `HP-MENU-*` recipes, `HP-PO-1042` objects, or independently hardcoded RM amounts in its page components. Prefer importable selectors. All source labels and planned/actual distinctions must survive rendering, filtering, and navigation.

---

**Reference:** Official Happy Potato public menu (product categories only): https://www.happypotato.com.my/menu/ · Parent specification: `MouManTAI_RecoveryPlus_Complete_Requirements_Architecture_Free.md` (2026-11-13). All listed operational values are SUC-generated hypothetical examples.

## 10. Canonical fixture blueprint — copy values, not duplicate datasets

The following is **illustrative seed content** to help the integrator create a single importable TypeScript mock fixture. It is **not** an additional independent dataset. Fields that were not listed in the shared TypeScript sketches may be added by the contract owner, with schema changes reviewed by P1–P5. Set the `snapshotFingerprint` by deterministic canonical snapshot hashing/revision tracking at runtime; do not present a static placeholder as a real SHA-256 digest.

```json
{
  "tenant": { "id": "HP-TENANT-DEMO", "name": "Happy Potato — SUC Demo" },
  "outlet": { "id": "HP-OUTLET-001", "name": "Happy Potato — Demo Outlet", "isFictional": true },
  "currency": "MYR",
  "businessTimezone": "Asia/Kuala_Lumpur",
  "fixtureBusinessDate": "2026-11-21",
  "simulationClockLocal": "09:00",
  "snapshot": { "id": "HP-SNAP-001", "revision": 1, "dataMode": "SYNTHETIC_BUSINESS", "fingerprint": "COMPUTE_AT_RUNTIME" },
  "primaryIncident": {
    "id": "HP-INC-001",
    "poId": "HP-PO-1042",
    "ingredientId": "HP-ING-CHICKEN",
    "incidentType": "UNAVAILABLE",
    "originalPoKgMilli": 20000,
    "supplierClaimedTodayKgMilli": 0,
    "poDeltaKgMilli": 20000,
    "verificationDefault": "PENDING_VERIFICATION"
  },
  "suppliers": [
    { "id": "HP-SUP-001", "name": "Demo Poultry Supply A", "synthetic": true },
    { "id": "HP-SUP-002", "name": "Demo Poultry Supply B", "synthetic": true },
    { "id": "HP-SUP-003", "name": "Demo Budget Frozen Foods", "synthetic": true },
    { "id": "HP-SUP-004", "name": "Demo Frozen Fries Distributor", "synthetic": true }
  ],
  "ingredients": [
    { "id": "HP-ING-CHICKEN", "name": "Chilled chicken", "unit": "kg", "requiredSpec": "CHILLED" },
    { "id": "HP-ING-FRIES", "name": "Frozen potato fries", "unit": "kg", "requiredSpec": "FROZEN" },
    { "id": "HP-ING-SEAS", "name": "Seasoning", "unit": "kg" },
    { "id": "HP-ING-OIL", "name": "Frying oil", "unit": "L" }
  ],
  "inventoryLots": [
    { "id": "HP-LOT-CH-001", "ingredientId": "HP-ING-CHICKEN", "onHandMilli": 10000, "unit": "kg", "accepted": true },
    { "id": "HP-LOT-FRIES-001", "ingredientId": "HP-ING-FRIES", "onHandMilli": 30000, "unit": "kg", "accepted": true },
    { "id": "HP-LOT-SEAS-001", "ingredientId": "HP-ING-SEAS", "onHandMilli": 3000, "unit": "kg", "accepted": true },
    { "id": "HP-LOT-OIL-001", "ingredientId": "HP-ING-OIL", "onHandMilli": 10000, "unit": "L", "accepted": true }
  ],
  "purchaseOrders": [
    { "id": "HP-PO-1042", "supplierId": "HP-SUP-001", "ingredientId": "HP-ING-CHICKEN", "expectedKgMilli": 20000, "dueTimeLocal": "10:00", "state": "OPEN" }
  ],
  "menuItems": [
    { "id": "HP-MENU-CP", "name": "Chicken Popcorn", "priceSen": 990, "chickenKgMilli": 150, "potatoFriesKgMilli": 0, "recipeVersion": "DEMO-v1", "approvedInDemo": true },
    { "id": "HP-MENU-CT", "name": "Chicken Tenders", "priceSen": 1190, "chickenKgMilli": 200, "potatoFriesKgMilli": 0, "recipeVersion": "DEMO-v1", "approvedInDemo": true },
    { "id": "HP-MENU-HC", "name": "Happy Combo — Chicken Popcorn", "priceSen": 1590, "chickenKgMilli": 100, "potatoFriesKgMilli": 180, "recipeVersion": "DEMO-v1", "approvedInDemo": true },
    { "id": "HP-MENU-FR", "name": "Flavoured Fries (Regular)", "priceSen": 790, "chickenKgMilli": 0, "potatoFriesKgMilli": 200, "recipeVersion": "DEMO-v1", "approvedInDemo": true }
  ],
  "forecastDemands": [
    { "menuId": "HP-MENU-CP", "portions": 60, "windowEndLocal": "14:30" },
    { "menuId": "HP-MENU-CT", "portions": 40, "windowEndLocal": "14:30" },
    { "menuId": "HP-MENU-HC", "portions": 50, "windowEndLocal": "14:30" },
    { "menuId": "HP-MENU-FR", "portions": 90, "windowEndLocal": "14:30" }
  ],
  "confirmedOrderGroups": [
    { "id": "HP-ORD-CP-01", "menuId": "HP-MENU-CP", "portions": 10, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-CP-02", "menuId": "HP-MENU-CP", "portions": 8, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-CP-03", "menuId": "HP-MENU-CP", "portions": 7, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-CT-01", "menuId": "HP-MENU-CT", "portions": 5, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-CT-02", "menuId": "HP-MENU-CT", "portions": 5, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-CT-03", "menuId": "HP-MENU-CT", "portions": 5, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-HC-01", "menuId": "HP-MENU-HC", "portions": 8, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-HC-02", "menuId": "HP-MENU-HC", "portions": 6, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-HC-03", "menuId": "HP-MENU-HC", "portions": 6, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-FR-01", "menuId": "HP-MENU-FR", "portions": 15, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-FR-02", "menuId": "HP-MENU-FR", "portions": 10, "dueTimeLocal": "12:30" },
    { "id": "HP-ORD-FR-03", "menuId": "HP-MENU-FR", "portions": 10, "dueTimeLocal": "12:30" }
  ],
  "supplierOffers": [
    { "id": "HP-OFFER-002", "supplierId": "HP-SUP-002", "ingredientId": "HP-ING-CHICKEN", "quantityKgMilli": 15000, "pricePerKgSen": 1600, "freightSen": 1500, "landedTotalSen": 25500, "etaLocal": "10:15", "spec": "CHILLED", "qualification": "QUALIFIED_CONDITIONAL", "provenance": "SYNTHETIC_BUSINESS" },
    { "id": "HP-OFFER-003", "supplierId": "HP-SUP-003", "ingredientId": "HP-ING-CHICKEN", "quantityKgMilli": 15000, "pricePerKgSen": 1400, "freightSen": 1000, "landedTotalSen": 22000, "etaLocal": "13:30", "spec": "FROZEN", "qualification": "INCOMPATIBLE", "provenance": "SYNTHETIC_BUSINESS" }
  ],
  "resources": [
    { "id": "HP-FRY-CH-A", "name": "Chicken Fryer A", "capability": "DEMO_CHICKEN_BATCH" },
    { "id": "HP-FRY-CH-B", "name": "Chicken Fryer B", "capability": "DEMO_CHICKEN_BATCH" },
    { "id": "HP-FRY-FRIES-A", "name": "Fries Fryer A", "capability": "DEMO_FROZEN_FRIES" }
  ]
}
```

**Fixture loading rule:** initial seed values represent the **before-message** situation: the PO is `OPEN`, and no incident is yet verified. When P1 reviews the locked inbound message, the incident's reported claim becomes active and P2 performs the **after-claim** impact calculation. Do **not** pre-mark the PO `RECEIVED` or an outcome `SUCCESS`. Plan A/Plan B candidate summaries are computed/validated against this seed, not independently seeded as already approved. The 12 `confirmedOrderGroups` are **synthetic aggregate records**, not actual individual people/orders from Happy Potato.

**Seeding and test responsibility:** The integration lead or designated shared mock-data owner implements this fixture once, with pure selectors, integer arithmetic and cross-part tests. P1–P5 may use the fixture without modifying its ID/quantity semantics. If a new scenario is requested, create a new versioned fixture and add tests; do not silently change this canonical one.

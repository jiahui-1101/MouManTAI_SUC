# P1 Evidence API (producer contract for P2/P3/P5)

All selectors are pure, read-only functions over the one shared `DemoState` (`src/store/demoStore.ts`). Returned objects are deep-frozen. Data is offline `SIMULATED_CHANNEL` / `SYNTHETIC_BUSINESS` only.

Every evidence object carries `limits`: `isApprovalAuthorization`, `isReceiptProof`, `isOutcomeSuccess`, `isConfirmedProcurement`, `isCompletedSupplierAction` — all `false`. Evidence never authorizes, proves receipt, or marks success.

## Incident (P2)
| Selector | Returns |
|---|---|
| `selectActiveIncident(state)` | `HP-INC-001` with `poId`, `ingredientId`, `snapshotId`, `claimedShortfallKgMilli` (20000), `messageIds`, `status`, `handoff.status` |
| `selectMessagesForIncident(state)` | Linked `InboxMessage[]` |
| `demoStore.acknowledgeIncidentHandoff()` | P2 consumer calls after processing; sets `ACKNOWLEDGED_BY_P2` |

## Supplier offer evidence (P3) — `features/messaging/evidenceSelectors.ts`
`selectSupplierOfferEvidence(state): readonly SupplierOfferEvidence[]`
- `claim`: `{ rfqId, supplierId, ingredientId, spec, quantityKgMilli, pricePerKgSen, freightSen, statedEtaLocal, conditional: true }` — only grounded values, each with an `evidenceSpans` offset into the raw text.
- `qualification`: `UNREVIEWED | QUALIFIED_CONDITIONAL | REJECTED | UNRESOLVED` (set only by explicit `demoStore.reviewSupplierOffer`).
- `matchesCanonicalOfferId`: e.g. `HP-OFFER-002` when the claim equals the canonical business offer. P3 must keep using `state.business.supplierOffers` as the business record; message claims never overwrite it.
- `status: "OFFER_CLAIM"` — not stock received, not a PO.
- Fixture: load `SUPPLIER_OFFER` (adds `HP-MSG-OL-OFFER`).

## Audit evidence (P5)
- `selectMessageEvidence(state, messageId): MessageEvidence | null` — `raw` (ids, channel, provenance, provider ID, timestamp, `contentHash` = `fingerprint(rawText)`), `extractionVersions` (RULE_EXTRACTION v1 + HUMAN_CORRECTION/decision versions with `actor`, `createdAtIso`, `changedFields`, `humanAssertedFields`, `note`), `offerReviewVersions`, `incidentLink`, `evidenceRef`.
- `selectIncidentEvidence(state, incidentId): IncidentEvidence | null` — incident facts plus `MessageEvidence` for every linked message.

## Example consumer
```tsx
import { useDemoState } from "../../store/demoStore";
import { selectIncidentEvidence, selectSupplierOfferEvidence } from "../../features/messaging/evidenceSelectors";

function PlanAOffers() {
  const state = useDemoState();
  const offers = selectSupplierOfferEvidence(state).filter((o) => o.qualification === "QUALIFIED_CONDITIONAL");
  return <ul>{offers.map((o) => <li key={o.evidenceRef}>{o.matchesCanonicalOfferId} · evidence {o.evidenceRef}</li>)}</ul>;
}
function AuditTrail() {
  const ev = selectIncidentEvidence(useDemoState(), "HP-INC-001");
  return <ol>{ev?.messages.map((m) => <li key={m.evidenceRef}>{m.raw.messageId} {m.raw.contentHash}</li>)}</ol>;
}
```

## Remaining consumer integration dependencies
- P2 `/impact`: call `acknowledgeIncidentHandoff()` and read `selectActiveIncident`.
- P3 `/recovery/plan-a`: read `selectSupplierOfferEvidence`; keep `HP-OFFER-002` from business data.
- P5 approvals/decision memory: read `selectIncidentEvidence` / `selectMessageEvidence` as audit references only.

## Shared state (2026-11-14)
`selectOperationalSnapshot` now returns the P2-owned snapshot; also see `selectBusinessIncident`, `selectActiveImpact`, `selectPublishedEvents`, and `src/integration/{planAShared,planBShared,p5Evidence}.ts`. Details: `SHARED_STATE_INTEGRATION.md`.

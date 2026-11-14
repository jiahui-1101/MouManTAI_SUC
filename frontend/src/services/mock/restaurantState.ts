/**
 * P2 restaurant-state transitions — pure, immutable functions.
 *
 * This is NOT the global store. The integration lead's `DemoState` should hold a
 * `RestaurantState` slice and call these reducers for INCIDENT_VERIFIED,
 * SNAPSHOT_CHANGED, IMPACT_ASSESSED and DEMO_RESET. Nothing here touches React.
 */
import type { IncidentKind, LocalTime } from "../../types/common";
import type { ImpactAssessment, Incident, OperationalSnapshot } from "../../types/restaurant";
import { HP_BUSINESS, createHappyPotatoSeedSnapshot } from "../../data/fixtures/happyPotato";
import { snapshotFingerprint, type SnapshotContent } from "../../utils/snapshot";
import { assessImpact } from "../../features/impact/assessImpact";

export interface SnapshotChange {
  revision: number;
  fingerprint: string;
  reason: string;
}

export interface RestaurantState {
  snapshot: OperationalSnapshot;
  /** Previous immutable snapshots, oldest first. */
  snapshotHistory: OperationalSnapshot[];
  changeLog: SnapshotChange[];
  incidents: Incident[];
  impacts: Record<string, ImpactAssessment>;
}

/** Input from P1 once a supplier message has been extracted (and possibly verified). */
export interface SupplierIncidentReport {
  incidentId: string;
  messageId: string;
  poId: string;
  supplierId: string;
  ingredientId: string;
  incidentType: IncidentKind;
  claimedDeliveryTodayKgMilli: number;
  etaLocal: LocalTime | null;
  /** VERIFIED only when the sender is a verified demo contact and the PO matches. */
  verification: "VERIFIED" | "PENDING";
}

export function createInitialRestaurantState(): RestaurantState {
  const snapshot = createHappyPotatoSeedSnapshot();
  return {
    snapshot,
    snapshotHistory: [],
    changeLog: [{ revision: snapshot.revision, fingerprint: snapshot.fingerprint, reason: "Canonical Happy Potato seed (synthetic)" }],
    incidents: [],
    impacts: {},
  };
}

/** DEMO_RESET: restores HP-SNAP-001 revision 1 with no incidents. */
export const resetRestaurantState = createInitialRestaurantState;

/**
 * SNAPSHOT_CHANGED: produce a new immutable revision from `mutate`. If material
 * content is unchanged, the state is returned as-is (no revision bump).
 */
export function reviseSnapshot(
  state: RestaurantState,
  reason: string,
  mutate: (draft: SnapshotContent) => void,
  capturedAtIso: string = state.snapshot.capturedAtIso,
): RestaurantState {
  const { id, revision, fingerprint: _previous, capturedAtIso: _captured, ...content } = state.snapshot;
  const draft: SnapshotContent = structuredClone(content);
  mutate(draft);
  const nextFingerprint = snapshotFingerprint(draft);
  if (nextFingerprint === state.snapshot.fingerprint) return state;
  const next: OperationalSnapshot = { id, revision: revision + 1, fingerprint: nextFingerprint, capturedAtIso, ...draft };
  return {
    ...state,
    snapshot: next,
    snapshotHistory: [...state.snapshotHistory, state.snapshot],
    changeLog: [...state.changeLog, { revision: next.revision, fingerprint: next.fingerprint, reason }],
  };
}

/**
 * INCIDENT_REPORTED / INCIDENT_VERIFIED from P1.
 * - Same PO + incident type → link the message to the existing incident; no new
 *   claim, no extra subtraction (three channels ≠ 3 × 20 kg).
 * - Unverified → incident stays PENDING_VERIFICATION; the snapshot is untouched.
 * - First verification → records one supplier claim on the PO (new snapshot revision).
 *   Physical stock is never modified by a message.
 */
export function recordSupplierIncident(state: RestaurantState, report: SupplierIncidentReport): RestaurantState {
  const existing = state.incidents.find((i) => i.poId === report.poId && i.type === report.incidentType);
  let incidents = state.incidents;

  if (existing) {
    const messageIds = existing.messageIds.includes(report.messageId) ? existing.messageIds : [...existing.messageIds, report.messageId];
    const becomesVerified = report.verification === "VERIFIED" && existing.status === "PENDING_VERIFICATION";
    if (messageIds === existing.messageIds && !becomesVerified) return state;
    incidents = state.incidents.map((i) =>
      i.id === existing.id ? { ...i, messageIds, status: becomesVerified ? "VERIFIED" : i.status } : i,
    );
    if (!becomesVerified) return { ...state, incidents };
  } else {
    const po = state.snapshot.purchaseOrders.find((p) => p.id === report.poId);
    const expected = po?.expectedKgMilli ?? null;
    const incident: Incident = {
      id: report.incidentId,
      poId: report.poId,
      ingredientId: report.ingredientId,
      supplierId: report.supplierId,
      type: report.incidentType,
      messageIds: [report.messageId],
      claimedShortfallKgMilli: expected === null ? 0 : Math.max(expected - report.claimedDeliveryTodayKgMilli, 0),
      status: report.verification === "VERIFIED" ? "VERIFIED" : "PENDING_VERIFICATION",
      revision: 1,
      snapshotFingerprint: state.snapshot.fingerprint,
    };
    incidents = [...state.incidents, incident];
    if (report.verification !== "VERIFIED") return { ...state, incidents };
  }

  const withIncidents = { ...state, incidents };
  const alreadyClaimed = state.snapshot.supplierClaims.some((c) => c.poId === report.poId);
  if (alreadyClaimed) return withIncidents;

  const revised = reviseSnapshot(withIncidents, `Supplier claim verified for ${report.poId} (${report.incidentType})`, (draft) => {
    draft.supplierClaims.push({
      poId: report.poId,
      supplierId: report.supplierId,
      ingredientId: report.ingredientId,
      claimedDeliveryTodayKgMilli: report.claimedDeliveryTodayKgMilli,
      etaLocal: report.etaLocal,
      incidentId: existing?.id ?? report.incidentId,
    });
    const po = draft.purchaseOrders.find((p) => p.id === report.poId);
    if (po && po.state === "OPEN" && report.incidentType === "UNAVAILABLE") po.state = "SUPPLIER_CLAIMED_UNAVAILABLE_TODAY";
  });
  const incidentId = existing?.id ?? report.incidentId;
  return {
    ...revised,
    incidents: revised.incidents.map((i) => (i.id === incidentId ? { ...i, snapshotFingerprint: revised.snapshot.fingerprint } : i)),
  };
}

/**
 * IMPACT_ASSESSED: compute against the current snapshot. The incident advances to
 * IMPACT_ASSESSED only when the result is authoritative (ASSESSED or BREACH_RISK).
 */
export function assessIncidentImpact(
  state: RestaurantState,
  incidentId: string,
  expectedFingerprint: string = state.snapshot.fingerprint,
  neededByLocal: LocalTime = HP_BUSINESS.prepCutoffLocal,
): RestaurantState {
  const incident = state.incidents.find((i) => i.id === incidentId);
  if (!incident) throw new Error(`Unknown incident ${incidentId}`);
  const impact = assessImpact(state.snapshot, incident, { expectedFingerprint, neededByLocal });
  const authoritative = impact.status === "ASSESSED" || impact.status === "BREACH_RISK";
  return {
    ...state,
    impacts: { ...state.impacts, [incidentId]: impact },
    incidents: state.incidents.map((i) =>
      i.id === incidentId && authoritative && i.status === "VERIFIED"
        ? { ...i, status: "IMPACT_ASSESSED", snapshotFingerprint: state.snapshot.fingerprint }
        : i,
    ),
  };
}

/* selectors ---------------------------------------------------------------- */

export const selectOperationalSnapshot = (state: RestaurantState) => state.snapshot;
export const selectIncident = (state: RestaurantState, incidentId: string) => state.incidents.find((i) => i.id === incidentId);

/** Returns the impact only if it was computed on the current snapshot; otherwise null (stale). */
export function selectCurrentImpact(state: RestaurantState, incidentId: string): ImpactAssessment | null {
  const impact = state.impacts[incidentId];
  if (!impact) return null;
  return impact.snapshotFingerprint === state.snapshot.fingerprint ? impact : null;
}

export function isImpactStale(state: RestaurantState, incidentId: string): boolean {
  const impact = state.impacts[incidentId];
  return impact !== undefined && impact.snapshotFingerprint !== state.snapshot.fingerprint;
}

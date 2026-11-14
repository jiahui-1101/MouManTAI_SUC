import { Link } from "react-router-dom";
import { selectActiveImpact, selectActiveIncident, selectBusinessIncident, selectMessagesForIncident, useDemoState } from "../../store/demoStore";
import { isImpactStale } from "../../services/mock/restaurantState";

const kg = (n: number) => `${(n / 1000).toFixed(3)} kg`;
const HANDOFF_TEXT = {
  NOT_PUBLISHED: "Not published — incident is pending verification.",
  AWAITING_P2_CONSUMER: "INCIDENT_VERIFIED published · awaiting P2 Impact consumer. Impact has not been calculated yet.",
  ACKNOWLEDGED_BY_P2: "Acknowledged by P2 Impact consumer.",
} as const;

/** Read-only view of the shared incident and its P1 → P2 handoff. P1 computes no inventory or impact totals. */
export function IncidentHandoff() {
  const state = useDemoState();
  const incident = selectActiveIncident(state);
  const linked = selectMessagesForIncident(state);
  const snapshot = state.restaurant.snapshot;
  const lot = snapshot.ingredientLots.find((l) => l.ingredientId === incident.ingredientId && l.accepted);
  const business = selectBusinessIncident(state);
  const impact = selectActiveImpact(state);
  const stale = isImpactStale(state.restaurant, incident.id);
  return <section className="mi-handoff" aria-label="Incident handoff">
    <h3>{incident.id} · {incident.status === "VERIFIED" ? "Verified" : "Pending verification"}</h3>
    <dl>
      <div><dt>PO / ingredient</dt><dd>{incident.poId} · {incident.ingredientId}</dd></div>
      <div><dt>Snapshot</dt><dd data-testid="incident-snapshot">{snapshot.id} rev {snapshot.revision} (verified on rev {incident.snapshotRevision})</dd></div>
      <div><dt>P2 incident</dt><dd data-testid="p2-incident-status">{business ? `${business.status} · ${business.messageIds.length} message${business.messageIds.length === 1 ? "" : "s"}` : "Not received by P2"}</dd></div>
      <div><dt>P2 impact</dt><dd data-testid="p2-impact-status">{impact ? `${impact.status} on rev ${impact.snapshotRevision}` : stale ? "STALE — reassess in Impact Explorer" : "Not assessed yet"}</dd></div>
      <div><dt>Supplier claim shortfall</dt><dd data-testid="incident-shortfall">{kg(incident.claimedShortfallKgMilli)} (one claim, not multiplied)</dd></div>
      <div><dt>Accepted physical stock</dt><dd>{lot ? kg(lot.onHandMilli) : "—"} (physical stock, never changed by a supplier claim)</dd></div>
      <div><dt>Evidence messages</dt><dd data-testid="incident-messages">{linked.length ? linked.map((m) => `${m.id} (${m.channel})`).join(", ") : "None yet"}</dd></div>
      <div><dt>P2 handoff</dt><dd data-testid="handoff-status">{HANDOFF_TEXT[incident.handoff.status]}</dd></div>
    </dl>
    {incident.status === "VERIFIED" && <Link className="fm-btn fm-btn--primary" to={incident.handoff.target}>Open Impact Explorer</Link>}
  </section>;
}

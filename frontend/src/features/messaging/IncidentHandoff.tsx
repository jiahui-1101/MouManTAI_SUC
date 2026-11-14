import { Link } from "react-router-dom";
import { selectActiveIncident, selectMessagesForIncident, useDemoState } from "../../store/demoStore";

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
  const lot = state.business.inventoryLots.find((l) => l.ingredientId === incident.ingredientId);
  return <section className="mi-handoff" aria-label="Incident handoff">
    <h3>{incident.id} · {incident.status === "VERIFIED" ? "Verified" : "Pending verification"}</h3>
    <dl>
      <div><dt>PO / ingredient</dt><dd>{incident.poId} · {incident.ingredientId}</dd></div>
      <div><dt>Snapshot</dt><dd>{incident.snapshotId} rev {incident.snapshotRevision}</dd></div>
      <div><dt>Supplier claim shortfall</dt><dd data-testid="incident-shortfall">{kg(incident.claimedShortfallKgMilli)} (one claim, not multiplied)</dd></div>
      <div><dt>Accepted physical stock</dt><dd>{lot ? kg(lot.onHandMilli) : "—"} (shared snapshot, unchanged by P1)</dd></div>
      <div><dt>Evidence messages</dt><dd data-testid="incident-messages">{linked.length ? linked.map((m) => `${m.id} (${m.channel})`).join(", ") : "None yet"}</dd></div>
      <div><dt>P2 handoff</dt><dd data-testid="handoff-status">{HANDOFF_TEXT[incident.handoff.status]}</dd></div>
    </dl>
    {incident.status === "VERIFIED" && <Link className="fm-btn fm-btn--primary" to={incident.handoff.target}>Open Impact Explorer</Link>}
  </section>;
}

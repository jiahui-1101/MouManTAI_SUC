import type { ActivityEvent, ActivityType } from "../../../services/mock/restaurantStore";
import { STATUS_LABEL } from "../model";
import { Badge, EmptyState } from "./ui";

const TYPE_LABEL: Record<ActivityType, string> = {
  MESSAGE_RECEIVED: "Message received",
  MESSAGE_LINKED: "Message linked",
  INCIDENT_REPORTED: "Incident reported",
  INCIDENT_VERIFIED: "Incident verified",
  SNAPSHOT_CHANGED: "Snapshot changed",
  IMPACT_ASSESSED: "Impact assessed",
  DEMO_RESET: "Demo reset",
};

const PROVENANCE_LABEL: Record<string, string> = {
  SIMULATED_CHANNEL: "Simulated channel",
  SYNTHETIC_BUSINESS: "Synthetic data",
  SIMULATED_CALCULATION: "Demo calculation",
  LIVE_CHANNEL: "Live channel",
};

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function ActivityList({ events, emptyText = "No activity yet." }: { events: ActivityEvent[]; emptyText?: string }) {
  if (events.length === 0) return <EmptyState title={emptyText} />;
  return (
    <ol className="p2-activity">
      {[...events].reverse().map((e) => (
        <li key={e.id} className="p2-activity__item">
          <div className="p2-activity__head">
            <span className="p2-activity__type">{TYPE_LABEL[e.type]}</span>
            <Badge tone={e.provenance === "LIVE_CHANNEL" ? "live" : e.provenance === "SIMULATED_CHANNEL" ? "sim" : "neutral"}>
              {PROVENANCE_LABEL[e.provenance] ?? e.provenance}
            </Badge>
            <time className="p2-activity__time" dateTime={e.recordedAtIso} title="Browser time when recorded">
              {time(e.recordedAtIso)}
            </time>
          </div>
          <p className="p2-activity__detail">
            {e.incidentId && <span className="p2-mono">{e.incidentId}</span>} {e.detail}
            {e.toStatus && (
              <span className="p2-activity__transition">
                {" "}
                {e.fromStatus ? `${STATUS_LABEL[e.fromStatus]} → ` : "→ "}
                {STATUS_LABEL[e.toStatus]}
              </span>
            )}
          </p>
        </li>
      ))}
    </ol>
  );
}

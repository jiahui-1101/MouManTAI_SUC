import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import type { Channel } from "../../types/common";
import type { Incident, IncidentStatus } from "../../types/restaurant";
import { useRestaurantStore, type P2StoreState } from "../../services/mock/restaurantStore";
import { selectCurrentImpact } from "../../services/mock/restaurantState";
import {
  INCIDENT_TYPE_LABEL,
  LIFECYCLE,
  STATUS_LABEL,
  impactStateOf,
  ingredientName,
  severityOf,
  supplierName,
  type ImpactState,
  type Severity,
} from "../../features/incidents/model";
import { DemoControls } from "../../features/incidents/components/DemoControls";
import { IncidentDetail } from "../../features/incidents/components/IncidentDetail";
import { P2ErrorBoundary } from "../../features/incidents/components/P2ErrorBoundary";
import { Badge, EmptyState, Qty, SeverityBadge, StatusBadge, SyntheticTag } from "../../features/incidents/components/ui";
import "../../features/incidents/p2.css";

const CHANNEL_LABEL: Record<Channel, string> = { WHATSAPP: "WhatsApp", OUTLOOK: "Outlook", TELEGRAM: "Telegram" };
const IMPACT_LABEL: Record<ImpactState, string> = {
  NOT_VERIFIED: "Withheld (unverified)",
  NOT_ASSESSED: "Not assessed",
  CURRENT: "Assessed",
  STALE: "Stale",
  UNKNOWN: "Unknown",
};

interface Row {
  incident: Incident;
  severity: Severity;
  impactState: ImpactState;
  channels: Channel[];
  reportedAtIso: string | null;
}

function buildRows(store: P2StoreState): Row[] {
  return store.restaurant.incidents.map((incident) => {
    const messages = store.messages.filter((m) => m.incidentId === incident.id);
    return {
      incident,
      severity: severityOf(selectCurrentImpact(store.restaurant, incident.id)),
      impactState: impactStateOf(store.restaurant, incident),
      channels: [...new Set(messages.map((m) => m.channel))],
      reportedAtIso: messages[0]?.receivedAtIso ?? null,
    };
  });
}

const EMPTY_FILTERS = { status: "", severity: "", ingredient: "", supplier: "", channel: "", query: "" };
type Filters = typeof EMPTY_FILTERS;

export function IncidentsPage() {
  return (
    <PageContainer title={titleFor("/incidents")}>
      <P2ErrorBoundary label="Incident list">
        <IncidentsContent />
      </P2ErrorBoundary>
    </PageContainer>
  );
}

function IncidentsContent() {
  const store = useRestaurantStore();
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const rows = useMemo(() => buildRows(store), [store]);
  const selectedId = params.get("incident");
  const selected = store.restaurant.incidents.find((i) => i.id === selectedId);

  const visible = rows.filter(({ incident, severity, channels }) => {
    const q = filters.query.trim().toLowerCase();
    return (
      (!filters.status || incident.status === filters.status) &&
      (!filters.severity || severity === filters.severity) &&
      (!filters.ingredient || incident.ingredientId === filters.ingredient) &&
      (!filters.supplier || incident.supplierId === filters.supplier) &&
      (!filters.channel || channels.includes(filters.channel as Channel)) &&
      (!q || incident.id.toLowerCase().includes(q) || incident.poId.toLowerCase().includes(q))
    );
  });

  const filtersActive = Object.values(filters).some(Boolean);
  const set = (key: keyof Filters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const open = (id: string) => setParams({ incident: id });
  const close = useCallback(() => setParams({}), [setParams]);

  const unique = <T,>(values: T[]) => [...new Set(values)];

  return (
    <div className="p2">
      <div className="p2-meta">
        <div className="p2-meta__item"><span className="p2-meta__label">Snapshot</span><span className="p2-mono">{store.restaurant.snapshot.id} · r{store.restaurant.snapshot.revision}</span></div>
        <div className="p2-meta__item"><span className="p2-meta__label">Data</span><SyntheticTag /></div>
        <div className="p2-meta__item"><span className="p2-meta__label">Incidents</span><span>{rows.length}</span></div>
        <DemoControls />
      </div>

      <div className={`p2-workspace ${selected ? "p2-workspace--with-detail" : ""}`}>
        <section className="p2-card p2-list" aria-label="Incident list">
          <div className="p2-filters" role="search">
            <label className="p2-field p2-field--search">
              <span className="p2-sr">Search by incident or PO ID</span>
              <Search size={16} aria-hidden="true" />
              <input type="search" placeholder="Search incident or PO ID" value={filters.query} onChange={set("query")} />
            </label>
            <Select label="Status" value={filters.status} onChange={set("status")} options={LIFECYCLE.map((s) => [s, STATUS_LABEL[s as IncidentStatus]])} />
            <Select label="Severity" value={filters.severity} onChange={set("severity")} options={(["CRITICAL", "HIGH", "MEDIUM", "UNASSESSED"] as Severity[]).map((s) => [s, s.charAt(0) + s.slice(1).toLowerCase()])} />
            <Select label="Ingredient" value={filters.ingredient} onChange={set("ingredient")} options={unique(rows.map((r) => r.incident.ingredientId)).map((id) => [id, ingredientName(id)])} />
            <Select label="Supplier" value={filters.supplier} onChange={set("supplier")} options={unique(rows.map((r) => r.incident.supplierId)).map((id) => [id, supplierName(id)])} />
            <Select label="Channel" value={filters.channel} onChange={set("channel")} options={(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => [c, CHANNEL_LABEL[c]])} />
            {filtersActive && (
              <button type="button" className="p2-btn p2-btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
                Clear filters
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <EmptyState title="No supply incidents">
              <p>Incidents are created when a supplier message about a purchase order is received and reviewed. Use demo test mode to simulate one.</p>
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState title="No incidents match these filters">
              <button type="button" className="p2-btn p2-btn--ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
            </EmptyState>
          ) : (
            <div className="p2-table-wrap" role="region" aria-label="Supply incidents" tabIndex={0}>
              <table className="p2-table">
                <caption className="p2-sr">Supply incidents</caption>
                <thead>
                  <tr>
                    <th scope="col">Incident</th>
                    <th scope="col">Supplier · PO</th>
                    <th scope="col" className="p2-col-opt">Ingredient</th>
                    <th scope="col" className="p2-col-opt">Type</th>
                    <th scope="col" className="p2-col-opt">Sources</th>
                    <th scope="col" className="p2-col-opt">Reported</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Verification</th>
                    <th scope="col" className="p2-col-opt">Impact</th>
                    <th scope="col" className="p2-col-opt">Snapshot</th>
                    <th scope="col"><span className="p2-sr">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const { incident } = row;
                    const isSelected = incident.id === selectedId;
                    const messageCount = store.messages.filter((m) => m.incidentId === incident.id).length;
                    return (
                      <tr key={incident.id} className={isSelected ? "p2-row--selected" : undefined} onClick={() => open(incident.id)}>
                        <th scope="row" className="p2-mono">{incident.id}</th>
                        <td>
                          {supplierName(incident.supplierId)}
                          <div className="p2-mono p2-muted">{incident.poId}</div>
                        </td>
                        <td className="p2-col-opt">{ingredientName(incident.ingredientId)}</td>
                        <td className="p2-col-opt">
                          {INCIDENT_TYPE_LABEL[incident.type]}
                          <div className="p2-muted">PO shortfall <Qty milli={incident.claimedShortfallKgMilli} /></div>
                        </td>
                        <td className="p2-col-opt">
                          <div className="p2-badges">{row.channels.map((c) => <Badge key={c} tone="info">{CHANNEL_LABEL[c]}</Badge>)}</div>
                          <div className="p2-muted">{messageCount} message{messageCount === 1 ? "" : "s"} · simulated</div>
                        </td>
                        <td className="p2-nowrap p2-col-opt">{row.reportedAtIso ? new Date(row.reportedAtIso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        <td><SeverityBadge severity={row.severity} /></td>
                        <td><StatusBadge status={incident.status} /></td>
                        <td className="p2-col-opt"><Badge tone={row.impactState === "CURRENT" ? "ok" : row.impactState === "STALE" || row.impactState === "UNKNOWN" ? "bad" : "neutral"}>{IMPACT_LABEL[row.impactState]}</Badge></td>
                        <td className="p2-mono p2-nowrap p2-col-opt">r{store.restaurant.snapshot.revision}</td>
                        <td>
                          <button
                            type="button"
                            className="p2-btn p2-btn--ghost p2-btn--sm"
                            aria-expanded={isSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              open(incident.id);
                            }}
                          >
                            View details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && <IncidentDetail incident={selected} onClose={close} />}
        {selectedId && !selected && (
          <section className="p2-card">
            <EmptyState title={`Incident ${selectedId} is not in the current state`}>
              <button type="button" className="p2-btn p2-btn--ghost" onClick={close}>Close</button>
            </EmptyState>
          </section>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (e: { target: { value: string } }) => void; options: Array<[string, string]> }) {
  return (
    <label className="p2-field">
      <span className="p2-field__label">{label}</span>
      <select value={value} onChange={onChange}>
        <option value="">All</option>
        {options.map(([v, text]) => (
          <option key={v} value={v}>{text}</option>
        ))}
      </select>
    </label>
  );
}

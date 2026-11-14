import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Boxes,
  ClipboardList,
  Drumstick,
  FileText,
  Flame,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  ShoppingBag,
  Truck,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { OperationalSnapshot } from "../../../types/restaurant";
import { findApprovedRecipe, openConfirmedOrders } from "../calculations";
import { COLUMNS, connectedNodeIds, type GraphNode, type ImpactGraph, type NodeKind, type NodeStatus } from "../graph";
import { Badge, Qty } from "../../incidents/components/ui";

export type GraphFilter = "ALL" | "AFFECTED" | "UNAFFECTED";

const STATUS_TEXT: Record<NodeStatus, string> = {
  DISRUPTED: "Disrupted (supplier claim)",
  AFFECTED: "Affected",
  UNAFFECTED: "Unaffected",
  UNKNOWN: "Unknown — BOM missing",
};
const STATUS_TONE = { DISRUPTED: "bad", AFFECTED: "warn", UNAFFECTED: "ok", UNKNOWN: "neutral" } as const;

const ICONS: Record<NodeKind, ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  supplier: Truck,
  po: FileText,
  lot: Boxes,
  ingredient: Drumstick,
  recipe: ClipboardList,
  menu: UtensilsCrossed,
  demand: ShoppingBag,
  station: Flame,
};

/* layout -------------------------------------------------------------------- */

const COL_GAP = 150;
const ROW_GAP = 104;
const PAD_X = 70;
const PAD_Y = 70;
const R = 26;

interface Placed extends GraphNode {
  x: number;
  y: number;
}

function layout(graph: ImpactGraph) {
  const columns = COLUMNS.map((c) => graph.nodes.filter((n) => n.kind === c.kind));
  const maxRows = Math.max(...columns.map((c) => c.length), 1);
  const height = PAD_Y * 2 + (maxRows - 1) * ROW_GAP + 30;
  const width = PAD_X * 2 + (COLUMNS.length - 1) * COL_GAP;
  const placed: Placed[] = [];
  columns.forEach((nodes, ci) => {
    const offset = ((maxRows - nodes.length) * ROW_GAP) / 2;
    nodes.forEach((n, ri) => placed.push({ ...n, x: PAD_X + ci * COL_GAP, y: PAD_Y + offset + ri * ROW_GAP }));
  });
  return { placed, width, height };
}

function edgePath(a: Placed, b: Placed) {
  const x1 = a.x + R;
  const x2 = b.x - R - 6;
  // Orthogonal "elbow" route with rounded corners: edges from one node share the
  // same trunk, so fan-outs read as one tidy bus instead of crossing curves.
  const mx = x1 + Math.min(24, (x2 - x1) / 2);
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1) return `M ${x1} ${a.y} H ${x2}`;
  const r = Math.min(10, Math.abs(dy) / 2, (x2 - x1) / 4);
  const s = Math.sign(dy);
  return `M ${x1} ${a.y} H ${mx - r} Q ${mx} ${a.y} ${mx} ${a.y + s * r} V ${b.y - s * r} Q ${mx} ${b.y} ${mx + r} ${b.y} H ${x2}`;
}

/* component ----------------------------------------------------------------- */

interface Props {
  graph: ImpactGraph;
  snapshot: OperationalSnapshot;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  filter: GraphFilter;
  onFilter: (f: GraphFilter) => void;
}

export function DependencyGraph({ graph, snapshot, selectedId, onSelect, filter, onFilter, query = "" }: Props & { query?: string }) {
  const [showTable, setShowTable] = useState(false);
  const [zoom, setZoom] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { placed, width, height } = useMemo(() => layout(graph), [graph]);
  const byId = useMemo(() => new Map(placed.map((n) => [n.id, n])), [placed]);
  const related = useMemo(() => (selectedId ? connectedNodeIds(graph, selectedId) : null), [graph, selectedId]);
  const selected = selectedId ? byId.get(selectedId) ?? null : null;
  const q = query.trim().toLowerCase();
  const matchesQuery = (n: GraphNode) => !q || `${n.label} ${n.sublabel}`.toLowerCase().includes(q);

  const fit = () => {
    const w = viewportRef.current?.clientWidth ?? 0;
    setZoom(w > 0 ? Math.min(1.2, Math.max(0.45, (w - 24) / width)) : 1);
  };
  useLayoutEffect(fit, [width]);
  useEffect(() => {
    const el = viewportRef.current;
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    const ro = el && typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    if (el) ro?.observe(el);
    return () => {
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  const matchesFilter = (n: GraphNode) =>
    filter === "ALL" || (filter === "AFFECTED" ? n.status === "AFFECTED" || n.status === "DISRUPTED" : n.status === "UNAFFECTED");
  const isDim = (n: GraphNode) => !matchesFilter(n) || !matchesQuery(n) || (related !== null && !related.has(n.id));
  const edgeActive = (from: string, to: string) => related !== null && related.has(from) && related.has(to);

  return (
    <div className="p2-graph">
      <div className="p2-graph__toolbar">
        <div className="p2-seg" role="group" aria-label="Filter dependency graph">
          {(["ALL", "AFFECTED", "UNAFFECTED"] as GraphFilter[]).map((f) => (
            <button key={f} type="button" className="p2-seg__btn" aria-pressed={filter === f} onClick={() => onFilter(f)}>
              {f === "ALL" ? "All" : f === "AFFECTED" ? "Affected" : "Unaffected"}
            </button>
          ))}
        </div>
        <button type="button" className="p2-btn p2-btn--ghost p2-btn--sm" onClick={() => onSelect(null)} disabled={!selectedId}>
          <RotateCcw size={14} aria-hidden="true" /> Reset selection
        </button>
        <button type="button" className="p2-btn p2-btn--ghost p2-btn--sm" aria-expanded={showTable} onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Hide relationship table" : "Show as table"}
        </button>
      </div>

      <div className="p2-map">
        <div className="p2-map__viewport" ref={viewportRef} aria-label="Supply-to-menu dependency map. Flows left to right.">
          <div className="p2-map__stage" style={{ width: width * zoom, height: height * zoom }}>
            <div className="p2-map__inner" style={{ width, height, transform: `scale(${zoom})` }}>
              <div className="p2-map__cols" aria-hidden="true">
                {COLUMNS.map((c, i) => (
                  <span key={c.kind} style={{ left: PAD_X + i * COL_GAP }}>{c.title}</span>
                ))}
              </div>
              <svg className="p2-map__edges" width={width} height={height} aria-hidden="true">
                <defs>
                  <marker id="p2-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" className="p2-map__arrow" />
                  </marker>
                  <marker id="p2-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" className="p2-map__arrow p2-map__arrow--active" />
                  </marker>
                </defs>
                {COLUMNS.slice(0, -1).map((c, i) => {
                  const x = PAD_X + (i + 0.5) * COL_GAP;
                  return <line key={`div-${c.kind}`} x1={x} x2={x} y1={4} y2={height - 4} className="p2-map__divider" />;
                })}
                {graph.edges.map((e) => {
                  const a = byId.get(e.from);
                  const b = byId.get(e.to);
                  if (!a || !b) return null;
                  const active = edgeActive(e.from, e.to);
                  const faded = related !== null && !active;
                  return (
                    <path
                      key={`${e.from}>${e.to}`}
                      d={edgePath(a, b)}
                      className={`p2-map__edge p2-map__edge--${b.status.toLowerCase()}${active ? " p2-map__edge--active" : ""}${faded ? " p2-map__edge--faded" : ""}`}
                      markerEnd={`url(#${active ? "p2-arrow-active" : "p2-arrow"})`}
                    />
                  );
                })}
              </svg>
              {placed.map((n) => {
                const Icon = ICONS[n.kind];
                const col = COLUMNS.find((c) => c.kind === n.kind)!;
                return (
                  <button
                    key={n.id}
                    type="button"
                    style={{ left: n.x, top: n.y }}
                    className={`p2-node p2-node--${n.status.toLowerCase()}${n.id === selectedId ? " p2-node--selected" : ""}${isDim(n) ? " p2-node--dim" : ""}`}
                    aria-pressed={n.id === selectedId}
                    aria-label={`${col.title}: ${n.label}. ${STATUS_TEXT[n.status]}`}
                    onClick={() => onSelect(n.id === selectedId ? null : n.id)}
                  >
                    <span className="p2-node__circle">
                      <Icon size={20} aria-hidden={true} />
                      <span className="p2-node__dot" />
                    </span>
                    <span className="p2-node__label">{n.label}</span>
                    <span className="p2-node__sub">{n.sublabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p2-map__legend" aria-label="Status legend">
          <p className="p2-map__legend-title">Impact status</p>
          <span><i className="p2-dot p2-dot--disrupted" /> Disrupted</span>
          <span><i className="p2-dot p2-dot--affected" /> Affected</span>
          <span><i className="p2-dot p2-dot--unaffected" /> Unaffected</span>
          <span><i className="p2-dot p2-dot--unknown" /> Unknown</span>
        </div>

        <div className="p2-map__zoom" role="group" aria-label="Zoom">
          <button type="button" className="p2-icon-btn" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))} aria-label="Zoom in"><Plus size={16} aria-hidden="true" /></button>
          <button type="button" className="p2-icon-btn" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.15).toFixed(2)))} aria-label="Zoom out"><Minus size={16} aria-hidden="true" /></button>
          <button type="button" className="p2-icon-btn" onClick={fit} aria-label="Fit to view"><Maximize2 size={15} aria-hidden="true" /></button>
        </div>

        {selected ? (
          <NodeDetail node={selected} graph={graph} snapshot={snapshot} onSelect={onSelect} onClose={() => onSelect(null)} />
        ) : (
          <p className="p2-map__hint">No node selected — click a node to see its details and dependency chain.</p>
        )}
      </div>

      {showTable && (
        <div className="p2-table-wrap" role="region" aria-label="Dependency relationships" tabIndex={0}>
          <table className="p2-table p2-table--compact">
            <caption className="p2-graph__caption">Dependency relationships (accessible alternative to the graph)</caption>
            <thead>
              <tr><th scope="col">From</th><th scope="col">Relationship</th><th scope="col">To</th><th scope="col">To status</th></tr>
            </thead>
            <tbody>
              {graph.edges.map((e) => {
                const from = byId.get(e.from)!;
                const to = byId.get(e.to)!;
                return (
                  <tr key={`${e.from}>${e.to}`}>
                    <td>{from.label}</td>
                    <td>{e.relation}</td>
                    <td>{to.label}</td>
                    <td><Badge tone={STATUS_TONE[to.status]}>{STATUS_TEXT[to.status]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* detail panel -------------------------------------------------------------- */

function NodeDetail({ node, graph, snapshot, onSelect, onClose }: { node: GraphNode; graph: ImpactGraph; snapshot: OperationalSnapshot; onSelect: (id: string) => void; onClose: () => void }) {
  const upstream = graph.edges.filter((e) => e.to === node.id);
  const downstream = graph.edges.filter((e) => e.from === node.id);
  const find = (id: string) => graph.nodes.find((n) => n.id === id);
  const Icon = ICONS[node.kind];

  return (
    <section className="p2-node-detail" aria-live="polite" aria-label={`Details for ${node.label}`}>
      <header className="p2-node-detail__head">
        <span className={`p2-node-detail__icon p2-node-detail__icon--${node.status.toLowerCase()}`}><Icon size={20} aria-hidden={true} /></span>
        <div className="p2-node-detail__name">
          <h3 className="p2-node-detail__title">{node.label}</h3>
          <p className="p2-eyebrow">{COLUMNS.find((c) => c.kind === node.kind)?.title}</p>
        </div>
        <button type="button" className="p2-icon-btn" onClick={onClose} aria-label="Close node details"><X size={16} aria-hidden="true" /></button>
      </header>
      <Badge tone={STATUS_TONE[node.status]}>{STATUS_TEXT[node.status]}</Badge>
      <NodeFacts node={node} snapshot={snapshot} />
      <div className="p2-node-detail__links">
        <div>
          <p className="p2-section__title">Depends on ({upstream.length})</p>
          {upstream.length ? (
            <ul>
              {upstream.map((e) => {
                const n = find(e.from)!;
                return (
                  <li key={e.from}>
                    <i className={`p2-dot p2-dot--${n.status.toLowerCase()}`} />
                    <button type="button" className="p2-linkbtn" onClick={() => onSelect(e.from)}>{n.label}</button>
                    <span className="p2-muted">{e.relation}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="p2-muted">Nothing upstream</p>}
        </div>
        <div>
          <p className="p2-section__title">Feeds ({downstream.length})</p>
          {downstream.length ? (
            <ul>
              {downstream.map((e) => {
                const n = find(e.to)!;
                return (
                  <li key={e.to}>
                    <i className={`p2-dot p2-dot--${n.status.toLowerCase()}`} />
                    <button type="button" className="p2-linkbtn" onClick={() => onSelect(e.to)}>{n.label}</button>
                    <span className="p2-muted">{e.relation}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="p2-muted">Nothing downstream</p>}
        </div>
      </div>
      <p className="p2-fineprint">Source: {node.source}</p>
    </section>
  );
}

function Tiles({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="p2-tiles">
      {items.map(([label, value]) => (
        <div key={label} className="p2-tile">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function NodeFacts({ node, snapshot }: { node: GraphNode; snapshot: OperationalSnapshot }) {
  switch (node.kind) {
    case "supplier": {
      const pos = snapshot.purchaseOrders.filter((p) => p.supplierId === node.refId);
      return <Tiles items={[["Open POs", pos.length], ["Registry", "Synthetic demo"]]} />;
    }
    case "po": {
      const po = snapshot.purchaseOrders.find((p) => p.id === node.refId)!;
      const claim = snapshot.supplierClaims.find((c) => c.poId === po.id);
      return (
        <Tiles
          items={[
            ["Expected", po.expectedKgMilli === null ? "Unknown" : <Qty milli={po.expectedKgMilli} />],
            ["Due", `${po.dueTimeLocal} demo clock`],
            ["State", <span className="p2-mono p2-wrap">{po.state}</span>],
            ["Supplier claim", claim ? <><Qty milli={claim.claimedDeliveryTodayKgMilli} /> today · ETA {claim.etaLocal ?? "unknown"}</> : "None verified"],
          ]}
        />
      );
    }
    case "lot": {
      const lot = snapshot.ingredientLots.find((l) => l.id === node.refId)!;
      return (
        <Tiles
          items={[
            ["Physical on hand", <Qty milli={lot.onHandMilli} unit={lot.unit} />],
            ["Quality", `${lot.accepted ? "Accepted" : "Not accepted"}${lot.quarantined ? " · quarantined" : ""}`],
            ["Available from", lot.availableAtLocal],
            ["Expiry", lot.expiresAtLocal ?? "Not recorded"],
          ]}
        />
      );
    }
    case "ingredient": {
      const lots = snapshot.ingredientLots.filter((l) => l.ingredientId === node.refId);
      const onHand = lots.reduce((s, l) => s + l.onHandMilli, 0);
      const usedBy = snapshot.recipes.filter((r) => r.components.some((c) => c.ingredientId === node.refId)).length;
      return <Tiles items={[["Physical on hand", <Qty milli={onHand} unit={lots[0]?.unit ?? "kg"} />], ["Used in recipes", usedBy]]} />;
    }
    case "recipe":
    case "menu": {
      const menu = snapshot.menuItems.find((m) => m.id === node.refId)!;
      const lookup = findApprovedRecipe(snapshot, menu);
      if (!lookup.ok) return <p className="p2-muted">{lookup.issue.message}</p>;
      return (
        <>
          <Tiles items={[["Recipe version", `${lookup.recipe.version} · ${lookup.recipe.approvedInDemo ? "approved (demo)" : "not approved"}`], ["Price (synthetic)", `RM${(menu.priceSen / 100).toFixed(2)}`]]} />
          <dl className="p2-facts">
            {lookup.recipe.components.map((c) => (
              <div key={c.ingredientId}><dt>{c.ingredientId}</dt><dd><Qty milli={c.quantityMilli} unit={c.unit} /> per portion</dd></div>
            ))}
          </dl>
        </>
      );
    }
    case "demand": {
      const orders = openConfirmedOrders(snapshot).filter((o) => o.menuId === node.refId);
      const forecast = snapshot.forecasts.find((f) => f.menuId === node.refId);
      return (
        <>
          <Tiles
            items={[
              [`Forecast (to ${forecast?.windowEndLocal ?? "—"})`, <span className="p2-num">{forecast?.portions ?? 0}</span>],
              ["Confirmed (in forecast)", <span className="p2-num">{orders.reduce((s, o) => s + o.portions, 0)}</span>],
            ]}
          />
          <ul className="p2-chips">
            {orders.map((o) => <li key={o.id}><span className="p2-mono">{o.id}</span> · {o.portions} due {o.dueTimeLocal}</li>)}
          </ul>
        </>
      );
    }
    case "station":
      return <p className="p2-muted">Synthetic station from the demo kitchen model. Batch scheduling is owned by P4 (Prep Planning).</p>;
  }
}

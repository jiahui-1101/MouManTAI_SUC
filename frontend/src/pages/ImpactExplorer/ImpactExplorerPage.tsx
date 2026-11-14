import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { HP_IDS, HP_INGREDIENTS } from "../../data/fixtures/happyPotato";
import { assessImpactAction, useRestaurantStore } from "../../services/mock/restaurantStore";
import { selectCurrentImpact } from "../../services/mock/restaurantState";
import { buildImpactGraph } from "../../features/impact/graph";
import { DependencyGraph, type GraphFilter } from "../../features/impact/components/DependencyGraph";
import {
  BeforeAfter,
  ConfirmedProtection,
  ImpactContext,
  InventoryImpact,
  KitchenTime,
  MenuImpact,
  RecoveryNav,
  WithheldNotice,
} from "../../features/impact/components/sections";
import { impactStateOf, primaryIncident } from "../../features/incidents/model";
import { DemoControls } from "../../features/incidents/components/DemoControls";
import { P2ErrorBoundary } from "../../features/incidents/components/P2ErrorBoundary";
import { Card, EmptyState } from "../../features/incidents/components/ui";
import "../../features/incidents/p2.css";

export function ImpactExplorerPage() {
  return (
    <PageContainer title={titleFor("/impact")} actions={<DemoControls />}>
      <P2ErrorBoundary label="Impact Explorer">
        <ImpactContent />
      </P2ErrorBoundary>
    </PageContainer>
  );
}

function ImpactContent() {
  const store = useRestaurantStore();
  const { restaurant } = store;
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<GraphFilter>("ALL");
  const [query, setQuery] = useState("");

  const incidentId = params.get("incident");
  const incident = restaurant.incidents.find((i) => i.id === incidentId) ?? primaryIncident(restaurant);
  const disruptedIngredient = incident?.ingredientId ?? HP_IDS.chicken;
  const graph = useMemo(
    () => buildImpactGraph(restaurant.snapshot, incident?.poId ?? HP_IDS.po, disruptedIngredient),
    [restaurant.snapshot, incident?.poId, disruptedIngredient],
  );
  const selectedNode = params.get("node");

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const header = (
    <div className="p2-filters p2-filters--explorer" role="search">
      <label className="p2-field p2-field--search p2-field--grow">
        <span className="p2-sr">Find a node in the dependency map</span>
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          list="impact-node-options"
          placeholder="Find supplier, PO, ingredient or menu item"
          value={query}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            const hit = graph.nodes.find((n) => n.label.toLowerCase() === v.trim().toLowerCase() || n.sublabel?.toLowerCase() === v.trim().toLowerCase());
            if (hit) update("node", hit.id);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            const q = query.trim().toLowerCase();
            const hit = q && graph.nodes.find((n) => n.label.toLowerCase().includes(q) || n.sublabel?.toLowerCase().includes(q));
            if (hit) update("node", hit.id);
          }}
        />
        <datalist id="impact-node-options">
          {graph.nodes.map((n) => <option key={n.id} value={n.label}>{n.sublabel}</option>)}
        </datalist>
      </label>
      <label className="p2-field">
        <span className="p2-field__label">Incident</span>
        <select value={incident?.id ?? ""} onChange={(e) => update("incident", e.target.value || null)} disabled={!incident}>
          {restaurant.incidents.length === 0 && <option value="">None</option>}
          {restaurant.incidents.map((i) => <option key={i.id} value={i.id}>{i.id} · {i.poId}</option>)}
        </select>
      </label>
      <label className="p2-field">
        <span className="p2-field__label">Ingredient</span>
        <select value={selectedNode?.startsWith("ingredient:") ? selectedNode.slice(11) : ""} onChange={(e) => update("node", e.target.value ? `ingredient:${e.target.value}` : null)}>
          <option value="">Any</option>
          {HP_INGREDIENTS.filter((ing) => graph.nodes.some((n) => n.id === `ingredient:${ing.id}`)).map((ing) => (
            <option key={ing.id} value={ing.id}>{ing.name}</option>
          ))}
        </select>
      </label>
    </div>
  );

  if (!incident) {
    return (
      <div className="p2">
        {header}
        <Card title="Supply-to-menu dependencies">
          <EmptyState title="No supply incident to explore">
            <p>Impact appears after a supplier report about a purchase order is received and verified. The dependency structure below is from the synthetic snapshot.</p>
          </EmptyState>
          <DependencyGraph graph={graph} snapshot={restaurant.snapshot} selectedId={selectedNode} onSelect={(id) => update("node", id)} filter={filter} onFilter={setFilter} query={query} />
        </Card>
      </div>
    );
  }

  const impactState = impactStateOf(restaurant, incident);
  const impact = selectCurrentImpact(restaurant, incident.id);
  const messages = store.messages.filter((m) => m.incidentId === incident.id);
  const canAssess = impactState === "NOT_ASSESSED" || impactState === "STALE";

  return (
    <div className="p2">
      {header}
      <WithheldNotice impactState={impactState} />
      {canAssess && (
        <div>
          <button type="button" className="p2-btn p2-btn--primary" onClick={() => assessImpactAction(incident.id)}>
            {impactState === "STALE" ? "Re-assess impact" : "Assess business impact"}
          </button>
        </div>
      )}

      <ImpactContext incident={incident} snapshot={restaurant.snapshot} messages={messages} />

      {impactState === "CURRENT" && impact && <BeforeAfter impact={impact} />}

      <Card title="Supply-to-menu dependency graph" actions={<span className="p2-fineprint">Relationships from the synthetic fixture only</span>}>
        <DependencyGraph graph={graph} snapshot={restaurant.snapshot} selectedId={selectedNode} onSelect={(id) => update("node", id)} filter={filter} onFilter={setFilter} query={query} />
      </Card>

      <div className="p2-two">
        {impactState === "CURRENT" && impact && <InventoryImpact impact={impact} snapshot={restaurant.snapshot} />}
        <KitchenTime state={restaurant} incident={incident} selectedId={selectedNode}
          onSelectStation={(id) => { update("node", id); requestAnimationFrame(() => document.querySelector(".p2-map")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />
      </div>

      <MenuImpact
        state={restaurant}
        ingredientId={disruptedIngredient}
        impact={impactState === "CURRENT" ? impact : null}
        selectedMenuId={selectedNode?.startsWith("menu:") ? selectedNode.slice(5) : null}
        onSelectMenu={(menuId) => update("node", `menu:${menuId}`)}
      />

      {impactState === "CURRENT" && impact && <ConfirmedProtection state={restaurant} impact={impact} />}

      <RecoveryNav incident={incident} impactState={impactState} hasMessages={messages.length > 0} />
    </div>
  );
}

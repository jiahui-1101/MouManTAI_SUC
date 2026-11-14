import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, PackageSearch } from "lucide-react";
import { assessOffer, buildPlanAScenario, deriveRecoverySourcingNeed } from "../domain";
import type { DomainResult, PlanAScenarioCandidate, PlanAScenarioMetadata, RecoverySourcingNeedInput, SupplierOfferCandidateInput } from "../domain";
import { SupplyNeedSummary } from "./SupplyNeedSummary";
import { SupplierOfferComparison } from "./SupplierOfferComparison";
import { SupplierOfferDetails } from "./SupplierOfferDetails";
import { RecoveryProjection } from "./RecoveryProjection";
import "../plan-a.css";

export interface PlanAWorkspaceProps {
  source?: Partial<RecoverySourcingNeedInput>;
  candidates?: SupplierOfferCandidateInput[];
  supplierNames?: Record<string, string>;
  scenarioMetadata?: PlanAScenarioMetadata;
  loading?: boolean;
  error?: string;
  impactAvailable?: boolean;
  comparisonAvailable?: boolean;
  evidenceAvailable?: boolean;
  onPreview?: (scenario: PlanAScenarioCandidate) => void;
}
function complete(source: Partial<RecoverySourcingNeedInput> | undefined): source is RecoverySourcingNeedInput {
  return Boolean(source?.incident && source.snapshot && source.impact && source.businessClock && source.ingredientPolicy && source.outletId);
}
export function PlanAWorkspace(props: PlanAWorkspaceProps) {
  const [inspectedOfferId, inspect] = useState<string | null>(null);
  const [selectedOfferId, select] = useState<string | null>(null);
  const [etaPreview, setEtaPreview] = useState<{ basis: string; id: string; eta: string } | null>(null);
  const [preview, setPreview] = useState<{ key: string; invalidated?: boolean; result: DomainResult<PlanAScenarioCandidate> } | null>(null);
  const basis = JSON.stringify([props.source, props.candidates, props.scenarioMetadata]);
  const candidates = (props.candidates ?? []).map(candidate => etaPreview?.basis === basis && etaPreview.id === candidate.offer.id ? { ...candidate, offer: { ...candidate.offer, etaLocal: etaPreview.eta } } : candidate);
  const key = JSON.stringify([basis, candidates, selectedOfferId]);
  const stale = preview !== null && (preview.invalidated === true || preview.key !== key);
  useEffect(() => {
    if (preview && preview.key !== key && !preview.invalidated) setPreview({ ...preview, invalidated: true });
  }, [key, preview]);
  if (props.loading) return <div className="pa"><section className="pa-panel" role="status">Loading current incident and recovery inputs…</section></div>;
  if (props.error) return <div className="pa"><section className="pa-panel" role="alert"><AlertCircle aria-hidden="true"/><h2>Recovery inputs unavailable</h2><p>{props.error}</p></section></div>;
  if (!complete(props.source)) {
    const missing = [!props.source?.incident && "verified incident", !props.source?.snapshot && "operational snapshot", !props.source?.impact && "P2 impact assessment", !props.source?.businessClock && "demo business clock", !props.source?.ingredientPolicy && "approved product requirement", !props.source?.outletId && "outlet context"].filter(Boolean);
    return <div className="pa"><section className="pa-panel" role="status"><PackageSearch size={32} aria-hidden="true"/><span className="pa-kicker">Plan A · Waiting for recovery inputs</span><h2>External supply workspace is waiting</h2><p>The shared recovery data connection is pending. Missing: {missing.join(", ")}.</p><p>Once a verified incident and its current impact are available, inspect supplier quotes and generate a conditional proposal here.</p><div className="pa-actions"><Link to="/incidents">View incidents</Link><Link to="/impact">View impact</Link></div></section></div>;
  }
  const source = props.source;
  const needResult = deriveRecoverySourcingNeed(source);
  if (!needResult.ok) return <div className="pa"><section className="pa-panel" role="alert"><h2>Plan A is blocked</h2><p>{needResult.error.message}</p><p className="pa-muted">{needResult.error.code}</p></section></div>;
  const need = needResult.value;
  const evaluated = candidates.map(candidate => ({ candidate, assessment: assessOffer({ candidate, need, businessClock: source.businessClock }) }));
  const inspected = evaluated.find(e => e.candidate.offer.id === inspectedOfferId);
  const selected = evaluated.find(e => e.candidate.offer.id === selectedOfferId && e.assessment.isSelectableForConditionalPlan);
  const generate = () => {
    if (!props.scenarioMetadata) return;
    const result = buildPlanAScenario({ sourcingNeed: need, candidateOffers: candidates, selectedOfferId: selected?.candidate.offer.id ?? null, currentSnapshotFingerprint: source.snapshot.fingerprint, currentSnapshotRevision: source.snapshot.revision, businessClock: source.businessClock, scenarioMetadata: props.scenarioMetadata });
    setPreview({ key, result });
    if (result.ok) props.onPreview?.(result.value);
  };
  const context = `?incidentId=${encodeURIComponent(need.incidentId)}`;
  return <div className="pa">
    <header className="pa-panel"><span className="pa-kicker">Happy Potato — Demo Outlet · Synthetic business data</span><h2>Recover supply. Preserve the constraints.</h2><p>{need.incidentId} · PO {need.poId} · {need.ingredientId}</p><p>Verified demo incident · Supplier-reported disruption · No verified goods receipt</p><p className="pa-muted">Snapshot {source.snapshot.id} · Revision {need.snapshotRevision} · {need.snapshotFingerprint} · Demo clock {source.businessClock.nowLocal} MYT</p><span className="pa-badge">{selected ? "Conditional candidate selected" : "Awaiting eligible offer selection"}</span></header>
    <SupplyNeedSummary need={need}/>
    <SupplierOfferComparison offers={evaluated} supplierNames={props.supplierNames ?? {}} inspectedOfferId={inspectedOfferId} selectedOfferId={selected?.candidate.offer.id ?? null} onInspect={id => inspect(inspectedOfferId === id ? null : id)} onSelect={id => { select(id); inspect(id); }}/>
    {evaluated.length > 0 && !evaluated.some(e => e.assessment.isSelectableForConditionalPlan) && <p role="status" className="pa-notice">No eligible supplier offers. Review missing evidence or consider <Link to={`/recovery/plan-b${context}`}>internal recovery</Link>.</p>}
    {inspected && <><SupplierOfferDetails entry={inspected} need={need} name={props.supplierNames?.[inspected.candidate.supplier.id] ?? inspected.candidate.supplier.id} evidenceAvailable={props.evidenceAvailable}/><section className="pa-panel"><h2>Timing sensitivity preview</h2><p>Explore a late arrival locally. The supplied quote remains unchanged.</p><label>ETA preview for {inspected.candidate.offer.id}<select value={etaPreview?.basis === basis && etaPreview.id === inspected.candidate.offer.id ? etaPreview.eta : "quoted"} onChange={event => setEtaPreview(event.target.value === "quoted" ? null : { basis, id: inspected.candidate.offer.id, eta: event.target.value })}><option value="quoted">Use supplied quote ETA</option><option value="13:30">13:30 MYT — late arrival</option></select></label></section></>}
    <section className="pa-panel" aria-labelledby="proposal-heading"><span className="pa-kicker">Plan A · Local proposal</span><h2 id="proposal-heading">Review before proposing</h2><p>{selected ? `Selected offer: ${selected.candidate.offer.id}` : "Select a conditionally eligible offer to calculate a proposal preview."}</p>{!props.scenarioMetadata && <p role="status">Scenario identity and version are needed before a preview can be generated.</p>}<div className="pa-actions"><button type="button" className="pa-primary" disabled={!selected || !props.scenarioMetadata} onClick={generate}>Generate Plan A preview</button></div><p className="pa-muted">Preview only. Purchasing, approval and shared comparison publishing are separate steps.</p></section>
    {stale && <p role="status" className="pa-notice">STALE — Inputs changed. Previous projection is unavailable; review eligibility and regenerate the preview.</p>}
    {!stale && preview && (preview.result.ok ? <RecoveryProjection scenario={preview.result.value}/> : <section role="alert" className="pa-panel"><h2>Proposal unavailable</h2><p>{preview.result.error.message}</p><p>{preview.result.error.code}</p></section>)}
    <section className="pa-panel"><h2>Affected chicken menus</h2><p>{need.affectedMenuIds.map(id => source.snapshot.menuItems.find(menu => menu.id === id)?.name ?? id).join(" · ")}</p><p className="pa-muted">Fries-only demand is excluded from the chicken projection.</p><div className="pa-actions">{props.impactAvailable && <Link to={`/impact${context}`}>View impact</Link>}{props.comparisonAvailable && <Link to={`/recovery/compare${context}`}>Open comparison workspace</Link>}</div>{!props.comparisonAvailable && <p>Shared comparison handoff is pending.</p>}</section>
  </div>;
}

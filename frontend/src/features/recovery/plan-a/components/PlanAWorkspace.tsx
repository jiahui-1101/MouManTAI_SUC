import { Button, StatusBadge } from "../../../../components/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, PackageSearch } from "lucide-react";
import { assessOffer, buildPlanAScenario, deriveRecoverySourcingNeed } from "../domain";
import type { DomainResult, PlanAScenarioCandidate, PlanAScenarioMetadata, RecoverySourcingNeedInput, SupplierOfferCandidateInput } from "../domain";
import { SupplyNeedSummary } from "./SupplyNeedSummary";
import { SupplierOfferComparison } from "./SupplierOfferComparison";
import { SupplierOfferDetails } from "./SupplierOfferDetails";
import type { PlanAPublisher } from "../integration";
import { PlanAProposeAction } from "./PlanAProposeAction";
import { PlanADraftActions } from "./PlanADraftActions";
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
  publisher?: PlanAPublisher;
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
  if (props.loading) return <div className="pa"><section className="pa-panel fm-panel" role="status">Loading current incident and recovery inputs…</section></div>;
  if (props.error) return <div className="pa"><section className="pa-panel fm-panel" role="alert"><AlertCircle aria-hidden="true"/><h2 className="pa-heading">Recovery inputs unavailable</h2><p>{props.error}</p></section></div>;
  if (!complete(props.source)) {
    const missing = [!props.source?.incident && "verified incident", !props.source?.snapshot && "operational snapshot", !props.source?.impact && "P2 impact assessment", !props.source?.businessClock && "demo business clock", !props.source?.ingredientPolicy && "approved product requirement", !props.source?.outletId && "outlet context"].filter(Boolean);
    return <div className="pa"><section className="pa-panel fm-panel" role="status"><PackageSearch size={32} aria-hidden="true"/><h2 className="pa-heading">External supply workspace is waiting</h2><p data-testid="plan-a-pending">Missing: {missing.join(", ")}.</p><div className="pa-actions"><Link to="/incidents">View incidents</Link><Link to="/impact">View impact</Link></div></section></div>;
  }
  const source = props.source;
  const needResult = deriveRecoverySourcingNeed(source);
  if (!needResult.ok) return <div className="pa"><section className="pa-panel fm-panel" role="alert"><h2 className="pa-heading">Plan A is blocked</h2><p>{needResult.error.message}</p><p className="pa-muted">{needResult.error.code}</p></section></div>;
  const need = needResult.value;
  const evaluated = candidates.map(candidate => ({ candidate, assessment: assessOffer({ candidate, need, businessClock: source.businessClock }) }));
  const inspected = evaluated.find(e => e.candidate.offer.id === inspectedOfferId) ?? evaluated[0];
  const selected = evaluated.find(e => e.candidate.offer.id === selectedOfferId && e.assessment.isSelectableForConditionalPlan);
  const generate = () => {
    if (!props.scenarioMetadata) return;
    const result = buildPlanAScenario({ sourcingNeed: need, candidateOffers: candidates, selectedOfferId: selected?.candidate.offer.id ?? null, currentSnapshotFingerprint: source.snapshot.fingerprint, currentSnapshotRevision: source.snapshot.revision, businessClock: source.businessClock, scenarioMetadata: props.scenarioMetadata });
    setPreview({ key, result });
    if (result.ok) props.onPreview?.(result.value);
  };
  const context = `?incidentId=${encodeURIComponent(need.incidentId)}`;
  return <div className="pa">
    <header className="pa-recovery-header">
      <div className="pa-card-heading"><h2 className="pa-workspace-title">External Supply Recovery</h2><StatusBadge tone={selected ? "warning" : "neutral"}>{selected ? "Conditional supplier selected" : "Select a supplier"}</StatusBadge></div>
      <p className="pa-muted">{need.incidentId} · PO {need.poId} · {need.ingredientId} · Synthetic business data</p>
      <details><summary>Snapshot and demo clock</summary><p className="pa-reference">Snapshot {source.snapshot.id} · Revision {need.snapshotRevision} · {need.snapshotFingerprint} · Demo clock {source.businessClock.nowLocal} MYT</p></details>
    </header>
    <SupplyNeedSummary need={need}/>
    <div className="pa-supplier-workspace">
      <SupplierOfferComparison offers={evaluated} supplierNames={props.supplierNames ?? {}} inspectedOfferId={inspected?.candidate.offer.id ?? null} selectedOfferId={selected?.candidate.offer.id ?? null} onInspect={id => inspect(id)} onSelect={id => { select(id); inspect(id); }}/>
      {inspected ? <SupplierOfferDetails entry={inspected} need={need} name={props.supplierNames?.[inspected.candidate.supplier.id] ?? inspected.candidate.supplier.id} evidenceAvailable={props.evidenceAvailable}>
        <div className="pa-sensitivity"><label>Timing sensitivity<select className="fm-select" aria-label={`ETA preview for ${inspected.candidate.offer.id}`} value={etaPreview?.basis === basis && etaPreview.id === inspected.candidate.offer.id ? etaPreview.eta : "quoted"} onChange={event => setEtaPreview(event.target.value === "quoted" ? null : { basis, id: inspected.candidate.offer.id, eta: event.target.value })}><option value="quoted">Quoted ETA</option><option value="13:30">13:30 — hypothetical arrival</option></select></label></div>
      </SupplierOfferDetails> : <section className="pa-panel fm-panel pa-detail-empty"><PackageSearch size={28} aria-hidden="true"/><h2 className="pa-heading">Compare an offer</h2><p className="pa-muted">View delivery timing and eligibility before selecting a supplier.</p></section>}
    </div>
    {!evaluated.some(e => e.assessment.isSelectableForConditionalPlan) && <p role="status" className="pa-notice">No eligible supplier offers. Review missing evidence or consider <Link to={`/recovery/plan-b${context}`}>internal recovery</Link>.</p>}
    {etaPreview?.basis === basis && <p role="status" className="pa-notice">Hypothetical {etaPreview.eta} arrival · Local preview only. Canonical quote unchanged; publication disabled.</p>}
    <section className="pa-preview-action" aria-label="Recovery preview">
      <div>{selected ? <strong>{props.supplierNames?.[selected.candidate.supplier.id] ?? selected.candidate.offer.id}</strong> : <span>Select an eligible supplier to preview recovery.</span>}{!props.scenarioMetadata && <p role="status">Scenario identity and version are needed before a preview can be generated.</p>}</div>
      <Button type="button" variant="primary" disabled={!selected || !props.scenarioMetadata} onClick={generate}>Generate preview</Button>
    </section>
    {stale && <p role="status" className="pa-notice">STALE — Inputs changed. Previous projection is unavailable; review eligibility and regenerate the preview.</p>}
    {!stale && preview && (preview.result.ok ? <RecoveryProjection scenario={preview.result.value}/> : <section role="alert" className="pa-panel fm-panel"><h2 className="pa-heading">Proposal unavailable</h2><p>{preview.result.error.message}</p><p>{preview.result.error.code}</p></section>)}
    <PlanADraftActions source={source} candidate={selected?.candidate} supplierName={selected ? props.supplierNames?.[selected.candidate.supplier.id] : undefined} proposal={!stale && preview?.result.ok ? preview.result.value : undefined} scenarioMetadata={props.scenarioMetadata} contextKey={key}/>
    <PlanAProposeAction publisher={props.publisher} candidate={!stale && preview?.result.ok ? preview.result.value : undefined} contextKey={key} localSensitivityActive={etaPreview?.basis === basis} comparisonAvailable={props.comparisonAvailable}/>
    <details className="pa-related"><summary>Affected menus and related workspaces</summary><p>{need.affectedMenuIds.map(id => source.snapshot.menuItems.find(menu => menu.id === id)?.name ?? id).join(" · ")}</p><p className="pa-muted">Fries-only demand is excluded from the chicken projection.</p><div className="pa-actions">{props.impactAvailable && <Link to={`/impact?incident=${encodeURIComponent(need.incidentId)}`}>View impact</Link>}{props.comparisonAvailable && <Link to={`/recovery/compare${context}`}>Open comparison workspace</Link>}</div></details>
  </div>;
}

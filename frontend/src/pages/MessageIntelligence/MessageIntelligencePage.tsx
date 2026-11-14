import "../p1.css";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { CANONICAL_PO_REGISTRY, CANONICAL_SUPPLIER_REGISTRY } from "../../features/messaging/mockMessageRegistry";
import { parseMockSupplierMessage } from "../../features/messaging/mockMessageRuleExtractor";
import {
  QUANTITY_UNITS,
  REVIEW_INCIDENT_TYPES,
  diffValues,
  draftFromValues,
  validateDraft,
  type CandidateField,
  type DraftErrors,
  type ExtractionVersion,
  type ReviewDraft,
} from "../../features/messaging/messageReview";
import { demoStore, incidentLinkBlockers, selectExtractionVersions, useDemoState, type InboxMessage } from "../../store/demoStore";
import { IncidentHandoff } from "../../features/messaging/IncidentHandoff";
import { StatusBadge, Tabs } from "../../components/ui";
import { EvidencePanel } from "../../features/messaging/EvidencePanel";
import { OfferReview } from "../../features/messaging/OfferReview";
import { ReviewQueue } from "../../features/messaging/ReviewQueue";
import { segmentRawText } from "../../features/messaging/segmentRawText";

const TITLE = titleFor("/message-intelligence");
const FIELD_LABELS: Record<string, string> = {
  supplierId: "Matched supplier", poId: "Purchase order", incidentType: "Incident type", ingredientId: "Ingredient",
  expectedKgMilli: "Expected quantity", claimedDeliveryKgMilli: "Delivered claim", etaStatus: "ETA", etaLocal: "ETA time",
};
const kg = (n: number | null) => (n === null ? "—" : `${(n / 1000).toFixed(3)} kg`);
const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Singapore" }).format(new Date(iso)) + " MYT";
const fmtChange = (v: string | number | null, field: CandidateField) =>
  v === null ? "empty" : field === "expectedKgMilli" || field === "claimedDeliveryKgMilli" ? kg(v as number) : String(v);

export { segmentRawText } from "../../features/messaging/segmentRawText";

export function MessageIntelligencePage() {
  const state = useDemoState();
  const [params] = useSearchParams();
  const messageId = params.get("message");

  if (state.loadStatus === "LOADING") return <PageContainer title={TITLE}><div className="fm-panel p1-state"><p role="status" aria-busy="true">Loading local mock fixture…</p><button type="button" className="fm-btn fm-btn--primary" onClick={() => demoStore.setMockLoadStatus()}>Finish mock loading</button></div></PageContainer>;
  if (state.loadStatus === "ERROR") return <PageContainer title={TITLE}><div className="fm-panel p1-state"><p role="alert">Mock fixture loading failed. No provider was contacted.</p><button type="button" className="fm-btn fm-btn--primary" onClick={() => demoStore.setMockLoadStatus()}>Retry local fixture</button></div></PageContainer>;
  if (state.messages.length === 0) {
    return <PageContainer title={TITLE}><div className="fm-empty mi-empty"><strong>No messages to review</strong><p>The active demo scenario has no supplier messages.</p><Link to="/channels">Load a demo scenario</Link></div></PageContainer>;
  }
  // First visit: the full message queue only. The review panel opens after a message is chosen.
  if (!messageId) return <PageContainer title={TITLE}><div className="mi-layout mi-layout--queue"><ReviewQueue state={state} selectedId={null} /></div></PageContainer>;
  const message = state.messages.find((m) => m.id === messageId);
  return <PageContainer title={TITLE}>
    <ResizableLayout>
      <ReviewQueue state={state} selectedId={message?.id ?? null} />
      <div className="mi-layout__detail">
        <Link className="mi-close" to="/message-intelligence" aria-label="Close review panel">×</Link>
        {!message
          ? <div role="alert" className="fm-empty mi-empty"><strong>Message not found</strong><p>{messageId} is not in the active offline fixture.</p><Link to="/inbox">Back to inbox</Link></div>
          : message.kind === "SUPPLIER_OFFER" ? <OfferReview key={message.id} message={message} /> : <Workspace key={message.id} message={message} />}
      </div>
    </ResizableLayout>
  </PageContainer>;
}

const DEFAULT_QUEUE_PCT = 55;
const MIN_PCT = 30;
const MAX_PCT = 70;
/** Queue | drag handle | detail. Width is a % of the layout. Drag, ←/→ (Shift = larger), Home or double-click resets. */
function ResizableLayout({ children }: { children: [ReactNode, ReactNode] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(DEFAULT_QUEUE_PCT);
  const clamp = (v: number) => Math.round(Math.max(MIN_PCT, Math.min(MAX_PCT, v)));
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const box = ref.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const move = (e: PointerEvent) => setPct(clamp(((e.clientX - box.left) / box.width) * 100));
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); document.body.classList.remove("is-resizing"); };
    document.body.classList.add("is-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    const next = event.key === "ArrowLeft" ? pct - step : event.key === "ArrowRight" ? pct + step : event.key === "Home" ? DEFAULT_QUEUE_PCT : null;
    if (next === null) return;
    event.preventDefault();
    setPct(clamp(next));
  };
  return <div className="mi-layout" ref={ref} style={{ "--rq-pct": `${pct}fr`, "--detail-pct": `${100 - pct}fr` } as CSSProperties}>
    {children[0]}
    <div className="mi-resizer" role="separator" aria-orientation="vertical" aria-label="Resize review queue" aria-valuenow={pct} aria-valuemin={MIN_PCT} aria-valuemax={MAX_PCT} aria-valuetext={`Queue ${pct}% of width`} tabIndex={0} onPointerDown={onPointerDown} onKeyDown={onKeyDown} onDoubleClick={() => setPct(DEFAULT_QUEUE_PCT)} title="Drag to resize · double-click to reset"><span /></div>
    {children[1]}
  </div>;
}

function Workspace({ message }: { message: InboxMessage }) {
  const state = useDemoState();
  const versions = useMemo(() => selectExtractionVersions(state, message.id), [state, message.id]);
  const latest = versions[versions.length - 1]!;
  const [viewed, setViewed] = useState(latest.version);
  const [draft, setDraft] = useState<ReviewDraft>(() => draftFromValues(latest.values));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => { if (!message.read) demoStore.select(message.id); }, [message.id, message.read]);
  useEffect(() => { setViewed(latest.version); setDraft(draftFromValues(latest.values)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest.id]);

  const view = versions.find((v) => v.version === viewed) ?? latest;
  const parse = parseMockSupplierMessage({ rawText: message.rawText, senderRegistryId: message.senderRegistryId });
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromValues(latest.values));
  const linked = state.incident.messageIds.includes(message.id);
  const linkMode = state.incident.status === "VERIFIED" && !linked;
  const [pendingLink, setPendingLink] = useState(false);
  const [tab, setTab] = useState<"review" | "history" | "evidence">("review");
  const blockers = linked ? [`Already linked to ${state.incident.id}; repeated confirmation has no effect.`] : incidentLinkBlockers(state, message.id);
  if (dirty) blockers.push("Unsaved edits: save the correction or discard it (Esc) before confirming.");
  const locked = latest.reviewStatus === "VERIFIED";

  const update = <K extends keyof ReviewDraft>(key: K, value: ReviewDraft[K]) => { setDraft((d) => ({ ...d, [key]: value })); setErrors((e) => ({ ...e, [key]: undefined, form: undefined })); };
  const discard = () => { setDraft(draftFromValues(latest.values)); setErrors({}); setStatus("Unsaved edits discarded."); };
  const save = () => {
    const result = validateDraft(draft);
    if (!result.values) { setErrors(result.errors); setStatus("Correction not saved: fix the highlighted fields."); return; }
    if (!diffValues(latest.values, result.values).length && latest.reviewStatus !== "REJECTED" && latest.reviewStatus !== "UNRESOLVED") { setErrors({ form: "No candidate values changed; nothing to save." }); return; }
    const saved = demoStore.saveExtractionCorrection(message.id, result.values, { note: note.trim() || undefined });
    setErrors({}); setNote(""); setStatus(`Saved version ${saved.version} as HUMAN_CORRECTION.`);
  };
  const decide = (decision: "REJECTED" | "MARKED_UNRESOLVED") => {
    if (!note.trim()) { setErrors({ form: "Enter a review reason before rejecting or marking unresolved." }); return; }
    const saved = demoStore.decideExtractionReview(message.id, decision, note);
    setNote(""); setErrors({}); setStatus(`Version ${saved.version} recorded as ${saved.reviewStatus}.`);
  };
  const confirm = () => { demoStore.confirmExtractionReview(message.id); setStatus(`Confirmed. ${state.incident.id} verified with ${message.id}.`); };
  const link = () => { demoStore.linkMessageToIncident(message.id); setPendingLink(false); setStatus(`${message.id} linked to ${state.incident.id}. Claimed shortfall unchanged.`); };
  const onHistoryKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const offset = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    const target = event.key === "Home" ? 0 : event.key === "End" ? versions.length - 1 : offset ? (index + offset + versions.length) % versions.length : -1;
    if (target < 0) return;
    event.preventDefault();
    setViewed(versions[target]!.version);
    (event.currentTarget.closest("ol")?.querySelectorAll("button")[target] as HTMLButtonElement | undefined)?.focus();
  };

  const po = view.values.poId ? CANONICAL_PO_REGISTRY[view.values.poId as keyof typeof CANONICAL_PO_REGISTRY] : undefined;
  const poStatus = !po ? "UNRESOLVED" : message.senderRegistryId === null ? "UNVERIFIED" : message.senderRegistryId !== po.supplierId || (view.values.supplierId && view.values.supplierId !== po.supplierId) ? "CONFLICT" : "MATCHED";
  const evidence = (spanField: string | null, field: CandidateField | null) => {
    if (field && view.humanAssertedFields.includes(field)) return <span className="mi-chip mi-chip--human">Human assertion · no source span</span>;
    const span = spanField ? view.evidenceSpans.find((s) => s.field === spanField) : undefined;
    return span ? <span className="mi-chip">“{span.text}” · chars {span.start}–{span.end}</span> : <span className="mi-chip mi-chip--none">No raw-text evidence</span>;
  };
  const supplierName = view.values.supplierId ? CANONICAL_SUPPLIER_REGISTRY[view.values.supplierId as keyof typeof CANONICAL_SUPPLIER_REGISTRY]?.displayName : undefined;

  const title = message.subject ?? (message.poId ? `${message.poId} delivery disruption` : "Unmatched supplier message");
  const issue = linked
    ? { tone: "success", title: `Linked to ${state.incident.id}`, text: `Already linked to ${state.incident.id} — confirming again has no effect. This message is now evidence for the incident.` }
    : blockers.length
      ? { tone: "warning", title: "Check before confirming", text: "Confirm stays disabled until these are resolved:" }
      : { tone: "success", title: linkMode ? "Ready to link" : "Ready to confirm", text: linkMode ? "Values match the verified incident. Link this channel as extra evidence — the 20 kg shortfall is not added again." : "Sender and PO are verified and every value has supplier evidence. Check the values, then confirm." };
  const evidenceCell = (spanField: string | null, field: CandidateField | null) => evidence(spanField, field);
  const tabs = [
    { id: "review" as const, label: "Check & correct", panel: <div className="mi-steps">
      <div className="mi-quote">
        <p className="mi-quote__label">Supplier message · original, never edited</p>
        <p data-testid="raw-text">{segmentRawText(message.rawText, view.evidenceSpans).map((seg, i) => seg.span ? <mark key={i} className="mi-mark" data-field={seg.span.field} data-start={seg.span.start} data-end={seg.span.end} title={`${FIELD_LABELS[seg.span.field] ?? seg.span.field} · chars ${seg.span.start}–${seg.span.end}`}>{seg.text}</mark> : <span key={i}>{seg.text}</span>)}</p>
      </div>
      <form className="mi-form" aria-label="Check the extracted values and correct if needed" noValidate onSubmit={(e) => { e.preventDefault(); save(); }} onKeyDown={(e) => { if (e.key === "Escape" && dirty) { e.preventDefault(); discard(); } }}>
        <div className="mi-compare" role="table" aria-label="Extracted values">
          <div className="mi-compare__row mi-compare__row--head" role="row"><span role="columnheader">Field · extracted (v{view.version})</span><span role="columnheader">Your value {locked ? "(locked after confirmation)" : "— change only if wrong"}</span></div>
          <div className="mi-compare__row" role="row"><div role="cell"><b>Supplier</b><span>{view.values.supplierId ? `${view.values.supplierId} · ${supplierName ?? "unknown"}` : "None"}</span>{evidenceCell(null, "supplierId")}</div><fieldset role="cell" disabled={locked}><Field id="supplierId" label="Candidate supplier" error={errors.supplierId}><select id="supplierId" value={draft.supplierId} onChange={(e) => update("supplierId", e.target.value)}><option value="">None</option>{Object.values(CANONICAL_SUPPLIER_REGISTRY).map((s) => <option key={s.id} value={s.id}>{s.id} · {s.displayName}</option>)}</select></Field></fieldset></div>
          <div className="mi-compare__row" role="row"><div role="cell"><b>Purchase order</b><span>{view.values.poId ?? "No matched PO"} <span className={`mi-chip mi-po-${poStatus.toLowerCase()}`}>{poStatus}</span></span>{evidenceCell("poId", "poId")}</div><fieldset role="cell" disabled={locked}><Field id="poId" label="Purchase order" error={errors.poId}><input id="poId" value={draft.poId} onChange={(e) => update("poId", e.target.value)} /></Field></fieldset></div>
          <div className="mi-compare__row" role="row"><div role="cell"><b>Incident type</b><span>{view.values.incidentType ?? "Unresolved"}</span>{evidenceCell("incidentType", "incidentType")}</div><fieldset role="cell" disabled={locked}><Field id="incidentType" label="Incident type" error={errors.incidentType}><select id="incidentType" value={draft.incidentType} onChange={(e) => update("incidentType", e.target.value)}><option value="">Unresolved</option>{REVIEW_INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field></fieldset></div>
          <div className="mi-compare__row" role="row"><div role="cell"><b>Expected quantity</b><span>{kg(view.values.expectedKgMilli)}</span>{evidenceCell("expectedKgMilli", "expectedKgMilli")}</div><fieldset role="cell" disabled={locked}><Quantity id="expected" label="Expected quantity" qty={draft.expectedQty} unit={draft.expectedUnit} error={errors.expectedQty ?? errors.expectedUnit} onQty={(v) => update("expectedQty", v)} onUnit={(v) => update("expectedUnit", v)} /></fieldset></div>
          <div className="mi-compare__row" role="row"><div role="cell"><b>Delivered claim</b><span>{kg(view.values.claimedDeliveryKgMilli)}</span>{evidenceCell("claimedDeliveryKgMilli", "claimedDeliveryKgMilli")}</div><fieldset role="cell" disabled={locked}><Quantity id="claimed" label="Delivered claim" qty={draft.claimedQty} unit={draft.claimedUnit} error={errors.claimedQty ?? errors.claimedUnit} onQty={(v) => update("claimedQty", v)} onUnit={(v) => update("claimedUnit", v)} /></fieldset></div>
          <div className="mi-compare__row" role="row"><div role="cell"><b>ETA</b><span>{view.values.etaStatus === "KNOWN" ? `${view.values.etaLocal} MYT` : "UNKNOWN (update promise is not an ETA)"}</span>{evidenceCell("etaStatus", view.values.etaStatus === "KNOWN" ? "etaLocal" : "etaStatus")}</div><fieldset role="cell" disabled={locked}><Field id="etaStatus" label="ETA status" error={undefined}><select id="etaStatus" value={draft.etaStatus} onChange={(e) => update("etaStatus", e.target.value as ReviewDraft["etaStatus"])}><option value="UNKNOWN">UNKNOWN</option><option value="KNOWN">KNOWN</option></select></Field>
            {draft.etaStatus === "KNOWN" && <Field id="etaLocal" label="ETA (MYT)" error={errors.etaLocal}><input id="etaLocal" type="datetime-local" value={draft.etaLocal} onChange={(e) => update("etaLocal", e.target.value)} /></Field>}</fieldset></div>
          <div className="mi-compare__row mi-compare__row--total" role="row"><div role="cell"><b>PO shortfall</b><span>{kg(view.shortfallKgMilli)}</span></div><div role="cell" className="mi-hint">Calculated: expected − delivered claim</div></div>
        </div>
        {errors.form && <p role="alert" className="mi-error">{errors.form}</p>}
        {Object.entries(errors).some(([k, v]) => k !== "form" && v) && <p role="alert" className="mi-error">Validation failed. Nothing was saved.</p>}
        <div className="mi-actions">
          <button type="submit" className="fm-btn fm-btn--primary" disabled={locked}>Save correction</button>
          <button type="button" className="fm-btn fm-btn--ghost" disabled={!dirty} onClick={discard}>Discard edits</button>
          <span className="mi-hint">Saving creates v{latest.version + 1}. Changed values are marked as your assertion, not supplier evidence. Esc discards.</span>
        </div>
      </form>
    </div> },
    { id: "history" as const, label: `History (${versions.length})`, panel: <section className="mi-tabpanel" aria-label="Review history">
        <ol className="mi-history" aria-label="Extraction versions">{versions.map((v, i) => <li key={v.id}><button type="button" aria-current={v.version === view.version ? "true" : undefined} className={v.version === view.version ? "is-active" : ""} onClick={() => { setViewed(v.version); setTab("review"); }} onKeyDown={(e) => onHistoryKey(e, i)}>
          <strong>v{v.version} · {v.method} · {v.reviewStatus}</strong>
          <span>{v.decision} by {v.actor} · <time dateTime={v.createdAtIso}>{fmtTime(v.createdAtIso)}</time></span>
          {v.changedFields.length > 0 && <span>Changed: {v.changedFields.map((c) => `${FIELD_LABELS[c.field]} ${fmtChange(c.from, c.field)} → ${fmtChange(c.to, c.field)}`).join("; ")}</span>}
          {v.note && <span>Note: {v.note}</span>}
        </button></li>)}</ol>
      <p className="mi-hint">Select a version to view it on the Check &amp; correct tab. ↑/↓, Home and End move between versions.</p>
    </section> },
    { id: "evidence" as const, label: "Evidence & handoff", panel: <section className="mi-tabpanel" aria-label="Evidence and handoff">
      <h3 className="mi-step__title">Why this needs review</h3>
      <ul className="mi-reasons">{parse.reviewReasons.map((r) => <li key={r}>{r}</li>)}<li>Sender identity comes from the channel registry ({message.senderRegistryId ?? "none"}), never from edited fields.</li></ul>
      <IncidentHandoff />
      <EvidencePanel messageId={message.id} />
    </section> },
  ];

  return <div className="mi mi-detail">
    <header className="mi-detail__head">
      <div className="mi-detail__titles">
        <p className="rq__eyebrow">Supplier disruption review <span className="mi-detail__id">{message.id}</span></p>
        <h2 className="mi-detail__title">{title}</h2>
        <p className="mi-detail__meta">{message.senderDisplay} · {message.verification === "VERIFIED_DEMO_CONTACT" ? "Verified demo contact" : "Unverified sender"} · <time dateTime={message.receivedAtIso}>{fmtTime(message.receivedAtIso)}</time></p>
      </div>
      <div className="mi-detail__badges">{linked ? <StatusBadge tone="success">Confirmed · {state.incident.id}</StatusBadge> : latest.reviewStatus === "REJECTED" ? <StatusBadge tone="neutral">Rejected</StatusBadge> : latest.reviewStatus === "UNRESOLVED" ? <StatusBadge tone="warning">On hold</StatusBadge> : <StatusBadge tone="warning">Needs review</StatusBadge>}<StatusBadge tone="info">Rule-based · no AI</StatusBadge><StatusBadge tone="simulated">Simulated</StatusBadge></div>
    </header>
    <div className="mi-actionbar">
      <span className="mi-avatar" aria-hidden="true">DO</span><span className="mi-actionbar__label">Reviewer</span><strong className="mi-actionbar__name">Demo operator</strong>
      <label className="mi-actionbar__note"><span className="sr-only">Review reason / note</span><input id="reviewNote" placeholder="Reason (needed to reject or hold)" value={note} onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, form: undefined })); }} /></label>
      <button type="button" className="fm-btn fm-btn--ghost" disabled={locked} onClick={() => decide("REJECTED")}>Reject</button>
      <button type="button" className="fm-btn fm-btn--ghost" disabled={locked} onClick={() => decide("MARKED_UNRESOLVED")}>Mark unresolved</button>
          {linkMode
            ? <button type="button" className="fm-btn fm-btn--primary" disabled={blockers.length > 0 || pendingLink} aria-describedby="mi-blockers" onClick={() => setPendingLink(true)}>Link to existing incident {state.incident.id}</button>
            : <button type="button" className="fm-btn fm-btn--primary" disabled={blockers.length > 0} aria-describedby="mi-blockers" onClick={confirm}>Confirm &amp; verify incident</button>}
    </div>
    <p className={status ? "mi__status" : "sr-only"} role="status" aria-live="polite">{status}</p>
    <section className={`mi-issue mi-issue--${issue.tone}`} aria-label="Review status" id="mi-blockers">
      <p className="mi-issue__title">{issue.title}</p>
      <p>{issue.text}</p>
      {!linked && blockers.length > 0 && <><strong className="sr-only">Confirmation disabled:</strong><ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul></>}
      {linked && <p><Link to="/inbox">Back to inbox</Link></p>}
    </section>
        {pendingLink && blockers.length === 0 && <div role="group" aria-label="Confirm incident link" className="mi-blockers mi-confirm">
          <p>Link <strong>{message.id}</strong> ({message.channel}) as additional evidence for <strong>{state.incident.id}</strong>? The same {kg(state.incident.claimedShortfallKgMilli)} supplier claim is not added again.</p>
          <button type="button" className="fm-btn fm-btn--primary" onClick={link}>Confirm link</button> <button type="button" className="fm-btn fm-btn--ghost" onClick={() => setPendingLink(false)}>Cancel</button>
        </div>}
    {view.version !== latest.version && <p className="fm-banner fm-banner--warning p1-banner">Viewing previous version {view.version} (read-only). Latest is v{latest.version}. <button type="button" className="mi-link" onClick={() => setViewed(latest.version)}>View latest</button></p>}
    <Tabs label="Review sections" tabs={tabs} value={tab} onChange={setTab} />
  </div>;
}

function Field({ id, label, error, children }: { id: string; label: string; error: string | undefined; children: ReactNode }) {
  return <div className={`mi-field ${error ? "has-error" : ""}`}><label htmlFor={id}>{label}</label>{children}{error && <span id={`${id}-error`} className="mi-error">{error}</span>}</div>;
}

function Quantity({ id, label, qty, unit, error, onQty, onUnit }: { id: string; label: string; qty: string; unit: ReviewDraft["expectedUnit"]; error?: string; onQty: (v: string) => void; onUnit: (v: ReviewDraft["expectedUnit"]) => void }) {
  return <div className={`mi-field ${error ? "has-error" : ""}`}><label htmlFor={`${id}Qty`}>{label}</label><div className="mi-qty">
    <input id={`${id}Qty`} inputMode="decimal" value={qty} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} onChange={(e) => onQty(e.target.value)} />
    <select aria-label={`${label} unit`} value={unit} onChange={(e) => onUnit(e.target.value as ReviewDraft["expectedUnit"])}>{QUANTITY_UNITS.map((u) => <option key={u}>{u}</option>)}</select>
  </div>{error && <span id={`${id}-error`} className="mi-error">{error}</span>}</div>;
}

export type { ExtractionVersion };

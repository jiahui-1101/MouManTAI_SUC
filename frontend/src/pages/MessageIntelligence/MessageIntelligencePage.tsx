import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
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
import { EvidencePanel } from "../../features/messaging/EvidencePanel";
import { OfferReview } from "../../features/messaging/OfferReview";
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

  if (state.loadStatus === "LOADING") return <PageContainer title={TITLE}><p role="status" aria-busy="true">Loading local mock fixture…</p></PageContainer>;
  if (state.loadStatus === "ERROR") return <PageContainer title={TITLE}><p role="alert">Mock fixture loading failed. No provider was contacted.</p><button type="button" className="mi-button" onClick={() => demoStore.setMockLoadStatus()}>Retry local fixture</button></PageContainer>;
  if (!messageId) {
    return <PageContainer title={TITLE}><div className="inbox__empty mi-empty"><strong>No message selected</strong><p>Choose a simulated message to review.</p>
      {state.messages.length === 0 ? <Link to="/channels">Load a demo scenario</Link> : <ul className="mi-picker">{state.messages.map((m) => <li key={m.id}><Link to={`/message-intelligence?message=${m.id}`}>{m.id} · {m.senderDisplay}</Link></li>)}</ul>}
    </div></PageContainer>;
  }
  const message = state.messages.find((m) => m.id === messageId);
  if (!message) return <PageContainer title={TITLE}><div role="alert" className="inbox__empty mi-empty"><strong>Message not found</strong><p>{messageId} is not in the active offline fixture.</p><Link to="/inbox">Back to inbox</Link></div></PageContainer>;
  return <PageContainer title={TITLE}>{message.kind === "SUPPLIER_OFFER" ? <OfferReview key={message.id} message={message} /> : <Workspace key={message.id} message={message} />}</PageContainer>;
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
  useEffect(() => { setViewed(latest.version); setDraft(draftFromValues(latest.values)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest.id]);

  const view = versions.find((v) => v.version === viewed) ?? latest;
  const parse = parseMockSupplierMessage({ rawText: message.rawText, senderRegistryId: message.senderRegistryId });
  const dirty = JSON.stringify(draft) !== JSON.stringify(draftFromValues(latest.values));
  const linked = state.incident.messageIds.includes(message.id);
  const linkMode = state.incident.status === "VERIFIED" && !linked;
  const [pendingLink, setPendingLink] = useState(false);
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

  return <div className="mi">
    <p className="mi__label"><strong>Rule-based extraction — no AI model used.</strong> SIMULATED_CHANNEL · {message.channel} · synthetic demo data.</p>
    <p className={status ? "mi__status" : "sr-only"} role="status" aria-live="polite">{status}</p>
    <div className="mi__grid">
      <section className="message-detail__original mi__original" aria-labelledby="mi-original">
        <div><h2 id="mi-original">Immutable original message</h2><span>Read-only · {message.senderDisplay} · {message.verification === "VERIFIED_DEMO_CONTACT" ? "Verified demo contact" : "UNVERIFIED_SENDER"}</span></div>
        <p data-testid="raw-text">{segmentRawText(message.rawText, view.evidenceSpans).map((seg, i) => seg.span ? <mark key={i} className="mi-mark" data-field={seg.span.field} data-start={seg.span.start} data-end={seg.span.end} title={`${FIELD_LABELS[seg.span.field] ?? seg.span.field} · chars ${seg.span.start}–${seg.span.end}`}>{seg.text}</mark> : <span key={i}>{seg.text}</span>)}</p>
        <small>Highlights show evidence for version {view.version}. Text is never edited.</small>
      </section>
      <section className="mi__extraction" aria-labelledby="mi-extraction">
        <header><h2 id="mi-extraction">Structured extraction · v{view.version}</h2><span className={`mi-chip mi-method-${view.method.toLowerCase()}`}>{view.method}</span><span className="mi-chip">{view.reviewStatus}</span></header>
        {view.version !== latest.version && <p className="message-detail__warning">Viewing previous version {view.version} (read-only). Latest is v{latest.version}. <button type="button" className="mi-link" onClick={() => setViewed(latest.version)}>View latest</button></p>}
        <dl className="mi-fields">
          <div><dt>Matched supplier</dt><dd>{view.values.supplierId ? `${view.values.supplierId} · ${supplierName ?? "unknown"}` : "None"}</dd><dd>{evidence(null, "supplierId")}</dd></div>
          <div><dt>Purchase order</dt><dd>{view.values.poId ?? "No matched PO"} <span className={`mi-chip mi-po-${poStatus.toLowerCase()}`}>{poStatus}</span></dd><dd>{evidence("poId", "poId")}</dd></div>
          <div><dt>Incident type</dt><dd>{view.values.incidentType ?? "Unresolved"}</dd><dd>{evidence("incidentType", "incidentType")}</dd></div>
          <div><dt>Expected quantity</dt><dd>{kg(view.values.expectedKgMilli)}</dd><dd>{evidence("expectedKgMilli", "expectedKgMilli")}</dd></div>
          <div><dt>Delivered claim</dt><dd>{kg(view.values.claimedDeliveryKgMilli)}</dd><dd>{evidence("claimedDeliveryKgMilli", "claimedDeliveryKgMilli")}</dd></div>
          <div><dt>PO shortfall</dt><dd>{kg(view.shortfallKgMilli)}</dd><dd><span className="mi-chip mi-chip--none">Derived: expected − delivered claim</span></dd></div>
          <div><dt>ETA</dt><dd>{view.values.etaStatus === "KNOWN" ? `${view.values.etaLocal} MYT` : "UNKNOWN (update promise is not an ETA)"}</dd><dd>{evidence("etaStatus", view.values.etaStatus === "KNOWN" ? "etaLocal" : "etaStatus")}</dd></div>
        </dl>
        <h3>Verification reasons</h3>
        <ul className="mi-reasons">{parse.reviewReasons.map((r) => <li key={r}>{r}</li>)}<li>Sender identity comes from the channel registry ({message.senderRegistryId ?? "none"}), never from edited fields.</li></ul>
      </section>
    </div>

    <div className="mi__grid">
      <form className="settings-card mi-form" aria-labelledby="mi-review" noValidate onSubmit={(e) => { e.preventDefault(); save(); }} onKeyDown={(e) => { if (e.key === "Escape" && dirty) { e.preventDefault(); discard(); } }}>
        <header><h2 id="mi-review">Human review · edits create v{latest.version + 1}</h2></header>
        <fieldset disabled={locked}>
          <legend className="sr-only">Candidate values</legend>
          <Field id="supplierId" label="Candidate supplier" error={errors.supplierId}><select id="supplierId" value={draft.supplierId} onChange={(e) => update("supplierId", e.target.value)}><option value="">None</option>{Object.values(CANONICAL_SUPPLIER_REGISTRY).map((s) => <option key={s.id} value={s.id}>{s.id} · {s.displayName}</option>)}</select></Field>
          <Field id="poId" label="Purchase order" error={errors.poId}><input id="poId" value={draft.poId} onChange={(e) => update("poId", e.target.value)} /></Field>
          <Field id="incidentType" label="Incident type" error={errors.incidentType}><select id="incidentType" value={draft.incidentType} onChange={(e) => update("incidentType", e.target.value)}><option value="">Unresolved</option>{REVIEW_INCIDENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Quantity id="expected" label="Expected quantity" qty={draft.expectedQty} unit={draft.expectedUnit} error={errors.expectedQty ?? errors.expectedUnit} onQty={(v) => update("expectedQty", v)} onUnit={(v) => update("expectedUnit", v)} />
          <Quantity id="claimed" label="Delivered claim" qty={draft.claimedQty} unit={draft.claimedUnit} error={errors.claimedQty ?? errors.claimedUnit} onQty={(v) => update("claimedQty", v)} onUnit={(v) => update("claimedUnit", v)} />
          <Field id="etaStatus" label="ETA status" error={undefined}><select id="etaStatus" value={draft.etaStatus} onChange={(e) => update("etaStatus", e.target.value as ReviewDraft["etaStatus"])}><option value="UNKNOWN">UNKNOWN</option><option value="KNOWN">KNOWN</option></select></Field>
          {draft.etaStatus === "KNOWN" && <Field id="etaLocal" label="ETA (MYT)" error={errors.etaLocal}><input id="etaLocal" type="datetime-local" value={draft.etaLocal} onChange={(e) => update("etaLocal", e.target.value)} /></Field>}
          <Field id="reviewNote" label="Review reason / note" error={undefined}><textarea id="reviewNote" rows={2} value={note} onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, form: undefined })); }} /></Field>
        </fieldset>
        {errors.form && <p role="alert" className="mi-error">{errors.form}</p>}
        {Object.entries(errors).some(([k, v]) => k !== "form" && v) && <p role="alert" className="mi-error">Validation failed. Nothing was saved.</p>}
        <p className="mi-hint">Changed values without a supporting raw-text span are recorded as human assertions, not source evidence. Press Esc to discard edits.</p>
        <div className="mi-actions">
          <button type="submit" className="mi-button mi-button--primary" disabled={locked}>Save correction</button>
          <button type="button" className="mi-button" disabled={!dirty} onClick={discard}>Discard edits</button>
          <button type="button" className="mi-button" disabled={locked} onClick={() => decide("REJECTED")}>Reject</button>
          <button type="button" className="mi-button" disabled={locked} onClick={() => decide("MARKED_UNRESOLVED")}>Mark unresolved</button>
          {linkMode
            ? <button type="button" className="mi-button mi-button--primary" disabled={blockers.length > 0 || pendingLink} aria-describedby="mi-blockers" onClick={() => setPendingLink(true)}>Link to existing incident {state.incident.id}</button>
            : <button type="button" className="mi-button mi-button--primary" disabled={blockers.length > 0} aria-describedby="mi-blockers" onClick={confirm}>Confirm &amp; verify incident</button>}
        </div>
        {pendingLink && blockers.length === 0 && <div role="group" aria-label="Confirm incident link" className="mi-blockers mi-confirm">
          <p>Link <strong>{message.id}</strong> ({message.channel}) as additional evidence for <strong>{state.incident.id}</strong>? The same {kg(state.incident.claimedShortfallKgMilli)} supplier claim is not added again.</p>
          <button type="button" className="mi-button mi-button--primary" onClick={link}>Confirm link</button> <button type="button" className="mi-button" onClick={() => setPendingLink(false)}>Cancel</button>
        </div>}
        <div id="mi-blockers" className="mi-blockers">{blockers.length ? <><strong>Confirmation disabled:</strong><ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul></> : <span>Safe to {linkMode ? "link" : "confirm"}: verified sender, matched {state.incident.poId}, compatible incident type, source evidence present.</span>}</div>
        {linked && <p className="message-detail__correlation">Linked to <strong>{state.incident.id}</strong> ({state.incident.status}). <Link to="/inbox">Back to inbox</Link></p>}
        <IncidentHandoff />
        <EvidencePanel messageId={message.id} />
      </form>
      <section className="settings-card" aria-labelledby="mi-history">
        <header><h2 id="mi-history">Review history</h2></header>
        <ol className="mi-history" aria-label="Extraction versions">{versions.map((v, i) => <li key={v.id}><button type="button" aria-current={v.version === view.version ? "true" : undefined} className={v.version === view.version ? "is-active" : ""} onClick={() => setViewed(v.version)} onKeyDown={(e) => onHistoryKey(e, i)}>
          <strong>v{v.version} · {v.method} · {v.reviewStatus}</strong>
          <span>{v.decision} by {v.actor} · <time dateTime={v.createdAtIso}>{fmtTime(v.createdAtIso)}</time></span>
          {v.changedFields.length > 0 && <span>Changed: {v.changedFields.map((c) => `${FIELD_LABELS[c.field]} ${fmtChange(c.from, c.field)} → ${fmtChange(c.to, c.field)}`).join("; ")}</span>}
          {v.note && <span>Note: {v.note}</span>}
        </button></li>)}</ol>
        <p className="mi-hint">Use ↑/↓, Home and End to move between versions.</p>
      </section>
    </div>
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

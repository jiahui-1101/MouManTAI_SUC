import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { demoStore, selectOfferReviewVersions, useDemoState, type InboxMessage } from "../../store/demoStore";
import { segmentRawText } from "./segmentRawText";
import { offerQualificationBlockers, parseMockSupplierOffer } from "./supplierOffer";
import { selectSupplierOfferEvidence } from "./evidenceSelectors";
import { EvidencePanel } from "./EvidencePanel";
import { StatusBadge } from "../../components/ui";

const rm = (sen: number) => `RM${(sen / 100).toFixed(2)}`;

export function OfferReview({ message }: { message: InboxMessage }) {
  const state = useDemoState();
  const parse = parseMockSupplierOffer(message);
  const versions = selectOfferReviewVersions(state, message.id);
  const evidence = selectSupplierOfferEvidence(state).find((o) => o.messageId === message.id);
  const blockers = offerQualificationBlockers(message.senderRegistryId, parse);
  useEffect(() => { if (!message.read) demoStore.select(message.id); }, [message.id, message.read]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const decide = (d: "QUALIFIED" | "REJECTED" | "MARKED_UNRESOLVED") => {
    if (!note.trim()) { setError("Enter a review reason first."); return; }
    try { const v = demoStore.reviewSupplierOffer(message.id, d, note); setStatus(`Version ${v.version}: ${v.qualification}.`); setNote(""); setError(""); }
    catch (e) { setError((e as Error).message); }
  };
  const c = parse.claim;
  return <div className="mi mi-detail">
    <header className="mi-detail__head">
      <div className="mi-detail__titles">
        <p className="rq__eyebrow">Supplier offer review <span className="mi-detail__id">{message.id}</span></p>
        <h2 className="mi-detail__title">{message.subject ?? "Supplier offer claim"}</h2>
        <p className="mi-detail__meta">{message.senderDisplay} · {message.senderRegistryId ?? "unregistered"} · Outlook</p>
      </div>
      <div className="mi-detail__badges"><StatusBadge tone="info">Rule-based · no AI</StatusBadge><StatusBadge tone="simulated">Simulated</StatusBadge></div>
    </header>
    <p className="fm-banner fm-banner--warning p1-banner" data-testid="offer-limits"><strong>Offer claim only.</strong> This is not goods received, not confirmed procurement and not a completed supplier action. Canonical business offer {evidence?.matchesCanonicalOfferId ?? "—"} is unchanged.</p>
    <p className={status ? "mi__status" : "sr-only"} role="status" aria-live="polite">{status}</p>
    <div className="mi__grid">
      <section className="message-detail__original" aria-labelledby="ofr-raw"><div><h2 id="ofr-raw">Immutable original message</h2><span>{message.senderDisplay} · {message.senderRegistryId ?? "unregistered"}</span></div>
        <p data-testid="raw-text">{segmentRawText(message.rawText, parse.evidenceSpans).map((s, i) => s.span ? <mark key={i} className="mi-mark" data-field={s.span.field} data-start={s.span.start} data-end={s.span.end}>{s.text}</mark> : <span key={i}>{s.text}</span>)}</p></section>
      <section className="mi__extraction" aria-labelledby="ofr-claim"><header><h2 id="ofr-claim">Offer claim</h2><span className="mi-chip">{parse.method}</span><span className="mi-chip" data-testid="offer-qualification">{message.offerQualification}</span></header>
        {c ? <dl className="mi-fields">
          <div><dt>RFQ / supplier</dt><dd>{c.rfqId} · {c.supplierId ?? "unknown"}</dd></div>
          <div><dt>Offered quantity</dt><dd>{(c.quantityKgMilli / 1000).toFixed(3)} kg {c.spec.toLowerCase()} chicken</dd></div>
          <div><dt>Price / freight</dt><dd>{rm(c.pricePerKgSen)}/kg · {rm(c.freightSen)} freight</dd></div>
          <div><dt>Stated ETA</dt><dd>{c.statedEtaLocal} MYT (stated, subject to confirmation)</dd></div>
        </dl> : <p>No grounded offer values.</p>}
        <p className="mi-hint">P3 reads this via <code>selectSupplierOfferEvidence</code>; P1 does not compare offers or draft POs. <Link to="/recovery/plan-a">Plan A</Link></p>
      </section>
    </div>
    <div className="mi__grid">
      <section className="fm-panel" aria-labelledby="ofr-review"><header><h2 id="ofr-review">Sender &amp; claim qualification</h2></header>
        <div className="mi-field"><label htmlFor="offerNote">Review reason</label><textarea id="offerNote" rows={2} value={note} onChange={(e) => { setNote(e.target.value); setError(""); }} /></div>
        {error && <p role="alert" className="mi-error">{error}</p>}
        <div className="mi-actions">
          <button type="button" className="fm-btn fm-btn--primary" disabled={blockers.length > 0} aria-describedby="ofr-blockers" onClick={() => decide("QUALIFIED")}>Qualify sender &amp; offer (conditional)</button>
          <button type="button" className="fm-btn fm-btn--ghost" onClick={() => decide("REJECTED")}>Reject offer</button>
          <button type="button" className="fm-btn fm-btn--ghost" onClick={() => decide("MARKED_UNRESOLVED")}>Mark unresolved</button>
        </div>
        <div id="ofr-blockers" className="mi-blockers">{blockers.length ? <ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul> : <span>Sender {message.senderRegistryId} is an approved demo supplier; qualification stays conditional.</span>}</div>
        <EvidencePanel messageId={message.id} />
      </section>
      <section className="fm-panel" aria-labelledby="ofr-history"><header><h2 id="ofr-history">Review history</h2></header>
        <ol className="mi-history" aria-label="Offer review versions">{versions.map((v) => <li key={v.id}><div className="mi-history__item"><strong>v{v.version} · {v.method} · {v.qualification}</strong><span>{v.decision} by {v.actor} · {v.createdAtIso}</span>{v.note && <span>Note: {v.note}</span>}</div></li>)}</ol>
      </section>
    </div>
  </div>;
}

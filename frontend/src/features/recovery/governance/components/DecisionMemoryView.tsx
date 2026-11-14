import { useId, useState } from 'react';
import { Button, DataPanel } from '../../../../components/ui';
import { formatKgMilli, formatSenAsRM, shortFingerprint } from '../format';
import { EVIDENCE_QUALITY_LABELS, LESSON_KIND_LABELS, VERIFICATION_LEVEL_LABELS, demoTime } from '../labels';
import type { ApprovalRecord, DecisionMemoryEntry, OutcomeStatus, ScenarioStrategy, VerificationLevel } from '../p5Contracts';
import { useP5Store, useP5World } from '../p5Store';
import { selectDecisionMemory, selectSuccessfulCaseCount } from '../selectors';
import { Dialog } from './Dialog';
import { NotWiredNotice } from './common';
import { P5Details } from './P5Details';
import { P5ContextBar } from './RecoveryWorkflowHeader';
import { P5DevControls } from './P5DevControls';
import './p5.css';

export function DecisionMemoryView() {
  const p5 = useP5Store((s) => s.p5);
  const w = useP5World();

  // Filters state
  const [strategy, setStrategy] = useState<string>('');
  const [incidentType, setIncidentType] = useState<string>('');
  const [ingredientId, setIngredientId] = useState<string>('');
  const [outcomeStatus, setOutcomeStatus] = useState<string>('');
  const [verificationLevel, setVerificationLevel] = useState<string>('');
  const [query, setQuery] = useState<string>('');

  const [selectedEntry, setSelectedEntry] = useState<DecisionMemoryEntry | null>(null);

  const successCount = selectSuccessfulCaseCount({ p5 } as any);
  const totalCount = p5.decisionMemory.length;

  const entries = selectDecisionMemory({ p5 } as any, {
    strategy: (strategy || undefined) as ScenarioStrategy | 'ESCALATED' | undefined,
    incidentType: incidentType || undefined,
    ingredientId: ingredientId || undefined,
    outcomeStatus: (outcomeStatus || undefined) as OutcomeStatus | undefined,
    verificationLevel: (verificationLevel || undefined) as VerificationLevel | undefined,
    query: query || undefined,
  });

  const idStrat = useId();
  const idType = useId();
  const idIng = useId();
  const idStatus = useId();
  const idVerif = useId();
  const idSearch = useId();

  return (
    <div className="p5" data-testid="p5-decision-memory-view">
      <P5DevControls />
      {!w.wired && <NotWiredNotice />}
      <P5ContextBar />

      {p5.decisionMemory.length > 0 && (
        <section className="p5-stack" aria-label="Case cards" data-testid="p5-case-cards">
          {[...p5.decisionMemory].reverse().map((entry) => (
            <CaseCard key={entry.id} entry={entry} approvals={p5.approvals} onOpen={() => setSelectedEntry(entry)} />
          ))}
        </section>
      )}

      {/* Header counts */}
      <DataPanel className="p5-card p5-stack" aria-label="Decision memory summary">
        <div className="p5-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Decision Memory</h2>
          <span className="p5-badge fm-badge p5-badge--sim">Organizational Learnings</span>
        </div>
        <div className="p5-kpi-grid">
          <div className="p5-kpi-card p5-kpi-card--verified">
            <span className="p5-kpi-lbl">Simulated successful recoveries (demo evidence)</span>
            <span className="p5-kpi-val">
              <strong className="p5-mono" data-testid="p5-success-count">
                {successCount}
              </strong>
            </span>
          </div>
          <div className="p5-kpi-card p5-kpi-card--approved">
            <span className="p5-kpi-lbl">Total cases</span>
            <span className="p5-kpi-val">
              <strong className="p5-mono" data-testid="p5-total-count">
                {totalCount}
              </strong>
            </span>
          </div>
        </div>
        <p className="p5-muted" style={{ fontSize: '12px' }}>
          Reference library of demo recoveries. The success count only includes cases with Simulated Outcome: SUCCESS.
        </p>
      </DataPanel>

      {/* Filter Toolbar */}
      <details className="p5-card p5-filters" open={totalCount >= 5} aria-label="Filters and search">
        <summary>
          Filter and search cases <span className="p5-muted">({entries.length} matching)</span>
        </summary>
        <div className="p5-row" style={{ alignItems: 'flex-end' }}>
          <label htmlFor={idSearch} style={{ flex: '1 1 220px', minWidth: '180px' }}>
            Search (incident, scenario, lessons):
            <input
              id={idSearch}
              type="text"
              placeholder="Filter by keyword..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="p5-search-input"
            />
          </label>

          <label htmlFor={idStrat} style={{ minWidth: '130px' }}>
            Strategy:
            <select
              id={idStrat}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              data-testid="p5-filter-strategy"
            >
              <option value="">All strategies</option>
              <option value="A">Plan A</option>
              <option value="B">Plan B</option>
              <option value="ESCALATED">Escalated</option>
            </select>
          </label>

          <label htmlFor={idType} style={{ minWidth: '130px' }}>
            Incident type:
            <select
              id={idType}
              value={incidentType}
              onChange={(e) => setIncidentType(e.target.value)}
              data-testid="p5-filter-incident-type"
            >
              <option value="">All types</option>
              <option value="UNAVAILABLE">Supplier unavailable</option>
            </select>
          </label>

          <label htmlFor={idIng} style={{ minWidth: '140px' }}>
            Ingredient:
            <select
              id={idIng}
              value={ingredientId}
              onChange={(e) => setIngredientId(e.target.value)}
              data-testid="p5-filter-ingredient"
            >
              <option value="">All ingredients</option>
              <option value="HP-ING-CHICKEN">Chicken</option>
            </select>
          </label>

          <label htmlFor={idStatus} style={{ minWidth: '130px' }}>
            Outcome:
            <select
              id={idStatus}
              value={outcomeStatus}
              onChange={(e) => setOutcomeStatus(e.target.value)}
              data-testid="p5-filter-outcome"
            >
              <option value="">All outcomes</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="FAILED">FAILED</option>
              <option value="UNVERIFIED">UNVERIFIED</option>
            </select>
          </label>

          <label htmlFor={idVerif} style={{ minWidth: '150px' }}>
            Verification:
            <select
              id={idVerif}
              value={verificationLevel}
              onChange={(e) => setVerificationLevel(e.target.value)}
              data-testid="p5-filter-verification"
            >
              <option value="">All levels</option>
              <option value="SIMULATED_VERIFIED">{VERIFICATION_LEVEL_LABELS.SIMULATED_VERIFIED.label}</option>
              <option value="PARTIAL_EVIDENCE">{VERIFICATION_LEVEL_LABELS.PARTIAL_EVIDENCE.label}</option>
              <option value="NO_EVIDENCE">{VERIFICATION_LEVEL_LABELS.NO_EVIDENCE.label}</option>
              <option value="ESCALATED">{VERIFICATION_LEVEL_LABELS.ESCALATED.label}</option>
            </select>
          </label>
        </div>
      </details>

      {/* Case List */}
      <DataPanel className="p5-card p5-stack" aria-label="Decision memory entries">
        <div className="p5-row" style={{ justifyContent: 'space-between' }}>
          <h3>All cases ({entries.length})</h3>
        </div>

        {entries.length === 0 ? (
          <p className="p5-muted" data-testid="p5-empty-memory">
            No cases yet. Complete a recovery and save it from Outcome Verification.
          </p>
        ) : (
          <div className="fm-table-wrap p5-table-wrap" role="region" aria-label="Decision memory cases table" tabIndex={0}>
            <table className="fm-table p5-table" data-testid="p5-memory-table">
              <caption className="p2-sr sr-only">Decision memory cases table</caption>
              <thead>
                <tr>
                  <th scope="col">Incident</th>
                  <th scope="col">Decision</th>
                  <th scope="col">Plan version</th>
                  <th scope="col">Outcome</th>
                  <th scope="col">Proof</th>
                  <th scope="col">Added at</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} data-testid={`p5-memory-row-${entry.id}`}>
                    <th scope="row">
                      <strong className="p5-mono">{entry.incidentId}</strong>
                    </th>
                    <td>
                      <span
                        className={`p5-badge fm-badge ${
                          entry.strategy === 'A'
                            ? 'p5-badge--info'
                            : entry.strategy === 'B'
                            ? 'p5-badge--sim'
                            : 'p5-badge--warn'
                        }`}
                      >
                        {entry.strategy === 'ESCALATED' ? 'Escalated' : `Plan ${entry.strategy}`}
                      </span>
                    </td>
                    <td>
                      <span title={entry.scenarioId}>Version {entry.version}</span>
                    </td>
                    <td>
                      <span
                        className={`p5-badge fm-badge ${
                          entry.outcomeStatus === 'SUCCESS'
                            ? 'fm-badge--success p5-badge--brand'
                            : entry.outcomeStatus === 'FAILED'
                            ? 'fm-badge--danger p5-badge--danger'
                            : 'fm-badge--warning p5-badge--warn'
                        }`}
                        data-testid={`p5-memory-status-${entry.id}`}
                      >
                        Simulated Outcome: {entry.outcomeStatus}
                      </span>
                    </td>
                    <td>
                      <span data-testid={`p5-memory-level-${entry.id}`} title={entry.verificationLevel}>
                        {VERIFICATION_LEVEL_LABELS[entry.verificationLevel].label}
                      </span>
                    </td>
                    <td>
                      <span>{entry.savedAtIso ? demoTime(entry.savedAtIso) : '—'}</span>
                    </td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedEntry(entry)}
                        data-testid={`p5-view-detail-btn-${entry.id}`}
                      >
                        View details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataPanel>

      {/* Detail Dialog */}
      {selectedEntry && (
        <Dialog
          title={`Case detail — ${selectedEntry.strategy === 'ESCALATED' ? 'Escalated' : `Plan ${selectedEntry.strategy}`}`}
          onClose={() => setSelectedEntry(null)}
        >
          <div className="p5-stack" data-testid="p5-memory-detail">
            <p className="p5-muted">Added at {demoTime(selectedEntry.savedAtIso)}</p>

            <div className="p5-row">
              <span
                className={`p5-badge ${
                  selectedEntry.outcomeStatus === 'SUCCESS'
                    ? 'p5-badge--brand'
                    : selectedEntry.outcomeStatus === 'FAILED'
                    ? 'p5-badge--danger'
                    : 'p5-badge--warn'
                }`}
              >
                Simulated Outcome: {selectedEntry.outcomeStatus}
              </span>
              <span className="p5-badge" title={selectedEntry.verificationLevel}>
                {VERIFICATION_LEVEL_LABELS[selectedEntry.verificationLevel].label}
              </span>
              <span className="p5-badge" title={selectedEntry.evidenceQuality}>
                {EVIDENCE_QUALITY_LABELS[selectedEntry.evidenceQuality].label}
              </span>
            </div>

            {/* Predicted vs Actual Summary */}
            <div className="p5-card p5-stack" style={{ background: 'var(--surface-secondary)' }}>
              <h4>Predicted vs Simulated Actual Summary</h4>
              {selectedEntry.predicted ? (
                <div className="p5-stack p5-muted">
                  <div className="p5-row">
                    <span>Predicted cost: <strong>{formatSenAsRM(selectedEntry.predicted.additionalCostSen)}</strong></span>
                    <span>·</span>
                    <span>Predicted purchase: <strong>{formatKgMilli(selectedEntry.predicted.newPurchaseKgMilli)}</strong></span>
                    <span>·</span>
                    <span>Protected portions: <strong>{selectedEntry.predicted.confirmedChickenPortionsProtected}</strong></span>
                  </div>
                  {selectedEntry.actual && (
                    <div className="p5-row" style={{ borderTop: '1px solid var(--border-default)', paddingTop: '8px' }}>
                      {selectedEntry.actual.receivedKgMilli !== undefined && (
                        <span>Actual received: <strong>{formatKgMilli(selectedEntry.actual.receivedKgMilli)}</strong></span>
                      )}
                      {selectedEntry.actual.arrivalLocal && (
                        <span>Actual arrival: <strong>{selectedEntry.actual.arrivalLocal}</strong></span>
                      )}
                      {selectedEntry.actual.landedCostSen !== undefined && (
                        <span>Actual landed cost: <strong>{formatSenAsRM(selectedEntry.actual.landedCostSen)}</strong></span>
                      )}
                      {selectedEntry.actual.producedPortions !== undefined && (
                        <span>Produced portions: <strong>{selectedEntry.actual.producedPortions}</strong></span>
                      )}
                      {selectedEntry.actual.confirmedFulfilled !== undefined && (
                        <span>Fulfilled portions: <strong>{selectedEntry.actual.confirmedFulfilled}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="p5-muted">No prediction associated with escalation case.</p>
              )}
            </div>

            {/* Evidence IDs */}
            <P5Details summary={`Audit details (${selectedEntry.evidenceIds?.length ?? 0} evidence records)`}>
              {selectedEntry.incidentId} · {selectedEntry.scenarioId} v{selectedEntry.version} ·{' '}
              <abbr title={selectedEntry.fingerprint}>{shortFingerprint(selectedEntry.fingerprint)}</abbr>
              {(selectedEntry.evidenceIds ?? []).map((eid) => (
                <div key={eid}>{eid}</div>
              ))}
            </P5Details>

            {/* Lessons Split by Kind */}
            <div className="p5-stack" data-testid="p5-detail-lessons">
              <h4>Facts</h4>
              <ul className="p5-list" data-testid="p5-deterministic-facts">
                {selectedEntry.lessons
                  .filter((l) => l.kind === 'DETERMINISTIC_FACT')
                  .map((l, i) => (
                    <li key={i}>
                      <span className="p5-badge p5-badge--brand" style={{ marginRight: '6px' }} title="DETERMINISTIC_FACT">
                        {LESSON_KIND_LABELS.DETERMINISTIC_FACT.label}
                      </span>
                      <span>{l.text}</span>
                    </li>
                  ))}
              </ul>

              <h4 style={{ marginTop: '8px' }}>Demo interpretations</h4>
              <ul className="p5-list" data-testid="p5-demo-interpretations">
                {selectedEntry.lessons
                  .filter((l) => l.kind === 'DEMO_INTERPRETATION')
                  .map((l, i) => (
                    <li key={i}>
                      <span className="p5-badge p5-badge--warn" style={{ marginRight: '6px' }} title="DEMO_INTERPRETATION">
                        {LESSON_KIND_LABELS.DEMO_INTERPRETATION.label}
                      </span>
                      <span>{l.text}</span>
                    </li>
                  ))}
              </ul>
            </div>

            <div style={{ textAlign: 'right', marginTop: '8px' }}>
              <Button
                variant="primary"
                onClick={() => setSelectedEntry(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

/** Closing-frame case card: what we chose, what we gave up, the owner's reason, and the lesson. */
function CaseCard({ entry, approvals, onOpen }: { entry: DecisionMemoryEntry; approvals: ApprovalRecord[]; onOpen: () => void }) {
  const approval = approvals.find(
    (a) => a.state === 'APPROVED' && a.scenarioId === entry.scenarioId && a.scenarioVersion === entry.version,
  );
  const pred = entry.predicted;
  const tone = entry.outcomeStatus === 'SUCCESS' ? 'success' : entry.outcomeStatus === 'FAILED' ? 'danger' : entry.outcomeStatus === 'PARTIAL' ? 'warn' : 'neutral';
  const lesson = entry.lessons.find((l) => l.kind === 'DEMO_INTERPRETATION' && !/reference case|no outcome evidence/i.test(l.text)) ??
    entry.lessons.find((l) => l.kind === 'DEMO_INTERPRETATION');
  const decision = entry.strategy === 'ESCALATED' ? 'Both plans rejected → Escalated' : `Plan ${entry.strategy}`;
  return (
    <article className={`fm-panel p5-card p5-case-card p5-case-card--${tone}`} data-testid={`p5-case-card-${entry.id}`}>
      <h3>
        Chicken delivery cancelled → {decision} → <span data-testid="p5-case-outcome">Simulated Outcome: {entry.outcomeStatus}</span>
      </h3>
      {pred && (
        <dl className="p5-decision-lines">
          <div>
            <dt>Chose</dt>
            <dd>
              {formatSenAsRM(pred.additionalCostSen)} new spend · {pred.confirmedChickenPortionsProtected} confirmed portions protected
            </dd>
          </div>
          <div className="p5-decision-lines__giveup">
            <dt>Gave up</dt>
            <dd>
              {entry.strategy === 'A'
                ? `${formatSenAsRM(pred.additionalCostSen)} and reliance on a ${formatKgMilli(pred.newPurchaseKgMilli)} delivery arriving on time`
                : pred.forecastChickenPortionsUnmet > 0
                ? `${pred.forecastChickenPortionsUnmet} forecast portions (forecast, not customer orders)`
                : 'No forecast portions'}
            </dd>
          </div>
        </dl>
      )}
      {approval && (
        <p>
          <strong>Owner&apos;s reason:</strong> “{approval.reason}”
        </p>
      )}
      {lesson && (
        <p className="p5-muted">
          <strong>Lesson ({LESSON_KIND_LABELS[lesson.kind].label.toLowerCase()}):</strong> {lesson.text.replace(/^Demo interpretation:\s*/i, '')}
        </p>
      )}
      <div>
        <Button variant="secondary" size="sm" onClick={onOpen}>
          Open case
        </Button>
      </div>
    </article>
  );
}

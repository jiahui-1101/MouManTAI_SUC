import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ERROR_LABELS, approvalRefusal, executionRefusalMany, roleList } from '../labels';
import type { ActionType, DemoRole, P5ErrorCode } from '../p5Contracts';
import { P5Details } from './P5Details';

export interface BlockerView {
  tone: 'danger' | 'warn';
  icon: string;
  headline: string;
  body: string;
  next?: string;
  cta?: { to: string; label: string };
  code: P5ErrorCode;
  detail?: string;
}

/** Prominent, judge-readable blocker. The raw code lives only in Details. */
export function BlockerCard({ view, testId, children }: { view: BlockerView; testId?: string; children?: ReactNode }) {
  return (
    <section
      className={`p5-blocker p5-blocker--${view.tone}`}
      role="alert"
      aria-label={view.headline}
      data-testid={testId ?? 'p5-blocker-card'}
    >
      <div className="p5-blocker__icon" aria-hidden="true">
        {view.icon}
      </div>
      <div className="p5-blocker__body">
        <h2 className="p5-blocker__headline">{view.headline}</h2>
        <p>{view.body}</p>
        {view.next && <p className="p5-blocker__next">{view.next}</p>}
        {children}
        {view.cta && (
          <div className="p5-row" style={{ marginTop: '10px' }}>
            <Link to={view.cta.to} className="fm-btn fm-btn--primary p5-btn p5-btn--primary" data-testid="p5-blocker-cta">
              {view.cta.label}
            </Link>
          </div>
        )}
        <P5Details summary="Details" testId="p5-blocker-details">
          code: {view.code}
          {view.detail ? ` — ${view.detail}` : ''}
        </P5Details>
      </div>
    </section>
  );
}

export interface BlockerContext {
  /** What the blocked action is: approve a plan or run a task. */
  verb: 'approved' | 'executed';
  role: DemoRole;
  actionTypes: readonly ActionType[];
  clock: string | null;
  deadlineLocal: string | null;
  snapshotRevision: number | null;
}

/** Maps a logic-layer blocker to the staged card copy (review §2.2 A2). */
export function blockerView(code: P5ErrorCode, detail: string, ctx: BlockerContext): BlockerView {
  switch (code) {
    case 'DEMO_FORBIDDEN': {
      const refusal =
        ctx.verb === 'approved' ? approvalRefusal(ctx.role, ctx.actionTypes) : executionRefusalMany(ctx.role, ctx.actionTypes);
      return {
        tone: 'danger',
        icon: '🔒',
        headline: refusal.headline,
        body: refusal.why,
        next:
          ctx.verb === 'approved' && refusal.allowedRoles.length
            ? `Allowed: ${roleList(refusal.allowedRoles)}. ${refusal.next}`
            : refusal.next,
        code,
        detail,
      };
    }
    case 'STALE_SCENARIO':
      return {
        tone: 'danger',
        icon: '⟳',
        headline: `The numbers changed — this plan must be recalculated before it can be ${ctx.verb}`,
        body: `Stock or delivery data was updated after this plan was calculated${
          ctx.snapshotRevision !== null ? ` (data is now at version ${ctx.snapshotRevision})` : ''
        }. ${ctx.verb === 'approved' ? 'Signing off now would mean approving old numbers.' : 'Running it now would act on old numbers.'}`,
        cta: { to: '/recovery/compare', label: 'Back to Comparison' },
        code,
        detail,
      };
    case 'APPROVAL_EXPIRED':
      return {
        tone: 'danger',
        icon: '⏱',
        headline: 'Too late for Plan A',
        body: `The ${ctx.deadlineLocal ?? 'prep'} cutoff has passed on the demo clock${ctx.clock ? ` (now ${ctx.clock})` : ''}. A purchase can't be relied on in time.`,
        next: 'Choose Plan B or escalate.',
        cta: { to: '/recovery/compare', label: 'Back to Comparison' },
        code,
        detail,
      };
    default:
      return { tone: 'warn', icon: '!', headline: ERROR_LABELS[code].label, body: ERROR_LABELS[code].explain, code, detail };
  }
}

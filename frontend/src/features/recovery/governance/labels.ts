/**
 * Single source of judge-facing wording for every P5 code.
 *
 * Every map is a `Record<Union, Label>`: adding a code to a union without a label here fails
 * compilation. Raw codes stay available for auditability (Details disclosures / `title`
 * tooltips) but never appear as the primary visible text.
 */
import { canApproveAll, hasCapability } from '../../approvals/permissions';
import type {
  ActionType,
  DemoRole,
  EscalationState,
  EvidenceKind,
  EvidenceQuality,
  ExecutionState,
  ExternalSyncStatus,
  Feasibility,
  Lesson,
  OutcomeReason,
  OutcomeStatus,
  P5ErrorCode,
  VerificationLevel,
} from './p5Contracts';

export interface Label {
  /** Short, plain-language label shown in the main view. */
  label: string;
  /** One-line explanation (tooltip / helper text). */
  explain: string;
}

export const ALL_ROLES: readonly DemoRole[] = ['Owner', 'OperationsManager', 'ProcurementOfficer', 'KitchenLead', 'ViewerAuditor'];

export const ROLE_LABELS: Record<DemoRole, Label> = {
  Owner: { label: 'Owner', explain: 'Can approve any plan and do every task (demo role).' },
  OperationsManager: { label: 'Operations Manager', explain: 'Runs menu limits and prep; can approve prep only (demo role).' },
  ProcurementOfficer: { label: 'Procurement Officer', explain: 'Handles purchase drafts and delivery checks (demo role).' },
  KitchenLead: { label: 'Kitchen Lead', explain: 'Runs prep batches (demo role).' },
  ViewerAuditor: { label: 'Viewer (audit only)', explain: 'Read-only: can see everything, change nothing (demo role).' },
};

export const ERROR_LABELS: Record<P5ErrorCode, Label> = {
  SCENARIO_NOT_READY: { label: 'Plan not ready yet', explain: 'The plan owner has not published this plan yet.' },
  FINGERPRINT_MISMATCH: {
    label: 'Plans used different data',
    explain: 'Plan A and Plan B were calculated on different data versions; both must be recalculated.',
  },
  STALE_SCENARIO: {
    label: 'The numbers changed',
    explain: 'Stock or delivery data changed after this plan was calculated; it must be recalculated first.',
  },
  SCENARIO_INFEASIBLE: {
    label: "Plan can't be chosen",
    explain: "This plan can't be chosen — it isn't feasible with the current numbers.",
  },
  DEMO_FORBIDDEN: { label: 'Not allowed for this role', explain: 'The current demo role is not allowed to do this.' },
  DUPLICATE_REQUEST: { label: 'Already recorded', explain: 'This request was already recorded.' },
  APPROVAL_EXPIRED: {
    label: 'Too late on the demo clock',
    explain: 'The time window for this plan has passed on the demo clock.',
  },
  NO_SELECTION: { label: 'No plan chosen', explain: 'Choose a plan on Recovery Comparison first.' },
  MISSING_REASON: { label: 'Reason needed', explain: 'A reason is required.' },
  INVALID_TRANSITION: { label: 'Step not available', explain: 'This step is not allowed from the current state.' },
  PLAN_B_PURCHASE_FORBIDDEN: { label: 'Plan B cannot buy', explain: 'Plan B must not include a purchase.' },
  NOT_FOUND: { label: 'Not found', explain: 'The record could not be found.' },
  INVALID_EVIDENCE: { label: 'Evidence incomplete', explain: 'The evidence is incomplete or invalid.' },
};

export const EXECUTION_STATE_LABELS: Record<ExecutionState, Label> = {
  DRAFT: { label: 'Draft', explain: 'Not yet approved.' },
  APPROVED: { label: 'Ready to start', explain: 'Approved, not started yet.' },
  SIMULATED_EXECUTION: { label: 'In progress (simulated)', explain: 'Started in the demo; nothing is sent outside the app.' },
  AWAITING_EVIDENCE: { label: 'Done — needs proof', explain: 'Simulated step finished; evidence is checked on Outcomes.' },
  VERIFIED: { label: 'Proven by evidence', explain: 'Evidence recorded and checked on Outcomes.' },
};

export const SYNC_STATUS_LABELS: Record<ExternalSyncStatus, Label> = {
  AWAITING_MANUAL_UPDATE: {
    label: 'Waiting for staff to update the POS by hand',
    explain: 'Nothing is sent to any POS automatically.',
  },
  MANUALLY_CONFIRMED_DEMO: { label: 'Staff confirmed the change (demo)', explain: 'Confirmed by demo evidence, entered by hand.' },
  SIMULATED_LOCAL_ONLY: { label: 'Stays inside the demo', explain: 'Nothing was sent outside the app.' },
};

export const ACTION_TYPE_LABELS: Record<ActionType, Label> = {
  PO_DRAFT: { label: 'Purchase order draft', explain: 'A local draft only — never sent to any supplier.' },
  RECEIPT_CHECK: { label: 'Delivery check', explain: 'Check the replacement delivery arrives on time and passes quality.' },
  MENU_LIMIT_TASK: { label: 'Menu limit', explain: 'Limit an item on today’s menu; staff update the POS by hand.' },
  PREP_BATCH_TASK: { label: 'Prep batch', explain: 'Kitchen prepares a planned batch of portions.' },
};

/** Why approving / running this action type is restricted (used by refusal cards). */
const ACTION_RISK: Record<ActionType, string> = {
  PO_DRAFT: 'it commits new spend with a supplier',
  RECEIPT_CHECK: 'it accepts food into stock',
  MENU_LIMIT_TASK: 'it changes what customers can order today',
  PREP_BATCH_TASK: 'it changes kitchen prep',
};

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, Label> = {
  RECEIPT: { label: 'Delivery receipt', explain: 'What arrived, when, and whether it passed the quality check.' },
  PREP: { label: 'Prep batch result', explain: 'Portions the kitchen actually produced for a batch.' },
  MENU_UPDATE: { label: 'Menu limit confirmation', explain: 'Staff confirmed the menu limit is live.' },
  ORDER_FULFILMENT: { label: 'Confirmed orders fulfilled', explain: 'How many confirmed customer portions were served.' },
};

export const OUTCOME_STATUS_LABELS: Record<OutcomeStatus, Label> = {
  UNVERIFIED: { label: 'UNVERIFIED', explain: 'No proof yet — not a success until the evidence says so.' },
  PARTIAL: { label: 'PARTIAL', explain: 'Some checks passed, some evidence is still missing or below plan.' },
  FAILED: { label: 'FAILED', explain: 'A hard requirement failed on the recorded evidence.' },
  SUCCESS: { label: 'SUCCESS', explain: 'All required checks passed on demo evidence.' },
};

export const FEASIBILITY_LABELS: Record<Feasibility, Label> = {
  CONDITIONAL: { label: 'Conditional — depends on supplier delivery', explain: 'Holds only if the delivery arrives on time and passes checks.' },
  FEASIBLE: { label: 'Feasible with current stock', explain: 'Works within the demo’s synthetic assumptions.' },
  INFEASIBLE: { label: 'Not feasible', explain: 'The plan owner reports this plan cannot be carried out.' },
  UNKNOWN: { label: 'Feasibility unknown', explain: 'The plan owner could not determine feasibility.' },
};

export const VERIFICATION_LEVEL_LABELS: Record<VerificationLevel, Label> = {
  SIMULATED_VERIFIED: { label: 'Proof complete (simulated)', explain: 'All required demo evidence recorded and passing.' },
  PARTIAL_EVIDENCE: { label: 'Some proof', explain: 'Some demo evidence recorded.' },
  NO_EVIDENCE: { label: 'No proof yet', explain: 'No evidence recorded.' },
  ESCALATED: { label: 'Escalated', explain: 'Both plans were rejected; nothing executed.' },
};

export const EVIDENCE_QUALITY_LABELS: Record<EvidenceQuality, Label> = {
  NONE: { label: 'No evidence', explain: 'Nothing recorded.' },
  PARTIAL: { label: 'Partial evidence', explain: 'Some required items are missing.' },
  COMPLETE: { label: 'Complete evidence', explain: 'Every required item recorded.' },
};

export const ESCALATION_LABELS: Record<EscalationState, Label> = {
  NONE: { label: 'Not escalated', explain: 'Normal decision flow.' },
  ESCALATED: { label: 'Escalated', explain: 'Both plans rejected; no plan will execute until recalculated.' },
};

export const LESSON_KIND_LABELS: Record<Lesson['kind'], Label> = {
  DETERMINISTIC_FACT: { label: 'Fact', explain: 'Taken directly from recorded data.' },
  DEMO_INTERPRETATION: { label: 'Demo interpretation', explain: 'A reading of this demo case, not a measured fact.' },
};

export type TruthLabel = 'SIMULATED_CALCULATION' | 'SYNTHETIC_BUSINESS' | 'SIMULATED_ACTION' | 'SIMULATED_EVIDENCE';
export const TRUTH_LABELS: Record<TruthLabel, Label> = {
  SIMULATED_CALCULATION: { label: 'Simulated', explain: 'Demo calculation — not an optimiser and not production data.' },
  SYNTHETIC_BUSINESS: { label: 'Happy Potato · demo data', explain: 'Synthetic restaurant, orders, stock and menu.' },
  SIMULATED_ACTION: { label: 'Simulated action', explain: 'Local only — no supplier, POS or kitchen system is contacted.' },
  SIMULATED_EVIDENCE: { label: 'Demo evidence', explain: 'Entered in the demo — not real operational proof.' },
};

/** Outcome reason codes are `PREFIX` or `PREFIX:argument`. */
export type ReasonCodePrefix =
  | 'NO_EVIDENCE'
  | 'RECEIPT_REJECTED'
  | 'RECEIPT_LATE'
  | 'PASS_RECEIPT'
  | 'CONFIRMED_ORDERS_UNMET'
  | 'PASS_FULFILMENT'
  | 'MISSING_RECEIPT'
  | 'MISSING_PREP'
  | 'SHORTFALL_PREP'
  | 'PASS_PREP'
  | 'MISSING_MENU_UPDATE'
  | 'MENU_NOT_APPLIED'
  | 'PASS_MENU_UPDATE'
  | 'MISSING_ORDER_FULFILMENT';

export interface ReasonContext {
  /** Menu display name resolver (from data). */
  menuName: (menuId: string) => string;
  /** Human batch label, e.g. "Prep batch 1 of 4". */
  batchLabel: (batchId: string) => string;
}

type ReasonFormatter = (arg: string, text: string, ctx: ReasonContext) => string;

/** Extracts "x of y" / "x/y" numbers from the logic-layer text (never invented). */
const numbers = (text: string): string => {
  const m = text.match(/(\d+)\s*(?:of|\/)\s*(\d+)/);
  return m ? `${m[1]} of ${m[2]}` : '';
};

export const REASON_LABELS: Record<ReasonCodePrefix, ReasonFormatter> = {
  NO_EVIDENCE: () => 'No evidence recorded yet',
  RECEIPT_REJECTED: () => 'Delivery was rejected at the quality check',
  RECEIPT_LATE: (arg, text) => {
    const cutoff = text.match(/after (\d{2}:\d{2})/)?.[1];
    return cutoff ? `Chicken arrived ${arg} — after the ${cutoff} cutoff` : `Chicken arrived ${arg} — after the cutoff`;
  },
  PASS_RECEIPT: (_a, text) => {
    const m = text.match(/received ([\d.]+kg) accepted at (\d{2}:\d{2})/);
    return m ? `Delivery received: ${m[1]}, accepted at ${m[2]}` : 'Delivery received and accepted on time';
  },
  CONFIRMED_ORDERS_UNMET: (arg) => `Confirmed orders: only ${arg.replace('/', ' of ')} portions served`,
  PASS_FULFILMENT: (_a, text) => `Confirmed orders: ${numbers(text)} portions served`,
  MISSING_RECEIPT: () => 'Delivery receipt not recorded yet',
  MISSING_PREP: (arg, _t, ctx) => `${ctx.batchLabel(arg)}: not confirmed yet`,
  SHORTFALL_PREP: (arg, text, ctx) => `${ctx.batchLabel(arg)}: only ${numbers(text)} portions produced`,
  PASS_PREP: (arg, text, ctx) => `${ctx.batchLabel(arg)}: ${numbers(text)} portions produced`,
  MISSING_MENU_UPDATE: (arg, _t, ctx) => `Menu limit for ${ctx.menuName(arg)}: not confirmed yet`,
  MENU_NOT_APPLIED: (arg, _t, ctx) => `Menu limit for ${ctx.menuName(arg)}: staff say it is not live yet`,
  PASS_MENU_UPDATE: (arg, _t, ctx) => `Menu limit for ${ctx.menuName(arg)}: confirmed live`,
  MISSING_ORDER_FULFILMENT: () => 'Confirmed orders served: not recorded yet',
};

const isReasonPrefix = (p: string): p is ReasonCodePrefix => p in REASON_LABELS;

/** Human sentence for an outcome reason. The raw code stays available for a tooltip. */
export function describeReason(reason: OutcomeReason, ctx: ReasonContext): string {
  const idx = reason.code.indexOf(':');
  const prefix = idx === -1 ? reason.code : reason.code.slice(0, idx);
  const arg = idx === -1 ? '' : reason.code.slice(idx + 1);
  if (!isReasonPrefix(prefix)) return reason.text.replace(/^[A-Z_]+:\s*/, '');
  return REASON_LABELS[prefix](arg, reason.text, ctx);
}

/** Human sentence for a missing-evidence key (`RECEIPT`, `PREP:<batch>`, `MENU_UPDATE:<menu>`, `ORDER_FULFILMENT`). */
export function describeMissing(key: string, ctx: ReasonContext): string {
  if (key === 'RECEIPT') return REASON_LABELS.MISSING_RECEIPT('', '', ctx);
  if (key === 'ORDER_FULFILMENT') return REASON_LABELS.MISSING_ORDER_FULFILMENT('', '', ctx);
  if (key.startsWith('PREP:')) return REASON_LABELS.MISSING_PREP(key.slice(5), '', ctx);
  if (key.startsWith('MENU_UPDATE:')) return REASON_LABELS.MISSING_MENU_UPDATE(key.slice(12), '', ctx);
  return key;
}

export const roleLabel = (r: DemoRole): string => ROLE_LABELS[r].label;
export const roleList = (roles: readonly DemoRole[]): string => {
  const names = roles.map(roleLabel);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
};

export interface RoleRefusal {
  headline: string;
  why: string;
  allowedRoles: DemoRole[];
  next: string;
}

/** Judge-facing refusal for approving a whole plan. */
export function approvalRefusal(role: DemoRole, actionTypes: readonly ActionType[]): RoleRefusal {
  const allowed = ALL_ROLES.filter((r) => canApproveAll(r, actionTypes));
  const blocked = actionTypes.filter((t) => !hasCapability(role, { kind: 'APPROVE', actionType: t }));
  const risks = [...new Set(blocked.map((t) => ACTION_RISK[t]))];
  return {
    headline:
      allowed.length === 1 ? `Only the ${roleLabel(allowed[0]!)} can approve this plan` : `${roleLabel(role)} can't approve this plan`,
    why:
      role === 'ViewerAuditor'
        ? 'The viewer role is read-only.'
        : `${roleLabel(role)} can't sign this off because ${risks.join(' and ')}.`,
    allowedRoles: allowed,
    next: allowed.length ? `Switch to ${roleList(allowed)} to continue.` : 'No demo role can approve this plan.',
  };
}

/** Judge-facing refusal for running one task. */
export function executionRefusal(role: DemoRole, actionType: ActionType): RoleRefusal {
  const allowed = ALL_ROLES.filter((r) => hasCapability(r, { kind: 'EXECUTE', actionType }));
  return {
    headline: `Only ${roleList(allowed)} can do this ${ACTION_TYPE_LABELS[actionType].label.toLowerCase()}`,
    why:
      role === 'ViewerAuditor'
        ? 'The viewer role is read-only.'
        : `${roleLabel(role)} can't do this because ${ACTION_RISK[actionType]}.`,
    allowedRoles: allowed,
    next: `Switch to ${roleList(allowed)} to continue.`,
  };
}

/** "Prep batch 2 of 4" from the ordered batch IDs of a plan; falls back to the raw ID. */
export function batchLabelFrom(batchIds: readonly string[]): (batchId: string) => string {
  return (batchId) => {
    const i = batchIds.indexOf(batchId);
    return i >= 0 ? `Prep batch ${i + 1} of ${batchIds.length}` : `Prep batch ${batchId}`;
  };
}

/** Reason context from data: menu names via the deps resolver, batch order from the tasks/actions. */
export function reasonContext(
  resolveMenu: ((menuId: string) => string) | undefined,
  items: readonly { actionType: ActionType; targetId?: string }[],
): ReasonContext {
  const batches = items.filter((a) => a.actionType === 'PREP_BATCH_TASK' && a.targetId).map((a) => a.targetId as string);
  return { menuName: (id) => resolveMenu?.(id) ?? id, batchLabel: batchLabelFrom(batches) };
}

/** "09:00 (demo clock)" from an ISO audit stamp. */
export const demoTime = (iso: string): string => `${iso.slice(11, 16)} (demo clock)`;

/** Judge-facing refusal when the current role can do none of the remaining tasks (several task types). */
export function executionRefusalMany(role: DemoRole, actionTypes: readonly ActionType[]): RoleRefusal {
  const types = [...new Set(actionTypes)];
  if (types.length === 1) return executionRefusal(role, types[0]!);
  const perType = types.map((t) => {
    const allowed = ALL_ROLES.filter((r) => hasCapability(r, { kind: 'EXECUTE', actionType: t }));
    return { t, allowed };
  });
  const union = ALL_ROLES.filter((r) => perType.some((p) => p.allowed.includes(r)));
  return {
    headline: `${roleLabel(role)} can't do any of the remaining tasks`,
    why:
      role === 'ViewerAuditor'
        ? 'The viewer role is read-only.'
        : `${roleLabel(role)} can't run these because ${[...new Set(types.map((t) => ACTION_RISK[t]))].join(' and ')}.`,
    allowedRoles: union,
    next: perType.map((p) => `${plural(ACTION_TYPE_LABELS[p.t].label)}: ${roleList(p.allowed)}`).join(' · '),
  };
}

const plural = (label: string): string => (/(ch|sh|s|x)$/.test(label) ? `${label}es` : `${label}s`);

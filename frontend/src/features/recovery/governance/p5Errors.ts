import type { P5ErrorCode } from './p5Contracts';

const MESSAGES: Record<P5ErrorCode, string> = {
  SCENARIO_NOT_READY: 'This plan has not been published yet.',
  FINGERPRINT_MISMATCH: 'Plans were calculated on different snapshots. Recalculation is required.',
  STALE_SCENARIO: 'STALE — the snapshot changed after this plan was calculated. Recalculation required.',
  DEMO_FORBIDDEN: 'The current demo role is not allowed to do this.',
  DUPLICATE_REQUEST: 'This request was already recorded.',
  APPROVAL_EXPIRED: 'Approval window has passed on the demo clock (Plan A prep cutoff 10:45).',
  NO_SELECTION: 'No plan selected.',
  MISSING_REASON: 'A reason is required.',
  INVALID_TRANSITION: 'This step is not allowed from the current state.',
  PLAN_B_PURCHASE_FORBIDDEN: 'Plan B must not include a purchase.',
  NOT_FOUND: 'Record not found.',
  INVALID_EVIDENCE: 'Evidence is incomplete or invalid.',
};

/** Errors the UI may swallow silently (idempotent repeats). */
export const BENIGN_ERRORS: ReadonlySet<P5ErrorCode> = new Set(['DUPLICATE_REQUEST']);

/** User-facing message; appends the logic-layer detail for role errors so the blocked actions are named. */
export function p5ErrorMessage(code: P5ErrorCode, detail?: string): string {
  if (code === 'DEMO_FORBIDDEN' && detail) return `${MESSAGES[code]} ${detail}`;
  return MESSAGES[code];
}

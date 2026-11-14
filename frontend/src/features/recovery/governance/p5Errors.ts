import { ERROR_LABELS } from './labels';
import type { P5ErrorCode } from './p5Contracts';

/** Errors the UI may swallow silently (idempotent repeats). */
export const BENIGN_ERRORS: ReadonlySet<P5ErrorCode> = new Set(['DUPLICATE_REQUEST']);

/**
 * User-facing message, from the single label source (labels.ts). The raw code is never part of
 * the message; show it only in a Details disclosure or tooltip.
 */
export function p5ErrorMessage(code: P5ErrorCode, _detail?: string): string {
  const l = ERROR_LABELS[code];
  return `${l.label}. ${l.explain}`;
}

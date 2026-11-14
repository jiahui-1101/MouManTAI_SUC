import type { ActionType, EvidenceKind } from '../recovery/governance/p5Contracts';

/** FNV-1a 32-bit, hex. Deterministic short hash for IDs (not a security digest). */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const approvalKey = (scenarioId: string, version: number, fingerprint: string): string =>
  `${scenarioId}:${version}:${fingerprint}:APPROVE`;

export const rejectionKey = (scenarioId: string, version: number, fingerprint: string): string =>
  `${scenarioId}:${version}:${fingerprint}:REJECT`;

export const approvalIdFromKey = (key: string): string => `P5-APR-${fnv1a(key)}`;

export const taskKey = (approvalId: string, actionType: ActionType, targetId?: string): string =>
  targetId ? `${approvalId}:${actionType}:${targetId}` : `${approvalId}:${actionType}`;

export const actionIdFromKey = (key: string): string => `P5-ACT-${fnv1a(key)}`;

export const evidenceId = (actionId: string, kind: EvidenceKind, revision: number): string =>
  `P5-EVD-${actionId}-${kind}-r${revision}`;

export const decisionMemoryKey = (incidentId: string, scenarioId: string, version: number): string =>
  `${incidentId}:${scenarioId}:${version}`;

export const decisionMemoryId = (key: string): string => `P5-MEM-${fnv1a(key)}`;

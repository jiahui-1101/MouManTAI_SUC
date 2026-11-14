import type { ActionType, DemoRole, EvidenceKind } from '../recovery/governance/p5Contracts';

export type Capability =
  | { kind: 'APPROVE'; actionType: ActionType }
  | { kind: 'EXECUTE'; actionType: ActionType }
  | { kind: 'RECORD_EVIDENCE'; evidenceKind: EvidenceKind };

interface RolePermissions {
  APPROVE: readonly ActionType[];
  EXECUTE: readonly ActionType[];
  RECORD_EVIDENCE: readonly EvidenceKind[];
}

const ALL_ACTIONS: readonly ActionType[] = ['PO_DRAFT', 'RECEIPT_CHECK', 'MENU_LIMIT_TASK', 'PREP_BATCH_TASK'];

export const PERMISSION_MATRIX: Readonly<Record<DemoRole, RolePermissions>> = {
  Owner: {
    APPROVE: ALL_ACTIONS,
    EXECUTE: ALL_ACTIONS,
    RECORD_EVIDENCE: ['RECEIPT', 'MENU_UPDATE', 'PREP', 'ORDER_FULFILMENT'],
  },
  OperationsManager: {
    APPROVE: ['PREP_BATCH_TASK'],
    EXECUTE: ['MENU_LIMIT_TASK', 'PREP_BATCH_TASK'],
    RECORD_EVIDENCE: ['MENU_UPDATE', 'PREP', 'ORDER_FULFILMENT'],
  },
  ProcurementOfficer: { APPROVE: [], EXECUTE: ['PO_DRAFT', 'RECEIPT_CHECK'], RECORD_EVIDENCE: ['RECEIPT'] },
  KitchenLead: { APPROVE: [], EXECUTE: ['PREP_BATCH_TASK'], RECORD_EVIDENCE: ['PREP'] },
  ViewerAuditor: { APPROVE: [], EXECUTE: [], RECORD_EVIDENCE: [] },
};

export function hasCapability(role: DemoRole, cap: Capability): boolean {
  const perms = PERMISSION_MATRIX[role];
  switch (cap.kind) {
    case 'APPROVE':
      return perms.APPROVE.includes(cap.actionType);
    case 'EXECUTE':
      return perms.EXECUTE.includes(cap.actionType);
    case 'RECORD_EVIDENCE':
      return perms.RECORD_EVIDENCE.includes(cap.evidenceKind);
  }
}

/** True only if the role may approve EVERY action type. An empty list is never approvable. */
export function canApproveAll(role: DemoRole, actionTypes: readonly ActionType[]): boolean {
  if (actionTypes.length === 0) return false;
  return actionTypes.every((actionType) => hasCapability(role, { kind: 'APPROVE', actionType }));
}

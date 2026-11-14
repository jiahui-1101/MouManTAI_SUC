import { describe, expect, it } from 'vitest';
import { devScenarioA, devScenarioB } from '../../__dev__/mockScenarios';
import { approvedActionTypesOf } from './approvalLogic';
import { canApproveAll, hasCapability, PERMISSION_MATRIX } from './permissions';
import type { DemoRole } from '../recovery/governance/p5Contracts';

const A = approvedActionTypesOf(devScenarioA());
const B = approvedActionTypesOf(devScenarioB());

describe('permissions', () => {
  it('Owner approves A and B', () => {
    expect(canApproveAll('Owner', A)).toBe(true);
    expect(canApproveAll('Owner', B)).toBe(true);
  });

  it('OperationsManager is blocked on A and on B (MENU_LIMIT_TASK)', () => {
    expect(hasCapability('OperationsManager', { kind: 'APPROVE', actionType: 'PREP_BATCH_TASK' })).toBe(true);
    expect(hasCapability('OperationsManager', { kind: 'APPROVE', actionType: 'MENU_LIMIT_TASK' })).toBe(false);
    expect(canApproveAll('OperationsManager', B)).toBe(false);
    expect(canApproveAll('OperationsManager', A)).toBe(false);
  });

  it('P5-T06: ViewerAuditor is blocked on everything', () => {
    const p = PERMISSION_MATRIX.ViewerAuditor;
    expect(p.APPROVE).toHaveLength(0);
    expect(p.EXECUTE).toHaveLength(0);
    expect(p.RECORD_EVIDENCE).toHaveLength(0);
    expect(canApproveAll('ViewerAuditor', A)).toBe(false);
    expect(canApproveAll('ViewerAuditor', B)).toBe(false);
  });

  it('KitchenLead can record PREP but not RECEIPT', () => {
    expect(hasCapability('KitchenLead', { kind: 'RECORD_EVIDENCE', evidenceKind: 'PREP' })).toBe(true);
    expect(hasCapability('KitchenLead', { kind: 'RECORD_EVIDENCE', evidenceKind: 'RECEIPT' })).toBe(false);
  });

  it('only Owner can approve either full plan', () => {
    const roles: DemoRole[] = ['OperationsManager', 'ProcurementOfficer', 'KitchenLead', 'ViewerAuditor'];
    for (const r of roles) {
      expect(canApproveAll(r, A)).toBe(false);
      expect(canApproveAll(r, B)).toBe(false);
    }
  });

  it('empty action list is never approvable', () => {
    expect(canApproveAll('Owner', [])).toBe(false);
  });
});

# Happy Potato Demo Runbook: P5 Recovery Governance & Decision Memory

This runbook is the definitive operator script for running and pitching P5 (`/recovery/compare`, `/approvals`, `/execution`, `/outcomes`, `/decision-memory`) during the hackathon live demonstration.

---

## 1. Operating Modes & Switching

P5 supports dual-mode operation to guarantee hackathon resilience:

| Mode | Environment Variable | State Source | Use Case |
|---|---|---|---|
| **Standalone Fallback Mode** | `VITE_P5_DEV_MOCKS=true` | `frontend/src/__dev__/p5MockWorld.ts` | **Hackathon Safe Mode**: completely self-contained; zero dependency on teammate branch progress. Dev Controls available. |
| **Integrated Mode** | `VITE_P5_DEV_MOCKS=false` | Integration Lead's central Zustand store via `p5RootAdapter.ts` | **Production Demo Mode**: synchronized end-to-end with P1 (messages), P2 (impact), P3 (Plan A), and P4 (Plan B). |

### How to Toggle
In `frontend/.env` (or via terminal before running Vite):
```bash
# Standalone Fallback Mode (Default during isolated testing & rehearsals)
VITE_P5_DEV_MOCKS=true

# Integrated Mode (When central demoStore is wired)
VITE_P5_DEV_MOCKS=false
```
Then start the Vite dev server:
```bash
cd frontend
npm run dev
```

---

## 2. Live Pitch Rehearsal Paths

### Path 1: The Canonical Happy Path (Plan B Internal Recovery)
> **Pitch Narrative**: "When Chicken Supplier A drops out with a 20kg shortage, rather than blindly rushing to buy expensive alternative chicken, Happy Potato's governance loop selects internal recovery: zero external cost, protecting 100% of confirmed orders, and simulating execution with strict verification."

1. **Navigate to `/recovery/compare`**:
   - Point out the Impact Header: PO Shortfall is **20kg** (from `HP-PO-1042`), but Demand Gap is only **12kg** (not 20kg).
   - Point out the comparison table:
     - **Plan A**: RM255.00 purchase, 150 conditional portions served, `CONDITIONAL` feasibility.
     - **Plan B**: RM0.00 new purchase, 72 portions planned, 60 confirmed portions protected, 78 forecast portions unmet (explicitly forecast unmet, **zero confirmed orders breached**).
   - Click **`Choose Plan B`**.
   - Note green banner: `"Selected Plan B — No new purchases. Proceed to Approvals to review and approve."` Click **`Go to Approvals →`**.

2. **Navigate to `/approvals`**:
   - Verify active selection: `HP-SC-B-001 v1`.
   - Review Scope: 3 Menu Limit Tasks (`HP-MENU-CP`, `HP-MENU-CT`, `HP-MENU-HC`) and 4 Prep Batches (`HP-BATCH-B-01` to `04`).
   - Notice the approval disclaimer: `External effects: none — simulation only.`
   - In **Approval reason**, type: `Protect all 60 confirmed orders; allocate remaining stock to Happy Combo`.
   - Click **`Approve`** → in modal, click **`Confirm approval`**.
   - Note confirmation banner and click **`Go to Execution Tracker →`**.

3. **Navigate to `/execution`**:
   - Header shows: `SIMULATED_ACTION` badge: *"Simulation only — no supplier, POS or kitchen system is contacted"*.
   - Task list displays 7 tasks in state `APPROVED`:
     - 3 Menu Limit Tasks with badge `Awaiting manual update — not synced to any POS`.
     - 4 Prep Batch Tasks with batch IDs and portion targets.
   - Advance task steps: Click **`Simulate next step`** on `HP-MENU-CP` limit task, enter reason: `Updated POS display limits in store terminal`, click **`Advance step`**.
   - Note task state advances to `SIMULATED_EXECUTION`, and then to `AWAITING_EVIDENCE`.
   - (For demo speed): Open **DEV CONTROLS** at top, click **`Seed: B Complete`**.
   - Click **`Record evidence →`** on any task (or navigate to `/outcomes`).

4. **Navigate to `/outcomes`**:
   - Point out initial state: `Simulated Outcome: UNVERIFIED` (honest default; never presumes success).
   - Review Predicted vs Actual Table:
     - Plan B predicted (0kg, RM0.00, 72 portions, 60 confirmed).
     - Actuals show `SIMULATED_EVIDENCE` badges with revision IDs (`rev 1`).
     - Food waste shows measured or `UNKNOWN` (never 0kg or RM0).
   - Click **`Verify simulated outcome`**.
   - Outcome badge turns green: `Simulated Outcome: SUCCESS`.
   - Point out the truth caveat: `Demo evidence only — not real Happy Potato operations`.
   - Click **`Save to Decision Memory`**. Click **`View in Decision Memory →`**.

5. **Navigate to `/decision-memory`**:
   - Header shows: `Successful Outcomes: 1`, `Total Decisions: 1`.
   - Click **`View details`** on `HP-INC-001`:
     - Show **Deterministic Facts**: e.g. `Plan B protected 60 confirmed portions with 0kg new purchase`.
     - Show **Demo Interpretation**: labelled context explaining the owner's policy choice.

---

### Path 2: Safety Interception & Staleness Detection
> **Pitch Narrative**: "Governance must intercept invalid plans in real time. If inventory shifts or a delivery window expires, P5 immediately blocks approvals and execution."

1. **Stale Snapshot Detection**:
   - Navigate to `/recovery/compare` and select **Plan B**.
   - Open **DEV CONTROLS** and click **`Change snapshot fingerprint`** (simulates inventory revision or supplier stock adjustment from P2).
   - In `/recovery/compare`: Card immediately marks plan as `STALE_SCENARIO`.
   - Navigate to `/approvals`: Banner shows: `Approval is stale: Snapshot changed since proposal. Re-calculation and re-approval required.`
   - The **Approve** button is disabled with visible error explanation.

2. **Plan A Cutoff Expiry (10:45 MYT)**:
   - Reset P5 via Dev Controls. Select **Plan A** on `/recovery/compare`.
   - In Dev Controls, click **`Set clock 10:50`** (advances demo clock past 10:45 prep cutoff).
   - Navigate to `/approvals`: Red blocker shows: `APPROVAL_EXPIRED: Plan A cannot be approved after 10:45 prep cutoff`.
   - Navigate to `/outcomes` with Seed `A Late (11:00)`: Outcome status verifies as `FAILED` with `RECEIPT_LATE: arrival 11:00 after 10:45 cutoff`.

---

### Path 3: Role-Based Access Governance (RBAC)
> **Pitch Narrative**: "Not everyone in the store can approve commercial contracts or commit capital. P5 enforces strict separation of duties."

1. **Viewer/Auditor Read-Only Lockdown**:
   - Navigate to `/approvals` with an active plan selected.
   - Use the **Demo Role Switcher** at the top: Switch role from `Owner` to `ViewerAuditor`.
   - Notice:
     - **Approve**, **Reject**, and **Escalate** buttons are immediately disabled.
     - Text explains: `ViewerAuditor is read-only.`
   - Navigate to `/outcomes`: Evidence input forms are disabled with warning: `Current role (ViewerAuditor) is read-only. Allowed: Owner, OperationsManager, KitchenLead`.

2. **OperationsManager Authority Limits**:
   - Switch role to `OperationsManager`.
   - Navigate to `/approvals` with **Plan A** selected (which has RM255.00 external purchase).
   - The Approve button is disabled: `DEMO_FORBIDDEN: OperationsManager cannot approve PO_DRAFT, RECEIPT_CHECK. External purchase requires Owner authority.`
   - Switch selection to **Plan B** (0kg purchase, internal prep only): OperationsManager can proceed.

---

## 3. 10-Minute Integration Lead Wiring Guide

When the Integration Lead merges the root Zustand store (`demoStore.ts`), wire P5 into the application in 3 steps:

### Step 1: Wrap P5 with the Root Adapter
In `frontend/src/app/App.tsx` (or your root router layout):
```tsx
import { P5RuntimeProvider } from '../features/recovery/governance/p5Store';
import { useRootDemoStore } from '../shared/stores/demoStore'; // Root Zustand store

export function App() {
  const rootStore = useRootDemoStore;

  return (
    <P5RuntimeProvider rootStore={rootStore}>
      {/* Existing application routes */}
      <Outlet />
    </P5RuntimeProvider>
  );
}
```

### Step 2: Ensure Root Store Satisfies `RootStoreContract`
`p5RootAdapter.ts` expects the root store state to provide:
```ts
interface RootStoreContract {
  snapshot: {
    id: string;
    revision: number;
    fingerprint: string;
    demoBusinessDate: string;
    menuItems?: Array<{ id: string; name: string }>;
  };
  scenarios: {
    A?: RecoveryScenarioWithActions | null;
    B?: RecoveryScenarioWithActions | null;
  };
  activeIncidentId: string | null;
  demoClockLocal: string; // e.g. "10:00"
  currentDemoRole: 'Owner' | 'OperationsManager' | 'ProcurementOfficer' | 'KitchenLead' | 'ViewerAuditor';
  dispatchDomainEvent?: (type: string, payload: unknown) => void;
}
```

### Step 3: Wire Overview Dashboard Card Selectors
In P2's `/overview` dashboard, import the pre-built selectors:
```tsx
import { createRootP5Selectors } from '../features/recovery/governance/p5RootAdapter';
import { useRootDemoStore } from '../shared/stores/demoStore';

// Bind to root state slice
const p5Selectors = createRootP5Selectors((root) => root.p5);

export function OverviewP5Cards() {
  const rootState = useRootDemoStore();
  
  const pendingApprovalsCount = p5Selectors.selectPendingApprovalCount(rootState);
  const awaitingEvidenceCount = p5Selectors.selectAwaitingEvidenceCount(rootState);

  return (
    <div className="overview-governance-cards">
      <StatCard label="Pending Approvals" value={pendingApprovalsCount} />
      <StatCard label="Tasks Awaiting Evidence" value={awaitingEvidenceCount} />
    </div>
  );
}
```

---

## 4. Prohibited Terminology & Presentation Checklist

During live judges' questions, **strictly adhere to the truth labels**:
- ❌ **Never say**: "ROI", "cost savings", "profit improvement", "FeedMe real-time sync", "automatic PO placement", "optimal solution".
- ✅ **Always say**: "Projected landed cost", "simulated scenario", "demonstration allocation policy", "manual POS confirmation", "simulated outcome".
- All monetary figures are stored as integer sen (`amountMinor`); quantities as `KgMilli`.


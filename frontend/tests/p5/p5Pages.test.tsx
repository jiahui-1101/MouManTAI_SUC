import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createMockWorld, seedEvidence, type MockWorld } from "../../src/__dev__/p5MockWorld";
import { ApprovalsView } from "../../src/features/recovery/governance/components/ApprovalsView";
import { ComparisonView } from "../../src/features/recovery/governance/components/ComparisonView";
import { ExecutionView } from "../../src/features/recovery/governance/components/ExecutionView";
import { OutcomesView } from "../../src/features/recovery/governance/components/OutcomesView";
import { DecisionMemoryView } from "../../src/features/recovery/governance/components/DecisionMemoryView";
import {
  P5RuntimeProvider,
  createP5Runtime,
  devMockDeps,
  rootStoreDeps,
  type P5Runtime,
} from "../../src/features/recovery/governance/p5Store";

afterEach(cleanup);

interface Ctx {
  world: MockWorld;
  rt: P5Runtime;
  p5: () => P5Runtime["store"] extends { getState(): infer S } ? (S extends { p5: infer P } ? P : never) : never;
}

function setup(prep?: (w: MockWorld) => void): Ctx {
  const world = createMockWorld();
  prep?.(world);
  const rt = createP5Runtime(devMockDeps(world));
  return { world, rt, p5: () => rt.store.getState().p5 };
}

function show(ctx: Ctx, view: ReactElement) {
  return render(
    <MemoryRouter>
      <P5RuntimeProvider runtime={ctx.rt}>{view}</P5RuntimeProvider>
    </MemoryRouter>,
  );
}

function showAt(ctx: Ctx, path: string, view: ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <P5RuntimeProvider runtime={ctx.rt}>{view}</P5RuntimeProvider>
    </MemoryRouter>,
  );
}

function approvePlan(ctx: Ctx, strategy: "A" | "B") {
  selectAs(ctx, strategy);
  const sel = ctx.p5().selection!;
  const res = ctx.p5().approveDemoScenario("demo approve", sel.version, sel.fingerprint);
  if (!res.ok) throw new Error(`${res.error}: ${res.detail}`);
}

const btn = (name: string | RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;
const text = () => document.body.textContent ?? "";

function typeReason(value: string, scope: HTMLElement = document.body) {
  const box = within(scope).getAllByRole("textbox")[0]!;
  fireEvent.change(box, { target: { value } });
}

describe("Recovery Comparison", () => {
  it("WAITING_BOTH: no numbers, links to both plans", () => {
    const ctx = setup((w) => {
      w.removePlan("A");
      w.removePlan("B");
    });
    show(ctx, <ComparisonView />);
    const card = screen.getByTestId("waiting-both");
    expect(card.textContent).toContain("Waiting for Plan A and Plan B");
    expect(card.textContent).not.toMatch(/\d/);
    expect(text()).not.toContain("RM");
    expect(card.querySelector('a[href="/recovery/plan-a"]')).toBeTruthy();
    expect(card.querySelector('a[href="/recovery/plan-b"]')).toBeTruthy();
    expect(screen.queryByTestId("plan-A")).toBeNull();
  });

  it("READY renders values from the scenario, not hardcoded (P5-T01)", () => {
    const ctx = setup((w) =>
      w.update((s) => {
        s.scenarios.A!.additionalCostSen = 12345;
        s.scenarios.B!.forecastChickenPortionsUnmet = 99;
      }),
    );
    show(ctx, <ComparisonView />);
    // Decision strip (above the fold) shows store-driven values
    expect(screen.getByTestId("strip-A-spend").textContent).toContain("RM123.45 (projected)");
    expect(screen.getByTestId("strip-A-giveup").textContent).toContain("RM123.45");
    expect(screen.getByTestId("strip-B-giveup").textContent).toContain("99 forecast portions can't be offered today");
    // Full comparison details keep the long-form wording
    const a = screen.getByTestId("plan-A-details");
    const b = screen.getByTestId("plan-B-details");
    expect(a.textContent).toContain("RM123.45 projected additional landed cost");
    expect(a.textContent).toContain("150 (conditional)");
    expect(a.textContent).toContain("Conditional — depends on supplier delivery");
    expect(b.textContent).toContain("99 — forecast only, not confirmed-order breaches");
    expect(b.textContent).toContain("RM0.00 new purchase (not total operating cost)");
    expect(b.textContent).toContain("60 planned");
    expect(text()).not.toContain("RM255.00");
  });

  it("shows PO shortfall and forecast gap as two separate cards; null impact → not available", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    expect(screen.getByTestId("impact-po-shortfall").textContent).toContain("Supplier won't deliver: 20kg");
    expect(screen.getByTestId("impact-po-shortfall").textContent).toContain("HP-PO-1042 expected 20kg, supplier says 0kg today");
    expect(screen.getByTestId("impact-forecast-gap").textContent).toContain("Actually short for today's forecast: 12kg");
    act(() => ctx.world.update((s) => void (s.impact = null)));
    expect(text()).toContain("Impact summary not available yet");
    expect(screen.queryByTestId("impact-po-shortfall")).toBeNull();
  });

  it("ONLY_B: Plan B choosable, Plan A not ready", () => {
    const ctx = setup((w) => w.removePlan("A"));
    show(ctx, <ComparisonView />);
    expect(screen.getByTestId("plan-A").textContent).toContain("Plan A not ready");
    const choose = btn("Choose Plan B");
    expect(choose.disabled).toBe(false);
    fireEvent.click(choose);
    expect(ctx.p5().selection?.strategy).toBe("B");
  });

  it("FINGERPRINT_MISMATCH: all Choose buttons disabled with visible reason", () => {
    const ctx = setup((w) => w.update((s) => void (s.scenarios.B!.snapshotFingerprint = "other-fp")));
    show(ctx, <ComparisonView />);
    expect(btn("Choose Plan A").disabled).toBe(true);
    expect(btn("Choose Plan B").disabled).toBe(true);
    expect(screen.getAllByText("Plans were calculated on different data versions").length).toBe(2);
    expect(screen.getByRole("alert").textContent).toContain("different data versions");
  });

  it("stale scenario: Choose disabled with STALE text", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    act(() => ctx.world.changeFingerprint());
    expect(btn("Choose Plan A").disabled).toBe(true);
    expect(within(screen.getByTestId("plan-A")).getAllByText(/Numbers changed — recalculation required/).length).toBeGreaterThan(0);
  });

  it.each(["A", "B"] as const)("Choose %s saves selection only — no approval, no tasks (P5-T03/T04)", (st) => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    fireEvent.click(btn(`Choose Plan ${st}`));
    expect(ctx.p5().selection?.strategy).toBe(st);
    expect(ctx.p5().approvals).toHaveLength(0);
    expect(ctx.p5().actions).toHaveLength(0);
    expect(screen.getByTestId("selection-panel").textContent).toContain(`Plan ${st} chosen — not approved yet.`);
    expect(screen.getByRole("button", { name: `✓ Plan ${st} chosen` })).toBeTruthy();
    expect(screen.getByTestId("selection-panel").querySelector('a[href="/approvals"]')).toBeTruthy();
  });

  it("Escalate requires a reason; then ESCALATED and no tasks (P5-T14)", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    const opener = btn("Reject both / Escalate");
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject both and escalate" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("A reason is required.");
    expect(ctx.p5().escalationState).toBe("NONE");
    typeReason("Neither plan acceptable", dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject both and escalate" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(ctx.p5().escalationState).toBe("ESCALATED");
    expect(ctx.p5().actions).toHaveLength(0);
    expect(text()).toContain("ESCALATED — both plans rejected");
    expect(btn("Choose Plan A").disabled).toBe(true);
    expect(text()).toContain("Escalated — request revised constraints first");

    // Revise constraints exit
    fireEvent.click(screen.getAllByRole("button", { name: "Revise constraints" })[0]!);
    const d2 = screen.getByRole("dialog");
    typeReason("Relax unmet limit", d2);
    fireEvent.click(within(d2).getByRole("button", { name: "Request recalculation" }));
    expect(text()).toContain("Recalculation requested from Plan A / Plan B owners");
    expect(btn("Choose Plan A").disabled).toBe(false);
  });

  it("Escape closes a dialog and returns focus", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    const opener = btn("Reject both / Escalate");
    opener.focus();
    fireEvent.click(opener);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("not wired: shows a waiting state without crashing", () => {
    const rt = createP5Runtime(rootStoreDeps());
    render(
      <MemoryRouter>
        <P5RuntimeProvider runtime={rt}>
          <ComparisonView />
          <ApprovalsView />
        </P5RuntimeProvider>
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/not connected to the shared demo store/).length).toBe(2);
  });
});

function selectAs(ctx: Ctx, strategy: "A" | "B") {
  const r = ctx.p5().chooseRecoveryScenario(strategy);
  if (!r.ok) throw new Error(r.error);
}

function approveViaUi(clicks = 1) {
  typeReason("Protect confirmed orders");
  fireEvent.click(btn("Approve"));
  const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm approval" });
  for (let i = 0; i < clicks; i++) fireEvent.click(confirm);
}

describe("Approvals", () => {
  it("no selection → empty state with link", () => {
    const ctx = setup();
    show(ctx, <ApprovalsView />);
    const empty = screen.getByTestId("no-selection");
    expect(empty.textContent).toContain("No plan selected. Choose a plan on Recovery Comparison first.");
    expect(empty.querySelector('a[href="/recovery/compare"]')).toBeTruthy();
  });

  it("ViewerAuditor → Approve disabled with forbidden message (P5-T06)", () => {
    const ctx = setup();
    selectAs(ctx, "B");
    ctx.world.setRole("ViewerAuditor");
    show(ctx, <ApprovalsView />);
    typeReason("x");
    const card = screen.getByTestId("approval-blocker");
    expect(card.textContent).toContain("Only the Owner can approve this plan");
    expect(card.textContent).toContain("The viewer role is read-only.");
    expect(within(card).getByTestId("p5-blocker-details").textContent).toContain("DEMO_FORBIDDEN");
    expect(btn("Approve").disabled).toBe(true);
  });

  it("role switcher: OperationsManager on Plan B is blocked and names MENU_LIMIT_TASK", () => {
    const ctx = setup();
    selectAs(ctx, "B");
    show(ctx, <ApprovalsView />);
    fireEvent.change(screen.getByTestId("p5-role-select"), { target: { value: "OperationsManager" } });
    const card = screen.getByTestId("approval-blocker");
    expect(card.textContent).toContain("Only the Owner can approve this plan");
    expect(card.textContent).toContain("Operations Manager can't sign this off because it changes what customers can order today.");
    expect(within(card).getByTestId("p5-blocker-details").textContent).toContain("OperationsManager cannot approve MENU_LIMIT_TASK");
    expect(btn("Approve").disabled).toBe(true);
  });

  it("Owner approves Plan B → one approval, 7 tasks, not executed (P5-T05)", () => {
    const ctx = setup();
    selectAs(ctx, "B");
    show(ctx, <ApprovalsView />);
    expect(screen.getByTestId("action-scope").children).toHaveLength(7);
    expect(text()).toContain("External effects: none — simulation only.");
    expect(text()).toContain("A reason is required before approving.");
    expect(btn("Approve").disabled).toBe(true);
    approveViaUi();
    expect(ctx.p5().approvals).toHaveLength(1);
    expect(ctx.p5().actions).toHaveLength(7);
    expect(ctx.p5().actions.every((a) => a.state === "APPROVED")).toBe(true);
    const ok = screen.getByTestId("approval-success");
    expect(ok.textContent).toContain("Approved (simulated). 7 tasks created — not executed yet.");
    expect(ok.querySelector('a[href="/execution"]')).toBeTruthy();
  });

  it("double-click Confirm → one record (P5-T08)", () => {
    const ctx = setup();
    selectAs(ctx, "A");
    show(ctx, <ApprovalsView />);
    approveViaUi(2);
    expect(ctx.p5().approvals).toHaveLength(1);
    expect(ctx.world.state.events.filter((e) => e.type === "PLAN_APPROVED")).toHaveLength(1);
  });

  it("clock 10:50: Plan A expired, Plan B unaffected", () => {
    const ctx = setup((w) => w.setClock("10:50"));
    selectAs(ctx, "A");
    show(ctx, <ApprovalsView />);
    typeReason("x");
    expect(screen.getByTestId("approval-blocker").textContent).toContain("Too late for Plan A");
    expect(screen.getByTestId("approval-blocker").textContent).toContain("now 10:50");
    expect(btn("Approve").disabled).toBe(true);
    act(() => selectAs(ctx, "B"));
    expect(screen.queryByTestId("approval-blocker")).toBeNull();
    expect(btn("Approve").disabled).toBe(false);
  });

  it("fingerprint change via dev controls after selection → STALE_SCENARIO (P5-T07)", () => {
    const ctx = setup();
    selectAs(ctx, "B");
    show(ctx, <ApprovalsView />);
    expect(screen.queryByTestId("approval-blocker")).toBeNull();
    fireEvent.click(btn("Change snapshot fingerprint"));
    expect(screen.getByTestId("approval-blocker").textContent).toContain(
      "The numbers changed — this plan must be recalculated before it can be approved",
    );
    expect(within(screen.getByTestId("approval-blocker")).getByTestId("p5-blocker-cta").getAttribute("href")).toBe("/recovery/compare");
    expect(btn("Approve").disabled).toBe(true);
  });

  it("Reject → REJECTED in history, selection cleared, no tasks", () => {
    const ctx = setup();
    selectAs(ctx, "A");
    show(ctx, <ApprovalsView />);
    fireEvent.click(btn("Reject"));
    const d = screen.getByRole("dialog");
    typeReason("Cost too high for the demo", d);
    fireEvent.click(within(d).getByRole("button", { name: "Reject plan" }));
    expect(ctx.p5().selection).toBeNull();
    expect(ctx.p5().actions).toHaveLength(0);
    const item = screen.getByTestId("approval-history-item");
    expect(item.textContent).toContain("REJECTED");
    expect(item.textContent).toContain("Cost too high for the demo");
    expect(screen.getByTestId("no-selection")).toBeTruthy();
  });

  it("history marks a stale approval and never shows it as active", () => {
    const ctx = setup();
    selectAs(ctx, "B");
    show(ctx, <ApprovalsView />);
    approveViaUi();
    expect(screen.getByTestId("approval-history-item").textContent).toContain("Active (simulated)");
    act(() => ctx.world.changeFingerprint());
    const item = screen.getByTestId("approval-history-item");
    expect(item.textContent).toContain("STALE");
    expect(item.textContent).not.toContain("Active (simulated)");
  });

  it("approval history details toggle reveals chosen and unchosen plan summaries and audit context", () => {
    const ctx = setup();
    selectAs(ctx, "B");
    show(ctx, <ApprovalsView />);
    approveViaUi();
    const item = screen.getByTestId("approval-history-item");
    const toggle = within(item).getByRole("button", { name: /Show details/i });
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(within(item).queryByText(/Chosen Plan — Plan B/i)).toBeNull();

    // Expand details
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toContain("Hide details");
    expect(within(item).getByText(/Chosen Plan — Plan B/i)).toBeTruthy();
    expect(within(item).getByText(/Alternative Plan — Plan A/i)).toBeTruthy();
    expect(within(item).getByText(/Governance & Audit Metadata/i)).toBeTruthy();
    expect(within(item).getByTitle("SIMULATED_ACTION").textContent).toBe("Simulated action");

    // Collapse details
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("Show details");
    expect(within(item).queryByText(/Chosen Plan — Plan B/i)).toBeNull();
  });
});

describe("Execution Tracker (/execution)", () => {
  it("no approval → empty state with link to /approvals", () => {
    const ctx = setup();
    show(ctx, <ExecutionView />);
    expect(text()).toContain("No approved plan. Approve a plan on Approvals first.");
    expect(screen.getByRole("link", { name: "Go to Approvals →" })).toBeTruthy();
  });

  it("Plan B approved → 7 cards (3 menu + 4 batch), no PO_DRAFT", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    show(ctx, <ExecutionView />);
    const cards = screen.getAllByTestId(/^p5-task-card-/);
    expect(cards).toHaveLength(7);
    expect(screen.queryByTestId("p5-po-draft-content")).toBeNull();
    expect(screen.getByTestId("p5-progress-text").textContent).toContain("0 of 7 tasks waiting for proof");
  });

  it("Plan A approved → PO_DRAFT card shows 'NOT SENT'", () => {
    const ctx = setup();
    approvePlan(ctx, "A");
    show(ctx, <ExecutionView />);
    expect(screen.getByTestId("p5-po-draft-content").textContent).toContain("Local purchase order draft — NOT SENT");
    expect(screen.getByTestId("p5-receipt-check-content").textContent).toContain("Waiting for the simulated delivery and quality check before 10:45");
  });

  it("KitchenLead can't simulate a MENU task (visible reason) but can simulate PREP", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    act(() => ctx.world.setRole("KitchenLead"));
    show(ctx, <ExecutionView />);
    const menuTask = ctx.p5().actions.find((a) => a.actionType === "MENU_LIMIT_TASK")!;
    const prepTask = ctx.p5().actions.find((a) => a.actionType === "PREP_BATCH_TASK")!;

    // Menu task simulate button disabled with visible reason
    const menuBtn = screen.getByTestId(`p5-simulate-btn-${menuTask.id}`) as HTMLButtonElement;
    expect(menuBtn.disabled).toBe(true);
    const blockerText = screen.getByTestId(`p5-task-blocker-${menuTask.id}`).textContent;
    expect(blockerText).toContain("Only Owner or Operations Manager can do this menu limit");

    // Prep task simulate button enabled
    const prepBtn = screen.getByTestId(`p5-simulate-btn-${prepTask.id}`) as HTMLButtonElement;
    expect(prepBtn.disabled).toBe(false);
  });

  it("Simulate requires a reason; one click advances exactly one step; audit entry shown; never VERIFIED (P5-FR16)", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    show(ctx, <ExecutionView />);
    const prepTask = ctx.p5().actions.find((a) => a.actionType === "PREP_BATCH_TASK")!;

    // Step 1: Click simulate
    fireEvent.click(screen.getByTestId(`p5-simulate-btn-${prepTask.id}`));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();

    // Try submitting without reason
    fireEvent.click(within(dialog).getByRole("button", { name: "Advance step" }));
    expect(within(dialog).getByRole("alert").textContent).toContain("A reason is required.");

    // Enter reason and advance
    typeReason("Start kitchen prep", dialog);
    fireEvent.click(within(dialog).getByRole("button", { name: "Advance step" }));

    // Card advanced to SIMULATED_EXECUTION
    expect(screen.getByTestId(`p5-task-state-${prepTask.id}`).textContent).toBe("In progress (simulated)");
    expect(screen.getByTestId(`p5-task-state-${prepTask.id}`).getAttribute("title")).toBe("SIMULATED_EXECUTION");
    expect(screen.getByTestId(`p5-task-audit-${prepTask.id}`).textContent).toContain("Ready to start → In progress (simulated)");
    expect(screen.getByTestId(`p5-task-audit-${prepTask.id}`).textContent).toContain("Start kitchen prep");

    // Step 2: Simulate next step to AWAITING_EVIDENCE
    fireEvent.click(screen.getByTestId(`p5-simulate-btn-${prepTask.id}`));
    const d2 = screen.getByRole("dialog");
    typeReason("Kitchen finished batch cooking", d2);
    fireEvent.click(within(d2).getByRole("button", { name: "Advance step" }));

    expect(screen.getByTestId(`p5-task-state-${prepTask.id}`).textContent).toBe("Done — needs proof");
    expect(screen.getByTestId(`p5-record-evidence-link-${prepTask.id}`)).toBeTruthy();

    // Verify simulate button is gone from AWAITING_EVIDENCE, state never reaches VERIFIED
    expect(screen.queryByTestId(`p5-simulate-btn-${prepTask.id}`)).toBeNull();
    expect(ctx.p5().actions.some((a) => a.state === "VERIFIED")).toBe(false);
  });

  it("fingerprint changed after approval → execution blocked banner, buttons disabled (P5-T07)", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    act(() => ctx.world.changeFingerprint());
    show(ctx, <ExecutionView />);
    expect(screen.getByTestId("p5-execution-blocked-banner").textContent).toContain(
      "The numbers changed — this plan must be recalculated before it can be executed",
    );
    const simulateBtns = screen.getAllByRole("button", { name: "Simulate next step" }) as HTMLButtonElement[];
    expect(simulateBtns.every((b) => b.disabled)).toBe(true);
  });

  it("Plan A with clock 10:50 → blocked APPROVAL_EXPIRED", () => {
    const ctx = setup();
    approvePlan(ctx, "A");
    act(() => ctx.world.setClock("10:50"));
    show(ctx, <ExecutionView />);
    expect(screen.getByTestId("p5-execution-blocked-banner").textContent).toContain("Too late for Plan A");
    expect(screen.getByTestId("p5-execution-blocked-banner").textContent).toContain("The 10:45 cutoff has passed on the demo clock (now 10:50)");
  });

  it("menu task shows 'not synced'; after MENU_UPDATE applied evidence → 'Manually confirmed (demo evidence)'; never 'SYNCED'", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    show(ctx, <ExecutionView />);
    const menuTask = ctx.p5().actions.find((a) => a.actionType === "MENU_LIMIT_TASK")!;

    expect(screen.getByTestId(`p5-task-sync-${menuTask.id}`).textContent).toBe(
      "Waiting for staff to update the POS by hand",
    );

    act(() => {
      ctx.p5().recordSimulatedEvidence(menuTask.id, "MENU_UPDATE", {
        menuId: menuTask.targetId!,
        applied: true,
      });
    });

    expect(screen.getByTestId(`p5-task-sync-${menuTask.id}`).textContent).toBe(
      "Staff confirmed the change (demo)",
    );
    expect(text()).not.toMatch(/\bSYNCED\b/);
  });
});

describe("Outcome Verification (/outcomes)", () => {
  it("approved but no evidence → Simulated Outcome: UNVERIFIED and checklist lists everything (P5-T09)", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    show(ctx, <OutcomesView />);
    expect(screen.getByTestId("p5-outcome-badge").textContent).toBe("Simulated Outcome: UNVERIFIED");
    const checklist = screen.getByTestId("p5-missing-evidence-list");
    expect(checklist.textContent).toContain("Prep batch 1 of 4: not confirmed yet");
    expect(checklist.textContent).toContain("Prep batch 2 of 4");
    expect(checklist.textContent).toContain("Prep batch 3 of 4");
    expect(checklist.textContent).toContain("Prep batch 4 of 4");
    expect(checklist.textContent).toContain("Menu limit for Chicken Popcorn: not confirmed yet");
    expect(checklist.textContent).toContain("Confirmed orders served: not recorded yet");
    expect(checklist.textContent).not.toMatch(/MENU_UPDATE|ORDER_FULFILMENT|HP-BATCH/);
    expect(screen.getByTestId("p5-outcome-why").textContent).toContain("waiting for evidence (0 of 8 items recorded)");
  });

  it("B 3/4 batches → not SUCCESS (P5-T10)", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    seedEvidence(ctx.rt.store, ctx.world, "B_PARTIAL");
    show(ctx, <OutcomesView />);
    fireEvent.click(btn("Verify simulated outcome"));
    expect(screen.getByTestId("p5-outcome-badge").textContent).toBe("Simulated Outcome: PARTIAL");
  });

  it("full B evidence → Simulated Outcome: SUCCESS with 'Demo evidence only' subtext (P5-T11)", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    seedEvidence(ctx.rt.store, ctx.world, "B_COMPLETE");
    show(ctx, <OutcomesView />);
    fireEvent.click(btn("Verify simulated outcome"));
    expect(screen.getByTestId("p5-outcome-badge").textContent).toBe("Simulated Outcome: SUCCESS");
    expect(screen.getByTestId("p5-success-subtext").textContent).toBe(
      "Demo evidence only — not real Happy Potato operations",
    );
  });

  it("Plan A arrival 11:00 → FAILED with a RECEIPT_LATE reason", () => {
    const ctx = setup();
    approvePlan(ctx, "A");
    seedEvidence(ctx.rt.store, ctx.world, "A_LATE");
    show(ctx, <OutcomesView />);
    fireEvent.click(btn("Verify simulated outcome"));
    expect(screen.getByTestId("p5-outcome-badge").textContent).toBe("Simulated Outcome: FAILED");
    expect(text()).toContain("Chicken arrived 11:00 — after the 10:45 cutoff");
    expect(text()).not.toContain("RECEIPT_LATE");
  });

  it("Waste Unknown → table shows UNKNOWN, never '0kg' (P5-T13)", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    seedEvidence(ctx.rt.store, ctx.world, "B_COMPLETE");
    show(ctx, <OutcomesView />);
    const wasteCell = screen.getByTestId("p5-actual-waste");
    expect(wasteCell.textContent).toMatch(/unknown/i);
    expect(wasteCell.textContent).not.toContain("0kg");
  });

  it("Revise evidence → revision 2 shown, revision 1 still listed, freshness OUT_OF_DATE until re-verify", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    seedEvidence(ctx.rt.store, ctx.world, "B_COMPLETE");
    show(ctx, <OutcomesView />);
    fireEvent.click(btn("Verify simulated outcome"));
    expect(screen.queryByTestId("p5-freshness-badge")).toBeNull();

    // Click revise on the active task
    const reviseBtn = screen.getAllByTestId(/p5-revise-btn/)[0]!;
    fireEvent.click(reviseBtn);
    fireEvent.click(screen.getByTestId("p5-submit-evidence-btn"));

    // Revision history lists revision 2 and revision 1
    const revHistory = screen.getByTestId("p5-revision-history");
    expect(revHistory.textContent).toContain("Revision 2");
    expect(revHistory.textContent).toContain("Revision 1");

    // Freshness is OUT_OF_DATE until re-verify
    expect(screen.getByTestId("p5-freshness-badge").textContent).toContain(
      "Evidence changed since the last check — verify again.",
    );

    // Re-verify clears freshness warning
    fireEvent.click(btn("Verify simulated outcome"));
    expect(screen.queryByTestId("p5-freshness-badge")).toBeNull();
  });

  it("ViewerAuditor: forms disabled, verify still allowed", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    act(() => ctx.world.setRole("ViewerAuditor"));
    show(ctx, <OutcomesView />);
    expect(screen.getByTestId("p5-role-forbidden-alert").textContent).toContain("Viewer (audit only) can't record this");
    expect((screen.getByTestId("p5-submit-evidence-btn") as HTMLButtonElement).disabled).toBe(true);
    // Verify button is still available to evaluate
    const verifyBtn = btn("Verify simulated outcome");
    expect(verifyBtn.disabled).toBe(false);
    fireEvent.click(verifyBtn);
    expect(screen.getByTestId("p5-outcome-badge")).toBeTruthy();
  });

  it("?actionId= opens the matching form", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    const targetTask = ctx.p5().actions.find((a) => a.targetId === "HP-BATCH-B-03")!;
    showAt(ctx, `/outcomes?actionId=${targetTask.id}`, <OutcomesView />);
    const select = screen.getByTestId("p5-task-select") as HTMLSelectElement;
    expect(select.value).toBe(targetTask.id);
  });

  it("Save to memory twice → one entry", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    seedEvidence(ctx.rt.store, ctx.world, "B_COMPLETE");
    show(ctx, <OutcomesView />);
    fireEvent.click(btn("Verify simulated outcome"));
    const saveBtn = btn("Save case to Decision Memory");
    fireEvent.click(saveBtn);
    expect(ctx.p5().decisionMemory).toHaveLength(1);
    fireEvent.click(saveBtn);
    expect(ctx.p5().decisionMemory).toHaveLength(1);
    expect(screen.getByTestId("p5-live").textContent).toContain("Already in Decision Memory.");
  });
});

describe("Decision Memory (/decision-memory)", () => {
  it("UNVERIFIED and ESCALATED cases listed but success count excludes them (P5-T16); filters work; lessons split", () => {
    const ctx = setup();

    // 1. Initially empty
    const { unmount } = show(ctx, <DecisionMemoryView />);
    expect(screen.getByTestId("p5-empty-memory").textContent).toContain(
      "No cases yet. Complete a recovery and save it from Outcome Verification.",
    );
    expect(screen.getByTestId("p5-success-count").textContent).toBe("0");
    expect(screen.getByTestId("p5-total-count").textContent).toBe("0");
    unmount();

    // 2. Save UNVERIFIED case
    approvePlan(ctx, "A");
    ctx.p5().saveDemoDecisionMemory("HP-INC-001");

    // 3. Save ESCALATED case
    ctx.p5().rejectBothAndEscalate("Neither acceptable");
    ctx.p5().saveDemoDecisionMemory("HP-INC-001");

    // Render with 2 cases
    const view2 = show(ctx, <DecisionMemoryView />);
    expect(screen.getByTestId("p5-success-count").textContent).toBe("0");
    expect(screen.getByTestId("p5-total-count").textContent).toBe("2");
    view2.unmount();

    // 4. Save SUCCESS case
    ctx.p5().requestRecalculation("revise");
    approvePlan(ctx, "B");
    seedEvidence(ctx.rt.store, ctx.world, "B_COMPLETE");
    ctx.p5().verifyDemoOutcome("HP-INC-001");
    ctx.p5().saveDemoDecisionMemory("HP-INC-001");

    // Render with 3 cases: success count is 1, total count is 3
    show(ctx, <DecisionMemoryView />);
    expect(screen.getByTestId("p5-success-count").textContent).toBe("1");
    expect(screen.getByTestId("p5-total-count").textContent).toBe("3");

    // Filters: filter by strategy B
    fireEvent.change(screen.getByTestId("p5-filter-strategy"), { target: { value: "B" } });
    expect(screen.getAllByRole("row").length).toBe(2); // Header + 1 row

    // Detail dialog: open details on the Plan B case
    const bEntry = ctx.p5().decisionMemory.find((m) => m.strategy === "B")!;
    fireEvent.click(screen.getByTestId(`p5-view-detail-btn-${bEntry.id}`));

    // Assert lessons split into facts and interpretations with labels
    const facts = screen.getByTestId("p5-deterministic-facts");
    expect(facts.textContent).toContain("Fact");
    expect(facts.querySelector('[title="DETERMINISTIC_FACT"]')).toBeTruthy();
    expect(facts.textContent).toContain("Plan B protected 60 confirmed portions with 0kg new purchase.");

    const interpretations = screen.getByTestId("p5-demo-interpretations");
    expect(interpretations.querySelector('[title="DEMO_INTERPRETATION"]')).toBeTruthy();
    expect(interpretations.textContent).toContain("Demo interpretation:");
  });
});

describe("banned wording", () => {
  const BANNED: RegExp[] = [
    /AI recommends/i,
    /best plan/i,
    /optimal/i,
    /(cost|money|RM)\s*saved/i,
    /\bsavings\b/i,
    /\bprofit\b/i,
    /\bROI\b/,
    /\bSYNCED\b/,
    /Synced with FeedMe/i,
    /Chicken Rice/i,
    /orders breached/i,
    /real outcome/i,
    /verified performance/i,
    /recommended/i,
  ];
  const check = () => {
    const t = text();
    for (const re of BANNED) expect(t, `banned: ${re}`).not.toMatch(re);
  };

  it("Comparison in several states", () => {
    const ctx = setup();
    const { unmount } = show(ctx, <ComparisonView />);
    check();
    fireEvent.click(btn("Choose Plan B"));
    check();
    act(() => ctx.world.changeFingerprint());
    check();
    act(() => ctx.world.removePlan("A"));
    check();
    unmount();
  });

  it("Approvals in several states", () => {
    const ctx = setup();
    show(ctx, <ApprovalsView />);
    check();
    act(() => selectAs(ctx, "B"));
    check();
    approveViaUi();
    check();
    act(() => ctx.world.setRole("ViewerAuditor"));
    check();
  });

  it("Execution in several states", () => {
    const ctx = setup();
    const { unmount } = show(ctx, <ExecutionView />);
    check();
    unmount();

    const ctxB = setup();
    approvePlan(ctxB, "B");
    const { unmount: unmountB } = show(ctxB, <ExecutionView />);
    check();
    unmountB();

    const ctxA = setup();
    approvePlan(ctxA, "A");
    const { unmount: unmountA } = show(ctxA, <ExecutionView />);
    check();
    unmountA();
  });

  it("Outcomes in several states", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    const { unmount } = show(ctx, <OutcomesView />);
    check();
    fireEvent.click(btn("Verify simulated outcome"));
    check();
    seedEvidence(ctx.rt.store, ctx.world, "B_COMPLETE");
    fireEvent.click(btn("Verify simulated outcome"));
    check();
    unmount();
  });

  it("Decision Memory in several states", () => {
    const ctx = setup();
    approvePlan(ctx, "B");
    seedEvidence(ctx.rt.store, ctx.world, "B_COMPLETE");
    ctx.p5().verifyDemoOutcome("HP-INC-001");
    ctx.p5().saveDemoDecisionMemory("HP-INC-001");
    const { unmount } = show(ctx, <DecisionMemoryView />);
    check();
    unmount();
  });
});

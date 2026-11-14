import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { createMockWorld, type MockWorld } from "../../src/__dev__/p5MockWorld";
import { ApprovalsView } from "../../src/features/recovery/governance/components/ApprovalsView";
import { ComparisonView } from "../../src/features/recovery/governance/components/ComparisonView";
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
    const a = screen.getByTestId("plan-A");
    const b = screen.getByTestId("plan-B");
    expect(a.textContent).toContain("RM123.45 projected additional landed cost");
    expect(a.textContent).toContain("150 (conditional)");
    expect(a.textContent).toContain("CONDITIONAL");
    expect(b.textContent).toContain("99 — forecast only, not confirmed-order breaches");
    expect(b.textContent).toContain("RM0.00 new purchase (not total operating cost)");
    expect(b.textContent).toContain("60 planned");
    expect(text()).not.toContain("RM255.00");
  });

  it("shows PO shortfall and forecast gap as two separate cards; null impact → not available", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    expect(screen.getByTestId("impact-po-shortfall").textContent).toContain("Supplier PO shortfall: 20kg");
    expect(screen.getByTestId("impact-po-shortfall").textContent).toContain("HP-PO-1042 expected 20kg, supplier claims 0kg today");
    expect(screen.getByTestId("impact-forecast-gap").textContent).toContain("Forecast chicken demand gap: 12kg");
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
    expect(screen.getAllByText("Plans were calculated on different snapshots").length).toBe(2);
    expect(screen.getByRole("alert").textContent).toContain("different snapshots");
  });

  it("stale scenario: Choose disabled with STALE text", () => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    act(() => ctx.world.changeFingerprint());
    expect(btn("Choose Plan A").disabled).toBe(true);
    expect(within(screen.getByTestId("plan-A")).getAllByText(/STALE — recalculation required/).length).toBeGreaterThan(0);
  });

  it.each(["A", "B"] as const)("Choose %s saves selection only — no approval, no tasks (P5-T03/T04)", (st) => {
    const ctx = setup();
    show(ctx, <ComparisonView />);
    fireEvent.click(btn(`Choose Plan ${st}`));
    expect(ctx.p5().selection?.strategy).toBe(st);
    expect(ctx.p5().approvals).toHaveLength(0);
    expect(ctx.p5().actions).toHaveLength(0);
    expect(screen.getByTestId("selection-panel").textContent).toContain(`Plan ${st} selected — not approved yet.`);
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
    expect(screen.getByTestId("approval-blocker").textContent).toContain("DEMO_FORBIDDEN");
    expect(btn("Approve").disabled).toBe(true);
  });

  it("role switcher: OperationsManager on Plan B is blocked and names MENU_LIMIT_TASK", () => {
    const ctx = setup();
    selectAs(ctx, "B");
    show(ctx, <ApprovalsView />);
    fireEvent.change(screen.getByLabelText("Demo role — not real access control"), { target: { value: "OperationsManager" } });
    expect(screen.getByTestId("approval-blocker").textContent).toContain("OperationsManager cannot approve MENU_LIMIT_TASK");
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
    expect(screen.getByTestId("approval-blocker").textContent).toContain("APPROVAL_EXPIRED");
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
    expect(screen.getByTestId("approval-blocker").textContent).toContain("STALE_SCENARIO");
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
});

describe("banned wording", () => {
  const BANNED: RegExp[] = [
    /AI recommends/i,
    /best plan/i,
    /optimal/i,
    /\bsaved\b/i,
    /savings/i,
    /\bROI\b/,
    /SYNCED/,
    /Synced with FeedMe/i,
    /Chicken Rice/i,
    /orders breached/i,
    /verified (outcome|success)/i,
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
});

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ComparisonView } from '../../src/features/recovery/governance/components/ComparisonView';
import {
  clearPublishedScenarios,
  createRestaurantStoreAdapter,
} from '../../src/features/recovery/governance/p5RootAdapter';
import { createP5Runtime, P5RuntimeProvider } from '../../src/features/recovery/governance/p5Store';
import {
  __resetP2StoreForTests,
  assessImpactAction,
  resetDemo,
  simulateSupplierReport,
  simulateVerification,
} from '../../src/services/mock/restaurantStore';

describe('P5 Disruption Gating on /recovery/compare', () => {
  beforeEach(() => {
    __resetP2StoreForTests();
    clearPublishedScenarios();
  });

  afterEach(() => {
    cleanup();
    __resetP2StoreForTests();
    clearPublishedScenarios();
  });

  it('enforces staged P1-P4 workflow progression before unlocking Plan A and Plan B', async () => {
    const adapter = createRestaurantStoreAdapter();
    const runtime = createP5Runtime(adapter);

    const { unmount } = render(
      <MemoryRouter>
        <P5RuntimeProvider runtime={runtime}>
          <ComparisonView />
        </P5RuntimeProvider>
      </MemoryRouter>,
    );

    // 1. Initial State: clean waiting state, zero plans shown
    const waitingCard = screen.getByTestId('waiting-both');
    expect(waitingCard).toBeTruthy();
    expect(waitingCard.textContent).toContain('Waiting for Plan A and Plan B');
    expect(waitingCard.textContent).toContain('Step One:');
    expect(waitingCard.textContent).toContain('Step Two:');
    expect(waitingCard.textContent).toContain('Step Three:');
    expect(waitingCard.querySelector('a[href="/inbox"]')).toBeTruthy();
    expect(waitingCard.querySelector('a[href="/impact"]')).toBeTruthy();
    expect(waitingCard.querySelector('a[href="/recovery/plan-a"]')).toBeTruthy();
    expect(waitingCard.querySelector('a[href="/recovery/plan-b"]')).toBeTruthy();
    expect(screen.queryByTestId('plan-A')).toBeNull();
    expect(screen.queryByTestId('plan-B')).toBeNull();

    // 2. Step 1: Simulate supplier disruption report (unverified)
    act(() => {
      simulateSupplierReport('WHATSAPP', 'PENDING');
    });

    // Comparison MUST STILL be in waiting state (waiting for verification & impact)
    expect(screen.getByTestId('waiting-both')).toBeTruthy();
    expect(screen.queryByTestId('plan-A')).toBeNull();
    expect(screen.queryByTestId('plan-B')).toBeNull();

    // 3. Step 2a: Verify report (verified, but impact not yet assessed)
    act(() => {
      simulateVerification('HP-INC-001');
    });

    // Comparison MUST STILL wait for P2 impact assessment
    expect(screen.getByTestId('waiting-both')).toBeTruthy();
    expect(screen.queryByTestId('plan-A')).toBeNull();
    expect(screen.queryByTestId('plan-B')).toBeNull();

    // 4. Step 2b: Assess BOM impact
    act(() => {
      assessImpactAction('HP-INC-001');
    });

    // Impact assessed: Plan B (Internal recovery) is now ready!
    // Plan A is awaiting explicit proposal/publication (ONLY_B state)
    expect(screen.queryByTestId('waiting-both')).toBeNull();
    const planA = screen.getByTestId('plan-A');
    const planB = screen.getByTestId('plan-B');
    expect(planA.textContent).toContain('Plan A not ready');
    expect(planB).toBeTruthy();

    // 5. Propose Plan A via the Propose Plan A action
    const proposeBtn = screen.getByRole('button', { name: /Propose Plan A/i });
    act(() => {
      fireEvent.click(proposeBtn);
    });

    // Both Plan A and Plan B are now ready side-by-side!
    expect(screen.getByTestId('plan-A').textContent).not.toContain('Plan A not ready');
    expect(screen.getByTestId('plan-A').textContent).toContain('Plan A');
    expect(screen.getByTestId('plan-B').textContent).toContain('Plan B');

    // Verify user can choose Plan B
    const chooseBBtn = screen.getByRole('button', { name: /Choose Plan B/i });
    fireEvent.click(chooseBBtn);
    expect(runtime.store.getState().p5.selection?.strategy).toBe('B');

    // 6. Reset demo
    act(() => {
      resetDemo();
    });

    // Cleanly returns to waiting state and clears selection
    expect(screen.getByTestId('waiting-both')).toBeTruthy();
    expect(screen.queryByTestId('plan-A')).toBeNull();
    expect(screen.queryByTestId('plan-B')).toBeNull();
    expect(runtime.store.getState().p5.selection).toBeNull();

    unmount();
  });
});

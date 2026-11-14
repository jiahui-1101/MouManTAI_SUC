import { useMemo } from "react";
import { titleFor } from "../../constants/navigation";
import { PageContainer } from "../../components/layout/PageContainer";
import { PlanAWorkspace } from "../../features/recovery/plan-a/components/PlanAWorkspace";
import { adaptPlanAInputs } from "../../features/recovery/plan-a/integration";
import { useDemoState } from "../../store/demoStore";
import { selectPlanAInputRead } from "../../integration/planAShared";

/**
 * Production Plan A: real shared inputs (P1 verified incident + offer evidence, P2 snapshot/impact).
 * No publisher is passed: the root SCENARIO_A_READY storage/acknowledgement contract does not exist
 * yet, so P3's own UI keeps publication in its blocked/pending state.
 */
export function PlanAPage() {
  const state = useDemoState();
  const read = useMemo(() => selectPlanAInputRead(state), [state]);
  const adapted = useMemo(() => adaptPlanAInputs(read), [read]);
  return <PageContainer title={titleFor("/recovery/plan-a")}>
    {adapted.ok
      ? <PlanAWorkspace {...adapted.value} impactAvailable />
      : adapted.code === "INPUTS_PENDING"
        ? <PlanAWorkspace source={read.source} />
        : <PlanAWorkspace error={`${adapted.code}: ${adapted.message}`} />}
  </PageContainer>;
}

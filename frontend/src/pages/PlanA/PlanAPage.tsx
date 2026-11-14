import { titleFor } from "../../constants/navigation";
import { PageContainer } from "../../components/layout/PageContainer";
import { PlanAWorkspace } from "../../features/recovery/plan-a/components/PlanAWorkspace";

export function PlanAPage() {
  return <PageContainer title={titleFor("/recovery/plan-a")}><PlanAWorkspace /></PageContainer>;
}

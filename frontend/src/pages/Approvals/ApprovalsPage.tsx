import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { ApprovalsView } from "../../features/recovery/governance/components/ApprovalsView";

export function ApprovalsPage() {
  return (
    <PageContainer title={titleFor("/approvals")}>
      <ApprovalsView />
    </PageContainer>
  );
}

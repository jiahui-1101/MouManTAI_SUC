import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { ExecutionView } from "../../features/recovery/governance/components/ExecutionView";

export function ExecutionPage() {
  return (
    <PageContainer title={titleFor("/execution")}>
      <ExecutionView />
    </PageContainer>
  );
}

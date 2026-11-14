import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { CompleteAllDemoButton } from "../../features/recovery/governance/components/CompleteAllDemoButton";
import { ExecutionView } from "../../features/recovery/governance/components/ExecutionView";

export function ExecutionPage() {
  return (
    <PageContainer title={titleFor("/execution")} actions={<CompleteAllDemoButton />}>
      <ExecutionView />
    </PageContainer>
  );
}

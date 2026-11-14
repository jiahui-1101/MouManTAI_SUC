import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { DecisionMemoryView } from "../../features/recovery/governance/components/DecisionMemoryView";

export function DecisionMemoryPage() {
  return (
    <PageContainer title={titleFor("/decision-memory")}>
      <DecisionMemoryView />
    </PageContainer>
  );
}

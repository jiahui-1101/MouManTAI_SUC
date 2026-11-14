import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { ComparisonView } from "../../features/recovery/governance/components/ComparisonView";

export function RecoveryComparisonPage() {
  return (
    <PageContainer title={titleFor("/recovery/compare")}>
      <ComparisonView />
    </PageContainer>
  );
}

import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";
import { OutcomesView } from "../../features/recovery/governance/components/OutcomesView";

export function OutcomesPage() {
  return (
    <PageContainer title={titleFor("/outcomes")}>
      <OutcomesView />
    </PageContainer>
  );
}

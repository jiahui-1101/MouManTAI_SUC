import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";

export function OverviewPage() {
  return <PageContainer title={titleFor("/overview")} />;
}

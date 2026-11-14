import { PageContainer } from "../../components/layout/PageContainer";
import { titleFor } from "../../constants/navigation";

export function SettingsPage() {
  return <PageContainer title={titleFor("/settings")} />;
}

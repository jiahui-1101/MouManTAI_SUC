import { Link } from "react-router-dom";
import { PageContainer } from "../../components/layout/PageContainer";

export function NotFoundPage() {
  return (
    <PageContainer title="Page not found">
      <p className="page__note">
        This address does not match any page. <Link to="/overview">Go to Overview</Link>
      </p>
    </PageContainer>
  );
}

import type { ReactNode } from "react";
import { NAV_GROUPS } from "../../constants/navigation";

interface PageContainerProps {
  title: string;
  /** Optional toolbar (e.g. Export / primary action), right-aligned like Portal pages. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Breadcrumb is derived from the shared navigation config: Recovery+ / Group. */
export function PageContainer({ title, actions, children }: PageContainerProps) {
  const group = NAV_GROUPS.find((g) => g.items.some((i) => i.title === title));
  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page__header">
        <div>
          <nav aria-label="Breadcrumb">
            <ol className="page__crumbs" role="list">
              <li>Recovery+</li>
              {group && <li>{group.label}</li>}
              <li aria-current="page">{title}</li>
            </ol>
          </nav>
          <h1 id="page-title" className="page__title">
            {title}
          </h1>
        </div>
        {actions && <div className="page__actions">{actions}</div>}
      </header>
      <div className="page__body" data-testid="page-body">
        {children}
      </div>
    </section>
  );
}

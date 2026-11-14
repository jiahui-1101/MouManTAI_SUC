import type { ReactNode } from "react";

interface PageContainerProps {
  title: string;
  /** Optional toolbar (e.g. Export / primary action), right-aligned like Portal pages. */
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageContainer({ title, actions, children }: PageContainerProps) {
  return (
    <section className="page" aria-labelledby="page-title">
      <header className="page__header">
        <h1 id="page-title" className="page__title">
          {title}
        </h1>
        {actions && <div className="page__actions">{actions}</div>}
      </header>
      <div className="page__body" data-testid="page-body">
        {children}
      </div>
    </section>
  );
}

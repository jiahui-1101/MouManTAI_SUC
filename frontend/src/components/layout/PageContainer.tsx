import type { ReactNode } from "react";

interface PageContainerProps {
  title: string;
  children?: ReactNode;
}

export function PageContainer({ title, children }: PageContainerProps) {
  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title" className="page__title">
        {title}
      </h1>
      <div className="page__body" data-testid="page-body">
        {children}
      </div>
    </section>
  );
}

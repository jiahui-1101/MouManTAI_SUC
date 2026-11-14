import { useRef } from "react";
import { Outlet } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { Navigation } from "../components/layout/Navigation";
import "../components/ui/portal.css";

export function MainLayout() {
  const main = useRef<HTMLElement>(null);

  return (
    <div className="shell">
      <a
        className="shell__skip"
        href="#main-content"
        onClick={(event) => {
          if (!main.current) return;
          event.preventDefault();
          main.current.scrollIntoView();
          main.current.focus({ preventScroll: true });
        }}
      >
        Skip to content
      </a>
      <AppHeader />
      <div className="shell__body">
        <aside className="shell__sidebar">
          <Navigation />
        </aside>
        <main className="shell__main" id="main-content" tabIndex={-1} ref={main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

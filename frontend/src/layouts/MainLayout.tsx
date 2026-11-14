import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { Navigation } from "../components/layout/Navigation";
import "../components/ui/portal.css";

export function MainLayout() {
  const main = useRef<HTMLElement>(null);
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  // Close the phone menu after navigating.
  useEffect(() => setNavOpen(false), [pathname]);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

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
      <AppHeader navOpen={navOpen} onToggleNav={() => setNavOpen((o) => !o)} />
      <div className="shell__body">
        {navOpen && <div className="shell__scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
        <aside id="app-nav" className={`shell__sidebar${navOpen ? " shell__sidebar--open" : ""}`}>
          <Navigation />
        </aside>
        <main className="shell__main" id="main-content" tabIndex={-1} ref={main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

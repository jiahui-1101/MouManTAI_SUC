import { Outlet } from "react-router-dom";
import { AppHeader } from "../components/layout/AppHeader";
import { Navigation } from "../components/layout/Navigation";

export function MainLayout() {
  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <AppHeader />
        <Navigation />
      </aside>
      <main className="shell__main">
        <Outlet />
      </main>
    </div>
  );
}

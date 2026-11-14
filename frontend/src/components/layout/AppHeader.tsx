import { LayoutGrid, Store } from "lucide-react";
import { HP_OUTLET } from "../../data/fixtures/happyPotato";

/**
 * Portal-style top bar: FeedMe Portal → Recovery+ → powered by MouManTAI.
 * Text-only brand treatment (no FeedMe logo asset). The outlet is the synthetic
 * demo outlet and is display-only; there is no account or live connection.
 */
export function AppHeader() {
  return (
    <header className="portal-header" aria-label="Recovery+ portal">
      <span className="portal-header__apps" aria-hidden="true">
        <LayoutGrid size={18} />
      </span>
      <p className="portal-header__product">
        <span className="portal-header__portal">FeedMe Portal</span>
        <span className="portal-header__sep" aria-hidden="true">/</span>
        <span className="portal-header__module">Recovery+</span>
        <span className="portal-header__powered">Powered by MouManTAI</span>
      </p>
      <div className="portal-header__right">
        <span className="portal-header__outlet" title="Selected outlet (synthetic demo outlet)">
          <Store size={15} aria-hidden="true" />
          <span className="portal-header__outlet-label">Outlet:</span> {HP_OUTLET.name}
        </span>
        <span className="portal-tag portal-tag--concept" title="Hackathon prototype — not an official or deployed FeedMe module">
          Concept integration
        </span>
        <span className="portal-tag portal-tag--synthetic">Synthetic data</span>
      </div>
    </header>
  );
}

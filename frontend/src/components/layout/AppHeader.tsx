import { Menu, X } from "lucide-react";
import outletLogoUrl from "../../assets/happy-potato-logo.png";
import logoUrl from "../../assets/moumantai-logo.png";

export function AppHeader({ navOpen = false, onToggleNav }: { navOpen?: boolean; onToggleNav?: () => void }) {
  return (
    <header className="portal-header" aria-label="MouManTAI portal">
      {onToggleNav && (
        <button type="button" className="portal-header__menu" onClick={onToggleNav} aria-expanded={navOpen} aria-controls="app-nav" aria-label={navOpen ? "Close menu" : "Open menu"}>
          {navOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
      )}
      <img className="portal-header__logo" src={logoUrl} alt="MouManTAI" width={510} height={65} />
      <span className="portal-header__outlet" title="Selected outlet (synthetic demo outlet)">
        <span>Outlet: Happy Potato</span>
        <img src={outletLogoUrl} alt="" width={170} height={59} />
      </span>
    </header>
  );
}

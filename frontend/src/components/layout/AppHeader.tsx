import outletLogoUrl from "../../assets/happy-potato-logo.png";
import logoUrl from "../../assets/moumantai-logo.png";

export function AppHeader() {
  return (
    <header className="portal-header" aria-label="MouManTAI portal">
      <img className="portal-header__logo" src={logoUrl} alt="MouManTAI" width={510} height={65} />
      <span className="portal-header__outlet" title="Selected outlet (synthetic demo outlet)">
        <span>Outlet: Happy Potato</span>
        <img src={outletLogoUrl} alt="" width={170} height={59} />
      </span>
    </header>
  );
}

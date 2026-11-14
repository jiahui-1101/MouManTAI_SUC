import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";
import { matchPath, NavLink, useLocation } from "react-router-dom";
import { NAV_GROUPS } from "../../constants/navigation";

const railQuery = "(max-width: 1023px)";

function subscribeToRail(onChange: () => void) {
  const media = window.matchMedia?.(railQuery);
  media?.addEventListener("change", onChange);
  return () => media?.removeEventListener("change", onChange);
}

function isRailViewport() {
  return window.matchMedia?.(railQuery).matches ?? false;
}

export function Navigation() {
  const { pathname } = useLocation();
  const isRail = useSyncExternalStore(subscribeToRail, isRailViewport);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const activeGroup = NAV_GROUPS.find((group) =>
    group.items.some(({ path }) => matchPath({ path, end: false }, pathname))
  )?.label;

  useEffect(() => {
    if (activeGroup) {
      setCollapsed((current) => current[activeGroup] ? { ...current, [activeGroup]: false } : current);
    }
  }, [activeGroup, pathname]);

  return (
    <nav className="nav" aria-label="Main navigation">
      {NAV_GROUPS.map((group) => {
        const isCollapsed = !isRail && collapsed[group.label] === true;
        const listId = `nav-${group.label.replace(/\s+/g, "-").toLowerCase()}`;
        return (
          <div className={`nav__group${isCollapsed ? " nav__group--collapsed" : ""}`} key={group.label}>
            <button
              type="button"
              className="nav__group-toggle"
              aria-expanded={!isCollapsed}
              aria-controls={listId}
              onClick={() => setCollapsed((c) => ({ ...c, [group.label]: !isCollapsed }))}
            >
              {group.label}
              <ChevronDown className="nav__chevron" size={16} aria-hidden="true" />
            </button>
            <ul id={listId} className="nav__items" aria-label={group.label} hidden={isCollapsed}>
              {group.items.map(({ path, label, icon: Icon }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    className={({ isActive }) => (isActive ? "nav__link nav__link--active" : "nav__link")}
                    aria-label={label}
                    title={label}
                  >
                    <Icon className="nav__icon" size={17} aria-hidden="true" />
                    <span className="nav__label">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

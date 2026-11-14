import { NavLink } from "react-router-dom";
import { NAV_GROUPS } from "../../constants/navigation";

export function Navigation() {
  return (
    <nav className="nav" aria-label="Main navigation">
      {NAV_GROUPS.map((group) => (
        <div className="nav__group" key={group.label}>
          <p className="nav__group-label" id={`nav-${group.label}`}>
            {group.label}
          </p>
          <ul aria-labelledby={`nav-${group.label}`}>
            {group.items.map(({ path, label, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  className={({ isActive }) => (isActive ? "nav__link nav__link--active" : "nav__link")}
                  title={label}
                >
                  <Icon className="nav__icon" size={18} aria-hidden="true" />
                  <span className="nav__label">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

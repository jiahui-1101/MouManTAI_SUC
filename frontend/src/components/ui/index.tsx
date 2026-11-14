/**
 * Shared Portal-style presentation components for all parts (P1–P5).
 * Presentation only: no data, no business logic. Styles in ./portal.css.
 */
import { useId, useRef, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import "./portal.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "secondary",
  size,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" }) {
  return <button type="button" className={`fm-btn fm-btn--${variant}${size ? " fm-btn--sm" : ""} ${className}`} {...rest} />;
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "simulated" | "count";

/** Always pass readable text; colour is a secondary signal. */
export function StatusBadge({ tone = "neutral", children, title }: { tone?: StatusTone; children: ReactNode; title?: string }) {
  return (
    <span className={`fm-badge fm-badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

export function DataPanel({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`fm-panel ${className}`}>
      {(title || actions) && <SectionHeader title={title} actions={actions} />}
      {children}
    </section>
  );
}

export function SectionHeader({ title, actions }: { title?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="fm-section-header">
      {title && <h2 className="fm-section-header__title">{title}</h2>}
      {actions && <div>{actions}</div>}
    </header>
  );
}

export function AlertBanner({ tone = "info", title, children }: { tone?: "info" | "warning" | "danger"; title: string; children?: ReactNode }) {
  return (
    <div className={`fm-banner fm-banner--${tone}`} role={tone === "danger" ? "alert" : "status"}>
      <div>
        <p className="fm-banner__title">{title}</p>
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="fm-empty">
      <p className="fm-empty__title">{title}</p>
      {children}
    </div>
  );
}

interface TabsProps<T extends string> {
  tabs: ReadonlyArray<{ id: T; label: string; panel: ReactNode }>;
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: TabsProps<T>) {
  const idPrefix = useId();
  const buttons = useRef(new Map<T, HTMLButtonElement>());

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowLeft": nextIndex = (index - 1 + tabs.length) % tabs.length; break;
      case "ArrowRight": nextIndex = (index + 1) % tabs.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    buttons.current.get(next.id)?.focus();
    if (next.id !== value) onChange(next.id);
  }

  return (
    <>
      <div className="fm-tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(button) => {
              if (button) buttons.current.set(tab.id, button);
              else buttons.current.delete(tab.id);
            }}
            id={`${idPrefix}-tab-${index}`}
            type="button"
            role="tab"
            className="fm-tab"
            aria-selected={value === tab.id}
            aria-controls={`${idPrefix}-panel-${index}`}
            tabIndex={value === tab.id ? 0 : -1}
            onKeyDown={(event) => moveFocus(event, index)}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          id={`${idPrefix}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${idPrefix}-tab-${index}`}
          hidden={value !== tab.id}
          tabIndex={0}
        >
          {tab.panel}
        </div>
      ))}
    </>
  );
}

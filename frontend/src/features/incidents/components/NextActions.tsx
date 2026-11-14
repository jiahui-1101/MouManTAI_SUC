import { ArrowRight, CheckCircle2, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { assessImpactAction } from "../../../services/mock/restaurantStore";
import type { NextAction } from "../model";

export function NextActions({ actions, variant = "default" }: { actions: NextAction[]; variant?: "default" | "queue" }) {
  if (variant === "queue") return <ActionQueue actions={actions} />;
  return (
    <ul className="p2-actions">
      {actions.map((action) => (
        <li key={action.label} className="p2-actions__item">
          <div>
            <p className="p2-actions__label">{action.label}</p>
            <p className="p2-actions__desc">{action.description}</p>
          </div>
          {action.kind === "navigate" ? (
            <Link className="p2-btn p2-btn--primary" to={action.to}>
              {action.label} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <button type="button" className="p2-btn p2-btn--primary" onClick={() => assessImpactAction(action.incidentId)}>
              {action.label} <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Compact, calm list: each row is one clickable step. */
function ActionQueue({ actions }: { actions: NextAction[] }) {
  if (!actions.length) {
    return (
      <div className="p2-queue__none">
        <CheckCircle2 size={18} aria-hidden="true" />
        <span>
          <span className="p2-queue__label">No action needed</span>
          <span className="p2-queue__desc">Supply is running normally.</span>
        </span>
      </div>
    );
  }
  return (
    <ol className="p2-queue">
      {actions.map((action, i) => {
        const plan = action.label.match(/^Plan ([AB]) /)?.[1];
        const body: ReactNode = (
          <>
            <span className={`p2-queue__num${plan ? " p2-queue__num--plan" : ""}`} aria-hidden="true">{plan ?? i + 1}</span>
            <span className="p2-queue__text">
              <span className="p2-queue__label">{action.label}</span>
              <span className="p2-queue__desc">{action.description}</span>
            </span>
            <span className="p2-queue__cta"><span className="p2-queue__cta-text">Review</span><ChevronRight size={14} aria-hidden="true" /></span>
          </>
        );
        return (
          <li key={action.label}>
            {action.kind === "navigate" ? (
              <Link className="p2-queue__row" to={action.to} onClick={action.beforeNavigate}>{body}</Link>
            ) : (
              <button type="button" className="p2-queue__row" onClick={() => assessImpactAction(action.incidentId)}>{body}</button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

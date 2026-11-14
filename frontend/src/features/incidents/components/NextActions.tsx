import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { assessImpactAction } from "../../../services/mock/restaurantStore";
import type { NextAction } from "../model";

export function NextActions({ actions }: { actions: NextAction[] }) {
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

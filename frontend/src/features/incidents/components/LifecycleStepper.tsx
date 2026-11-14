import type { IncidentStatus } from "../../../types/restaurant";
import { LIFECYCLE, STATUS_LABEL } from "../model";

export function LifecycleStepper({ status }: { status: IncidentStatus }) {
  const current = LIFECYCLE.indexOf(status);
  return (
    <ol className="p2-steps" aria-label="Incident lifecycle">
      {LIFECYCLE.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "todo";
        return (
          <li key={step} className={`p2-steps__item p2-steps__item--${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="p2-steps__dot" aria-hidden="true" />
            <span className="p2-steps__label">{STATUS_LABEL[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

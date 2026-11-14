import type { IncidentStatus } from "../../../types/restaurant";
import { LIFECYCLE, STATUS_LABEL } from "../model";

/** Compact lifecycle: current stage, a segmented progress bar, and the next stage. */
export function LifecycleStepper({ status }: { status: IncidentStatus }) {
  const current = LIFECYCLE.indexOf(status);
  const next = LIFECYCLE[current + 1];
  return (
    <div className="p2-life" aria-label={`Incident lifecycle: step ${current + 1} of ${LIFECYCLE.length}, ${STATUS_LABEL[status]}`}>
      <div className="p2-life__head">
        <span className="p2-life__current">{STATUS_LABEL[status]}</span>
        <span className="p2-life__count">Step {current + 1} of {LIFECYCLE.length}</span>
      </div>
      <ol className="p2-life__bar" aria-hidden="true">
        {LIFECYCLE.map((step, i) => (
          <li key={step} title={STATUS_LABEL[step]} className={`p2-life__seg p2-life__seg--${i < current ? "done" : i === current ? "current" : "todo"}`} />
        ))}
      </ol>
      <p className="p2-life__next">{next ? <>Next: {STATUS_LABEL[next]}</> : "Lifecycle complete"}</p>
    </div>
  );
}

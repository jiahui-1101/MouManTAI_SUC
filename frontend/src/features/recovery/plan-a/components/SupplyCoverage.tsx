import type { PlanAScenarioCandidate } from "../domain";
import { kg } from "./presentation";
export function SupplyCoverage({ scenario }: { scenario: PlanAScenarioCandidate }) {
  const physical = scenario.acceptedOnHandKgMilli; const conditional = scenario.conditionalIncomingKgMilli;
  const forecast = scenario.forecastRequirementKgMilli; const projected = scenario.projectedChickenAfterConditionalReceiptKgMilli;
  const scale = Math.max(projected, forecast, 1); const percent = (value: number) => `${value / scale * 100}%`;
  return <figure className="pa-coverage" aria-label="Conditional supply coverage">
    <figcaption>Chicken supply coverage <span className="pa-muted">· Projected after accepted receipt</span></figcaption>
    <div role="img" aria-label={`Physical accepted stock ${kg(physical)}, conditional incoming ${kg(conditional)}, forecast requirement ${kg(forecast)}, projected residual ${kg(scenario.projectedResidualKgMilli)}.`}>
      <div className="pa-coverage-track"><span className="pa-coverage-physical" data-testid="coverage-physical" style={{width:percent(physical)}}/><span className="pa-coverage-conditional" data-testid="coverage-conditional" style={{width:percent(conditional)}}/><span className="pa-coverage-marker" data-testid="coverage-forecast" style={{left:percent(forecast)}}/></div>
    </div>
    <div className="pa-coverage-legend"><span><i className="pa-coverage-physical"/>Physical accepted · {kg(physical)}</span><span><i className="pa-coverage-conditional"/>Conditional incoming · {kg(conditional)}</span><span><i className="pa-coverage-key-marker"/>Forecast · {kg(forecast)}</span><span>Projected residual · {kg(scenario.projectedResidualKgMilli)}</span></div>
  </figure>;
}

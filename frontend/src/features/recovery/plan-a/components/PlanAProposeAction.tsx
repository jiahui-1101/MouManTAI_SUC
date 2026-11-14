import { Button } from "../../../../components/ui";
import { useEffect, useRef, useState } from "react";
import type { PlanAScenarioCandidate } from "../domain";
import { publishScenarioAReady } from "../integration";
import type { PlanAPublisher } from "../integration";

interface Props {
  publisher?: PlanAPublisher;
  candidate?: PlanAScenarioCandidate;
  contextKey: string;
  localSensitivityActive: boolean;
  comparisonAvailable?: boolean;
}
export function PlanAProposeAction({ publisher, candidate, contextKey, localSensitivityActive, comparisonAvailable }: Props) {
  const inFlight = useRef(false);
  const contextEpoch = useRef(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ key: string; ok: boolean; text: string; invalidated?: boolean } | null>(null);
  useEffect(() => {
    contextEpoch.current += 1;
    setNotice(current => current && current.key !== contextKey && !current.invalidated ? { ...current, invalidated: true } : current);
  }, [contextKey]);
  const currentNotice = notice && notice.key === contextKey && !notice.invalidated ? notice : null;
  const propose = async () => {
    if (!candidate || !publisher || localSensitivityActive || inFlight.current) return;
    inFlight.current = true; setBusy(true);
    const startedAtEpoch = contextEpoch.current;
    const result = await publishScenarioAReady(candidate, publisher);
    setNotice({ key: contextKey, invalidated: startedAtEpoch !== contextEpoch.current, ok: result.ok, text: result.ok
      ? comparisonAvailable ? "Scenario storage acknowledged. Ready for P5 comparison; selection and approval remain with P5." : "Scenario storage acknowledged. P5 comparison is not connected."
      : result.message });
    inFlight.current = false; setBusy(false);
  };
  if (!publisher) return <p className="pa-publication-pending pa-muted" role="status">Shared comparison not connected yet</p>;
  return <section className="pa-panel fm-panel" aria-labelledby="publish-heading">
    <h2 className="pa-heading" id="publish-heading">Propose to shared recovery</h2>
    <>
      <p>Explicitly publish a current canonical proposal for shared comparison. P5 owns selection, approval and execution.</p>
      {localSensitivityActive && <p>Reset local ETA sensitivity and regenerate from canonical inputs before proposing.</p>}
      <div className="pa-actions"><Button variant="primary" type="button" disabled={!candidate || localSensitivityActive || busy || currentNotice?.ok === true} onClick={() => void propose()}>{busy ? "Publishing Plan A…" : "Propose Plan A"}</Button></div>
      {currentNotice && <p role={currentNotice.ok ? "status" : "alert"}>{currentNotice.text}</p>}
      {notice && !currentNotice && <p role="status">Previous publication result is stale for this workspace. Review the current shared scenario before proposing again.</p>}
    </>
  </section>;
}

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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ key: string; ok: boolean; text: string; invalidated?: boolean } | null>(null);
  useEffect(() => {
    setNotice(current => current && current.key !== contextKey && !current.invalidated ? { ...current, invalidated: true } : current);
  }, [contextKey]);
  const currentNotice = notice && notice.key === contextKey && !notice.invalidated ? notice : null;
  const propose = async () => {
    if (!candidate || !publisher || localSensitivityActive || inFlight.current) return;
    inFlight.current = true; setBusy(true);
    const result = await publishScenarioAReady(candidate, publisher);
    setNotice({ key: contextKey, ok: result.ok, text: result.ok
      ? comparisonAvailable ? "Scenario storage acknowledged. Ready for P5 comparison; selection and approval remain with P5." : "Scenario storage acknowledged. P5 comparison is not connected."
      : result.message });
    inFlight.current = false; setBusy(false);
  };
  return <section className="pa-panel" aria-labelledby="publish-heading">
    <h2 id="publish-heading">Propose to shared recovery</h2>
    {!publisher ? <p role="status">Plan A publication is pending the shared scenario dispatcher. Local previews and unsent drafts remain available.</p> : <>
      <p>Explicitly publish a current canonical proposal for shared comparison. P5 owns selection, approval and execution.</p>
      {localSensitivityActive && <p>Reset local ETA sensitivity and regenerate from canonical inputs before proposing.</p>}
      <div className="pa-actions"><button type="button" disabled={!candidate || localSensitivityActive || busy || currentNotice?.ok === true} onClick={() => void propose()}>{busy ? "Publishing Plan A…" : "Propose Plan A"}</button></div>
      {currentNotice && <p role={currentNotice.ok ? "status" : "alert"}>{currentNotice.text}</p>}
      {notice && !currentNotice && <p role="status">Previous publication result is stale for this workspace. Review the current shared scenario before proposing again.</p>}
    </>}
  </section>;
}

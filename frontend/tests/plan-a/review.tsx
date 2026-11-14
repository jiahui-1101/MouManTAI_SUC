/** Vite-only visual review harness. Not imported by the app or production build. */
import { useState } from "react";
import type { PlanAPublisher } from "../../src/features/recovery/plan-a/integration";
import { makeIntegrationRead } from "./integrationFactory";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { PageContainer } from "../../src/components/layout/PageContainer";
import { PlanAWorkspace } from "../../src/features/recovery/plan-a/components/PlanAWorkspace";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC, makePlanAScenarioInput } from "./domain/happyPotatoFactory";
import "../../src/styles/tokens.css";
import "../../src/styles/global.css";

// A test double for browser review, not a root store or a P5 connection.
const testPublisher: PlanAPublisher = {
  readCurrent: makeIntegrationRead,
  commitScenarioA: async request => ({ status: "STORED", idempotencyKey: request.idempotencyKey, snapshotRevision: request.expectedSnapshotRevision, storedScenario: request.scenario }),
};
function Review() {
  const [injected, setInjected] = useState(false);
  return <MemoryRouter><main style={{padding:24,maxWidth:1200,margin:"auto"}}>
    <p>TEST ONLY — supplied fixture inputs; no root DemoState or P5 consumer is connected.</p>
    <label><input type="checkbox" checked={injected} onChange={event => setInjected(event.target.checked)}/> Inject test publisher acknowledgement</label>
    <PageContainer title="External Supply Recovery"><PlanAWorkspace source={makeCanonicalSourcingInput()} candidates={[makeOfferB(),makeOfferC()]} supplierNames={{"HP-SUP-002":"Demo Poultry Supply B","HP-SUP-003":"Demo Budget Frozen Foods"}} scenarioMetadata={makePlanAScenarioInput().scenarioMetadata} publisher={injected ? testPublisher : undefined}/></PageContainer>
  </main></MemoryRouter>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Review/>);

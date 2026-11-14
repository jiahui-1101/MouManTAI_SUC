/** Vite-only visual review harness. Not imported by the app or production build. */
import { useState } from "react";
import type { PlanAPublisher } from "../../src/features/recovery/plan-a/integration";
import { makeIntegrationRead } from "./integrationFactory";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { routes } from "../../src/app/router";
import { titleFor } from "../../src/constants/navigation";
import { AlertBanner } from "../../src/components/ui";
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
  return <PageContainer title={titleFor("/recovery/plan-a")}>
    <AlertBanner title="Test-only Plan A review" tone="info"><p>Supplied fixture inputs; no root DemoState or P5 consumer is connected.</p><label><input type="checkbox" checked={injected} onChange={event => setInjected(event.target.checked)}/> Inject test publisher acknowledgement</label></AlertBanner>
    <div style={{marginTop:16}}><PlanAWorkspace source={makeCanonicalSourcingInput()} candidates={[makeOfferB(),makeOfferC()]} supplierNames={{"HP-SUP-002":"Demo Poultry Supply B","HP-SUP-003":"Demo Budget Frozen Foods"}} scenarioMetadata={makePlanAScenarioInput().scenarioMetadata} publisher={injected ? testPublisher : undefined}/></div>
  </PageContainer>;
}
const root = document.getElementById("root");
const reviewRoutes: RouteObject[] = routes.map(route => route.index === true ? route : ({ ...route, children: route.children?.map(child => child.index === true ? child : child.path === "/recovery/plan-a" ? { ...child, element: <Review/> } : child) }));
if (root) createRoot(root).render(<RouterProvider router={createMemoryRouter(reviewRoutes, {initialEntries:["/recovery/plan-a"]})}/>);

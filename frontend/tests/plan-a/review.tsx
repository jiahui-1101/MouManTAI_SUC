/** Vite-only visual review harness. Not imported by the app or production build. */
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { PageContainer } from "../../src/components/layout/PageContainer";
import { PlanAWorkspace } from "../../src/features/recovery/plan-a/components/PlanAWorkspace";
import { makeCanonicalSourcingInput, makeOfferB, makeOfferC, makePlanAScenarioInput } from "./domain/happyPotatoFactory";
import "../../src/styles/tokens.css";
import "../../src/styles/global.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<MemoryRouter><main style={{padding:24,maxWidth:1200,margin:"auto"}}><PageContainer title="External Supply Recovery"><PlanAWorkspace source={makeCanonicalSourcingInput()} candidates={[makeOfferB(),makeOfferC()]} supplierNames={{"HP-SUP-002":"Demo Poultry Supply B","HP-SUP-003":"Demo Budget Frozen Foods"}} scenarioMetadata={makePlanAScenarioInput().scenarioMetadata}/></PageContainer></main></MemoryRouter>);

import type { ComponentType } from "react";
import { Navigate, type RouteObject } from "react-router-dom";
import { MainLayout } from "../layouts/MainLayout";
import { ApprovalsPage } from "../pages/Approvals/ApprovalsPage";
import { ChannelsPage } from "../pages/Channels/ChannelsPage";
import { DecisionMemoryPage } from "../pages/DecisionMemory/DecisionMemoryPage";
import { ExecutionPage } from "../pages/Execution/ExecutionPage";
import { ImpactExplorerPage } from "../pages/ImpactExplorer/ImpactExplorerPage";
import { InboxPage } from "../pages/Inbox/InboxPage";
import { IncidentsPage } from "../pages/Incidents/IncidentsPage";
import { MessageIntelligencePage } from "../pages/MessageIntelligence/MessageIntelligencePage";
import { NotFoundPage } from "../pages/NotFound/NotFoundPage";
import { OutcomesPage } from "../pages/Outcomes/OutcomesPage";
import { OverviewPage } from "../pages/Overview/OverviewPage";
import { PlanAPage } from "../pages/PlanA/PlanAPage";
import { PlanBPage } from "../pages/PlanB/PlanBPage";
import { PrepPlanningPage } from "../pages/PrepPlanning/PrepPlanningPage";
import { RecoveryComparisonPage } from "../pages/RecoveryComparison/RecoveryComparisonPage";
import { SettingsPage } from "../pages/Settings/SettingsPage";

/** Path to page component. Paths must match NAV_ITEMS (enforced by tests). */
export const PAGE_ROUTES: Record<string, ComponentType> = {
  "/overview": OverviewPage,
  "/inbox": InboxPage,
  "/message-intelligence": MessageIntelligencePage,
  "/incidents": IncidentsPage,
  "/impact": ImpactExplorerPage,
  "/recovery/plan-a": PlanAPage,
  "/recovery/plan-b": PlanBPage,
  "/prep-planning": PrepPlanningPage,
  "/recovery/compare": RecoveryComparisonPage,
  "/approvals": ApprovalsPage,
  "/execution": ExecutionPage,
  "/outcomes": OutcomesPage,
  "/decision-memory": DecisionMemoryPage,
  "/channels": ChannelsPage,
  "/settings": SettingsPage,
};

export const routes: RouteObject[] = [
  {
    element: <MainLayout />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      ...Object.entries(PAGE_ROUTES).map(([path, Page]) => ({ path, element: <Page /> })),
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

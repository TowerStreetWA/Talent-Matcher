import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import AppLayout from "@/components/layout/app-layout";
import Dashboard from "@/pages/dashboard";
import UploadCv from "@/pages/upload-cv";
import Candidates from "@/pages/candidates";
import CandidateDetail from "@/pages/candidate-detail";
import Matches from "@/pages/matches";
import Jobs from "@/pages/jobs";
import Sources from "@/pages/sources";
import Alerts from "@/pages/alerts";
import Admin from "@/pages/admin";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/upload" component={UploadCv} />
        <Route path="/candidates" component={Candidates} />
        <Route path="/candidates/:id" component={CandidateDetail} />
        <Route path="/matches" component={Matches} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/sources" component={Sources} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

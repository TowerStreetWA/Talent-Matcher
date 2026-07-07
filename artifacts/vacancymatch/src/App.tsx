import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, useAuth } from "@/lib/auth";
import { BillingGateProvider, notifyApiError } from "@/lib/billing-gate";
import AppLayout from "@/components/layout/app-layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import UploadCv from "@/pages/upload-cv";
import Candidates from "@/pages/candidates";
import CandidateDetail from "@/pages/candidate-detail";
import Matches from "@/pages/matches";
import Jobs from "@/pages/jobs";
import JobSearch from "@/pages/job-search";
import Sources from "@/pages/sources";
import Alerts from "@/pages/alerts";
import Admin from "@/pages/admin";
import Billing from "@/pages/billing";
import Signup from "@/pages/signup";
import AcceptInvite from "@/pages/accept-invite";
import Team from "@/pages/team";
import Pricing from "@/pages/pricing";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      notifyApiError(error);
    },
  }),
});

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
        <Route path="/job-search" component={JobSearch} />
        <Route path="/sources" component={Sources} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/admin" component={Admin} />
        <Route path="/billing" component={Billing} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/team" component={Team} />
        <Route path="/accept-invite" component={AcceptInvite} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function AuthGate() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/signup" component={Signup} />
        <Route path="/accept-invite" component={AcceptInvite} />
        <Route path="/pricing" component={Pricing} />
        <Route component={Login} />
      </Switch>
    );
  }

  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <BillingGateProvider>
              <AuthGate />
            </BillingGateProvider>
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

import { lazy, Suspense } from "react";
import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { AuthProvider, useAuth } from "@/lib/auth";
import { BillingGateProvider, notifyApiError } from "@/lib/billing-gate";
import AppLayout from "@/components/layout/app-layout";

const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const UploadCv = lazy(() => import("@/pages/upload-cv"));
const Candidates = lazy(() => import("@/pages/candidates"));
const CandidateDetail = lazy(() => import("@/pages/candidate-detail"));
const Matches = lazy(() => import("@/pages/matches"));
const TopRoles = lazy(() => import("@/pages/top-roles"));
const JobSearch = lazy(() => import("@/pages/job-search"));
const Sources = lazy(() => import("@/pages/sources"));
const Alerts = lazy(() => import("@/pages/alerts"));
const Admin = lazy(() => import("@/pages/admin"));
const Billing = lazy(() => import("@/pages/billing"));
const Signup = lazy(() => import("@/pages/signup"));
const AcceptInvite = lazy(() => import("@/pages/accept-invite"));
const Team = lazy(() => import("@/pages/team"));
const Pricing = lazy(() => import("@/pages/pricing"));
const Landing = lazy(() => import("@/pages/landing"));
const UsageReport = lazy(() => import("@/pages/usage-report"));
const SpecList = lazy(() => import("@/pages/spec-list"));

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error) => {
      notifyApiError(error);
    },
  }),
});

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

function Router() {
  return (
    <AppLayout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/upload" component={UploadCv} />
          <Route path="/candidates" component={Candidates} />
          <Route path="/candidates/:id" component={CandidateDetail} />
          <Route path="/matches" component={Matches} />
          <Route path="/top-roles" component={TopRoles} />
          <Route path="/jobs">
            <Redirect to="/top-roles" replace />
          </Route>
          <Route path="/job-search" component={JobSearch} />
          <Route path="/sources" component={Sources} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/admin" component={Admin} />
          <Route path="/billing" component={Billing} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/team" component={Team} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/usage-report" component={UsageReport} />
          <Route path="/spec-list" component={SpecList} />
          <Route path="/login">
            <Redirect to="/" replace />
          </Route>
          <Route path="/signup">
            <Redirect to="/" replace />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/signup" component={Signup} />
          <Route path="/accept-invite" component={AcceptInvite} />
          <Route path="/pricing" component={Pricing} />
          <Route component={Login} />
        </Switch>
      </Suspense>
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

import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PwaUpdatePrompt } from "@/components/PwaUpdatePrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NetworkStatus } from "@/components/NetworkStatus";
import { useOfflineSync, persistCache, restoreCache } from "@/lib/offline";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

/* ── Lazy-loaded pages (code split per route) ─────────────────────────────── */
const Onboarding      = lazy(() => import("./pages/onboarding"));
const Dashboard       = lazy(() => import("./pages/dashboard"));
const Customers       = lazy(() => import("./pages/customers"));
const CustomerNew     = lazy(() => import("./pages/customer-new"));
const CustomerDetail  = lazy(() => import("./pages/customer-detail"));
const Services        = lazy(() => import("./pages/services"));
const Settings        = lazy(() => import("./pages/settings"));
const ProfileDirectory = lazy(() => import("./pages/profile-directory"));
const ProfileDetail   = lazy(() => import("./pages/profile-detail"));
const Analytics       = lazy(() => import("./pages/analytics"));
const ReviewerLogin   = lazy(() => import("./pages/reviewer-login"));
const NotFound        = lazy(() => import("./pages/not-found"));
const Homepage        = lazy(() => import("./pages/homepage"));

/* ── Suspense fallback — logo + dots, no layout shift ─────────────────────── */
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <img
          src={`${import.meta.env.BASE_URL}images/logo.png`}
          alt="Sevu"
          className="w-16 h-16 rounded-2xl shadow-lg animate-pulse"
        />
        <div className="flex gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

/* ── Scroll to top on every route change ──────────────────────────────────── */
function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

/* ── Query client ─────────────────────────────────────────────────────────── */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
      retryDelay: 1000,
      staleTime: 30_000,
      gcTime: 10 * 60_000,
    },
    mutations: {
      retry: false,
    },
  },
});

/* Restore persisted cache on startup so data is available offline immediately */
try {
  const cached = restoreCache();
  if (cached) {
    queryClient.setQueryData(["__cache__"], cached);
    const entries = cached as Record<string, { data: unknown; dataUpdatedAt: number }>;
    Object.entries(entries).forEach(([key, value]) => {
      try {
        const queryKey = JSON.parse(key);
        queryClient.setQueryData(queryKey, value.data, {
          updatedAt: value.dataUpdatedAt,
        });
      } catch {
        /* skip malformed entries */
      }
    });
  }
} catch {
  /* ignore cache restore errors */
}

/* Persist cache to localStorage whenever it changes */
queryClient.getQueryCache().subscribe(() => {
  try {
    const cache: Record<string, { data: unknown; dataUpdatedAt: number }> = {};
    queryClient.getQueryCache().getAll().forEach((query) => {
      if (query.state.data !== undefined) {
        cache[JSON.stringify(query.queryKey)] = {
          data: query.state.data,
          dataUpdatedAt: query.state.dataUpdatedAt,
        };
      }
    });
    persistCache(cache);
  } catch {
    /* ignore persistence errors */
  }
});

/* ── Offline sync bridge ─────────────────────────────────────────────────── */
function OfflineSyncBridge() {
  useOfflineSync();
  return null;
}

/* ── Protected route — uses in-memory auth context ───────────────────────── */
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, businessId, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated || !businessId) return <Redirect to="/app/login" />;

  return (
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  );
}

/* ── Router ───────────────────────────────────────────────────────────────── */
function Router() {
  const [location] = useLocation();
  const { isAuthenticated, businessId, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;

  return (
    <>
    <ScrollToTop />
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* ── Public profile routes ── */}
        <Route path="/profile/login" component={ReviewerLogin} />
        <Route path="/profile/:slug" component={ProfileDetail} />
        <Route path="/profile" component={ProfileDirectory} />

        {/* ── Auth routes — redirect only when fully set up (has businessId) ── */}
        <Route path="/app/login">
          {isAuthenticated && businessId ? <Redirect to="/app/dashboard" /> : <Onboarding />}
        </Route>
        <Route path="/app/signup">
          {isAuthenticated && businessId ? <Redirect to="/app/dashboard" /> : <Onboarding />}
        </Route>
        <Route path="/app/onboard">
          {isAuthenticated && businessId ? <Redirect to="/app/dashboard" /> : <Onboarding />}
        </Route>

        {/* Legacy redirect */}
        <Route path="/onboarding">
          <Redirect to="/app/login" />
        </Route>

        {/* Homepage — redirect logged-in users straight to dashboard */}
        <Route path="/">
          {isAuthenticated
            ? <Redirect to="/app/dashboard" />
            : <Homepage />}
        </Route>

        {/* ── Protected app routes ── */}
        <Route path="/app/dashboard">
          <ProtectedRoute component={Dashboard} />
        </Route>
        <Route path="/app/customers/new">
          <ProtectedRoute component={CustomerNew} />
        </Route>
        <Route path="/app/customers/:id">
          <ProtectedRoute component={CustomerDetail} />
        </Route>
        <Route path="/app/customers">
          <ProtectedRoute component={Customers} />
        </Route>
        <Route path="/app/services">
          <ProtectedRoute component={Services} />
        </Route>
        <Route path="/app/analytics">
          <ProtectedRoute component={Analytics} />
        </Route>
        <Route path="/app/settings">
          <ProtectedRoute component={Settings} />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
    </>
  );
}

/* ── Root App ─────────────────────────────────────────────────────────────── */
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <OfflineSyncBridge />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
            <PwaUpdatePrompt />
            <NetworkStatus />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

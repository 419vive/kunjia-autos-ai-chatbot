import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { initTracker } from "./lib/tracker";

// Public routes — eagerly loaded (user-facing, must be fast)
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import SmartRedirect from "./pages/SmartRedirect";

// Lazy-loaded routes — code-split to reduce initial bundle size
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Conversations = lazy(() => import("./pages/Conversations"));
const VehicleManagement = lazy(() => import("./pages/VehicleManagement"));
const LineSetup = lazy(() => import("./pages/LineSetup"));
const Analytics = lazy(() => import("./pages/Analytics"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const LoanInquiries = lazy(() => import("./pages/LoanInquiries"));
const Appointments = lazy(() => import("./pages/Appointments"));
const VehicleLanding = lazy(() => import("./pages/VehicleLanding"));
const LoanInquiry = lazy(() => import("./pages/LoanInquiry"));
const BookVisit = lazy(() => import("./pages/BookVisit"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));

function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/chat" component={Chat} />
      <Route path="/vehicle/:id" component={VehicleLanding} />
      <Route path="/loan-inquiry" component={LoanInquiry} />
      <Route path="/book-visit" component={BookVisit} />
      <Route path="/line" component={SmartRedirect} />
      <Route path="/contact" component={SmartRedirect} />

      {/* Admin login */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* Admin routes */}
      <Route path="/admin">
        <AdminLayout>
          <Dashboard />
        </AdminLayout>
      </Route>
      <Route path="/admin/conversations">
        <AdminLayout>
          <Conversations />
        </AdminLayout>
      </Route>
      <Route path="/admin/vehicles">
        <AdminLayout>
          <VehicleManagement />
        </AdminLayout>
      </Route>
      <Route path="/admin/loans">
        <AdminLayout>
          <LoanInquiries />
        </AdminLayout>
      </Route>
      <Route path="/admin/appointments">
        <AdminLayout>
          <Appointments />
        </AdminLayout>
      </Route>
      <Route path="/admin/line-setup">
        <AdminLayout>
          <LineSetup />
        </AdminLayout>
      </Route>
      <Route path="/admin/analytics">
        <AdminLayout>
          <Analytics />
        </AdminLayout>
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function LazyFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function App() {
  useEffect(() => { initTracker(); }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Suspense fallback={<LazyFallback />}>
            <Router />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

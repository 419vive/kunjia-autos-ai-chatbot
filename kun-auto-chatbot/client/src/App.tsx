import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Dashboard from "./pages/Dashboard";
import Conversations from "./pages/Conversations";
import VehicleManagement from "./pages/VehicleManagement";
import LineSetup from "./pages/LineSetup";
import Analytics from "./pages/Analytics";
import AdminLogin from "./pages/AdminLogin";
import LoanInquiries from "./pages/LoanInquiries";
import Appointments from "./pages/Appointments";
import SmartRedirect from "./pages/SmartRedirect";
import VehicleLanding from "./pages/VehicleLanding";
import LoanInquiry from "./pages/LoanInquiry";
import BookVisit from "./pages/BookVisit";
import DashboardLayout from "./components/DashboardLayout";
import { initTracker } from "./lib/tracker";

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

function App() {
  useEffect(() => { initTracker(); }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

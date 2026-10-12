import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import ProtectedRoute from './features/auth/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import SubscriptionGate from './features/subscription/SubscriptionGate';
import './App.css';
import './theme/identity.css';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminCodesPage = lazy(() => import('./pages/AdminCodesPage'));
const AdminSubscriptionsPage = lazy(() => import('./pages/AdminSubscriptionsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientDetailsPage = lazy(() => import('./pages/ClientDetailsPage'));
const PoliciesPage = lazy(() => import('./pages/PoliciesPage'));
const RenewalsPage = lazy(() => import('./pages/RenewalsPage'));
const ClaimsPage = lazy(() => import('./pages/ClaimsPage'));
const ClaimDetailsPage = lazy(() => import('./pages/ClaimDetailsPage'));
const OperationsPage = lazy(() => import('./pages/OperationsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const InsurersPage = lazy(() => import('./pages/InsurersPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const LeadDetailsPage = lazy(() => import('./pages/LeadDetailsPage'));
const AIFileAnalysisPage = lazy(() => import('./pages/AIFileAnalysisPage'));
const MedicalIntelligencePage = lazy(() => import('./pages/MedicalIntelligencePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ClientInsuranceAnalysisPage = lazy(() => import('./pages/ClientInsuranceAnalysisPage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ComingSoonPage = lazy(() => import('./pages/ComingSoonPage'));
const CopilotPage = lazy(() => import('./pages/CopilotPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));

function AppLoading() {
  return (
    <main className="suspense-loading" dir="rtl">
      <section className="suspense-loading-card">
        <strong>InsurNex</strong>
        <span>جاري تحميل النظام...</span>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<AppLoading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              {/* Setup - not gated */}
              <Route path="/setup" element={<SetupPage />} />
              {/* Subscription page - not gated */}
              <Route path="/subscription" element={<SubscriptionPage />} />

              {/* Admin routes - not gated (bypass subscription) */}
              <Route element={<AppLayout />}>
                <Route path="/admin" element={<AdminPage />} />
                <Route path="/admin/codes" element={<AdminCodesPage />} />
                <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
              </Route>

              {/* Main app - gated by subscription */}
              <Route element={<SubscriptionGate />}>
                <Route element={<AppLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="clients" element={<ClientsPage />} />
                  <Route path="clients/:id" element={<ClientDetailsPage />} />
                  <Route path="clients/:id/insurance-analysis" element={<ClientInsuranceAnalysisPage />} />
                  <Route path="policies" element={<PoliciesPage />} />
                  <Route path="renewals" element={<RenewalsPage />} />
                  <Route path="claims" element={<ClaimsPage />} />
                  <Route path="claims/:id" element={<ClaimDetailsPage />} />
                  <Route path="operations" element={<OperationsPage />} />
                  <Route path="tasks" element={<TasksPage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="insurers" element={<InsurersPage />} />
                  <Route path="leads" element={<LeadsPage />} />
                  <Route path="leads/:id" element={<LeadDetailsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="analytics/medical" element={<MedicalIntelligencePage />} />
                  <Route path="ai/file-analysis" element={<AIFileAnalysisPage />} />
                  <Route path="copilot" element={<CopilotPage />} />
                  <Route path="finance" element={<FinancePage />} />
                  <Route path="more" element={<MorePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="documents" element={<ComingSoonPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthProvider';
import ProtectedRoute from './features/auth/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import AdminLayout from './layouts/AdminLayout';
import AdminGuard from './features/admin/AdminGuard';
import { PlatformSettingsProvider } from './features/admin/PlatformSettingsProvider';
import PlatformFeatureGate from './features/admin/PlatformFeatureGate';
import SubscriptionGate from './features/subscription/SubscriptionGate';
import './App.css';
import './theme/identity.css';
import './theme/landing.css';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AdminLoginPage = lazy(() => import('./pages/AdminLoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const SetupPage = lazy(() => import('./pages/SetupPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

// Admin panel
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AdminCodesPage = lazy(() => import('./pages/AdminCodesPage'));
const AdminSubscriptionsPage = lazy(() => import('./pages/AdminSubscriptionsPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminUserDetailsPage = lazy(() => import('./pages/AdminUserDetailsPage'));
const AdminAdsPage = lazy(() => import('./pages/AdminAdsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage'));
const AdminFinancePage = lazy(() => import('./pages/AdminFinancePage'));
const AdminPricingPage = lazy(() => import('./pages/AdminPricingPage'));
const AdminArchivePage = lazy(() => import('./pages/AdminArchivePage'));
const AdminSettingsPage = lazy(() => import('./pages/AdminSettingsPage'));

// Broker app
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientWizardPage = lazy(() => import('./pages/ClientWizardPage'));
const ClientDetailsPage = lazy(() => import('./pages/ClientDetailsPage'));
const PoliciesPage = lazy(() => import('./pages/PoliciesPage'));
const PolicyDetailsPage = lazy(() => import('./pages/PolicyDetailsPage'));
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
const ClientInsuranceAnalysisPage = lazy(
  () => import('./pages/ClientInsuranceAnalysisPage'),
);
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
            {/* PUBLIC */}
            <Route path="/welcome" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin-login" element={<AdminLoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* AUTHENTICATED */}
            <Route element={<ProtectedRoute />}>
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/subscription" element={<SubscriptionPage />} />
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* ADMIN PANEL */}
              <Route element={<AdminGuard />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin-panel" element={<AdminPage />} />
                  <Route path="/admin-panel/codes" element={<AdminCodesPage />} />
                  <Route
                    path="/admin-panel/subscriptions"
                    element={<AdminSubscriptionsPage />}
                  />
                  <Route path="/admin-panel/users" element={<AdminUsersPage />} />
                  <Route
                    path="/admin-panel/users/:uid"
                    element={<AdminUserDetailsPage />}
                  />
                  <Route path="/admin-panel/ads" element={<AdminAdsPage />} />
                  <Route
                    path="/admin-panel/analytics"
                    element={<AdminAnalyticsPage />}
                  />
                  <Route
                    path="/admin-panel/finance"
                    element={<AdminFinancePage />}
                  />
                  <Route
                    path="/admin-panel/pricing"
                    element={<AdminPricingPage />}
                  />
                  <Route
                    path="/admin-panel/archive"
                    element={<AdminArchivePage />}
                  />
                  <Route
                    path="/admin-panel/settings"
                    element={<AdminSettingsPage />}
                  />
                  {/* Legacy redirects */}
                  <Route
                    path="/admin"
                    element={<Navigate to="/admin-panel" replace />}
                  />
                  <Route
                    path="/admin/codes"
                    element={<Navigate to="/admin-panel/codes" replace />}
                  />
                  <Route
                    path="/admin/subscriptions"
                    element={<Navigate to="/admin-panel/subscriptions" replace />}
                  />
                  <Route
                    path="/admin/users"
                    element={<Navigate to="/admin-panel/users" replace />}
                  />
                  <Route
                    path="/admin/ads"
                    element={<Navigate to="/admin-panel/ads" replace />}
                  />
                </Route>
              </Route>

              {/* BROKER APP */}
              <Route element={<SubscriptionGate />}>
                <Route element={<PlatformSettingsProvider><AppLayout /></PlatformSettingsProvider>}>
                  <Route index element={<DashboardPage />} />

                  {/* Clients */}
                  <Route element={<PlatformFeatureGate feature="clients" />}>
                    <Route path="clients" element={<ClientsPage />} />
                    <Route path="clients/new" element={<ClientWizardPage />} />
                    <Route path="clients/:id" element={<ClientDetailsPage />} />
                    <Route path="clients/:id/insurance-analysis" element={<ClientInsuranceAnalysisPage />} />
                  </Route>

                  {/* Feature gates also apply when users type a URL directly. */}
                  <Route element={<PlatformFeatureGate feature="policies" />}>
                    <Route path="policies" element={<PoliciesPage />} />
                    <Route path="policies/:id" element={<PolicyDetailsPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="renewals" />}>
                    <Route path="renewals" element={<RenewalsPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="claims" />}>
                    <Route path="claims" element={<ClaimsPage />} />
                    <Route path="claims/:id" element={<ClaimDetailsPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="operations" />}>
                    <Route path="operations" element={<OperationsPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="tasks" />}>
                    <Route path="tasks" element={<TasksPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="notifications" />}>
                    <Route path="notifications" element={<NotificationsPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="insurers" />}>
                    <Route path="insurers" element={<InsurersPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="leads" />}>
                    <Route path="leads" element={<LeadsPage />} />
                    <Route path="leads/:id" element={<LeadDetailsPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="analytics" />}>
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="analytics/medical" element={<MedicalIntelligencePage />} />
                    <Route path="ai/file-analysis" element={<AIFileAnalysisPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="copilot" />}>
                    <Route path="copilot" element={<CopilotPage />} />
                  </Route>
                  <Route element={<PlatformFeatureGate feature="finance" />}>
                    <Route path="finance" element={<FinancePage />} />
                  </Route>
                  <Route path="more" element={<MorePage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route element={<PlatformFeatureGate feature="documents" />}>
                    <Route path="documents" element={<ComingSoonPage />} />
                  </Route>
                </Route>
              </Route>
            </Route>

            {/* FALLBACK */}
            <Route path="*" element={<Navigate to="/welcome" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
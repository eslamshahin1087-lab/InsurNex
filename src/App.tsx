import {
  lazy,
  Suspense,
} from 'react';

import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { AuthProvider } from './features/auth/AuthProvider';
import ProtectedRoute from './features/auth/ProtectedRoute';

import AppLayout from './layouts/AppLayout';

import './App.css';

/*
 * Public authentication pages
 */
const LoginPage = lazy(
  () => import('./pages/LoginPage'),
);

const RegisterPage = lazy(
  () => import('./pages/RegisterPage'),
);

const SetupPage = lazy(
  () => import('./pages/SetupPage'),
);

/*
 * Main application pages
 */
const DashboardPage = lazy(
  () => import('./pages/DashboardPage'),
);

const ClientsPage = lazy(
  () => import('./pages/ClientsPage'),
);

const ClientDetailsPage = lazy(
  () => import('./pages/ClientDetailsPage'),
);

const PoliciesPage = lazy(
  () => import('./pages/PoliciesPage'),
);

const RenewalsPage = lazy(
  () => import('./pages/RenewalsPage'),
);

const ClaimsPage = lazy(
  () => import('./pages/ClaimsPage'),
);

const ClaimDetailsPage = lazy(
  () => import('./pages/ClaimDetailsPage'),
);

const TasksPage = lazy(
  () => import('./pages/TasksPage'),
);

const NotificationsPage = lazy(
  () => import('./pages/NotificationsPage'),
);

const InsurersPage = lazy(
  () => import('./pages/InsurersPage'),
);

const MorePage = lazy(
  () => import('./pages/MorePage'),
);

const ComingSoonPage = lazy(
  () => import('./pages/ComingSoonPage'),
);

/*
 * Mobile-friendly loading state
 */
function AppLoading() {
  return (
    <div
      className="app-loading-screen"
      dir="rtl"
    >
      <div className="app-loading-card">

        <div className="app-loading-logo">
          IN
        </div>

        <strong>
          InsurNex
        </strong>

        <span>
          جارٍ تحميل مساحة العمل...
        </span>

        <div className="app-loading-bar">
          <div />
        </div>

      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>

      <AuthProvider>

        <Suspense fallback={<AppLoading />}>

          <Routes>

            {/* Public Authentication */}

            <Route
              path="/login"
              element={<LoginPage />}
            />

            <Route
              path="/register"
              element={<RegisterPage />}
            />

            {/* Protected Application */}

            <Route element={<ProtectedRoute />}>

              {/* Organization Setup */}

              <Route
                path="/setup"
                element={<SetupPage />}
              />

              {/* Mobile App Shell */}

              <Route element={<AppLayout />}>

                {/* Dashboard */}

                <Route
                  index
                  element={<DashboardPage />}
                />

                {/* CRM */}

                <Route
                  path="clients"
                  element={<ClientsPage />}
                />

                <Route
                  path="clients/:id"
                  element={<ClientDetailsPage />}
                />

                {/* Policies */}

                <Route
                  path="policies"
                  element={<PoliciesPage />}
                />

                {/* Renewals */}

                <Route
                  path="renewals"
                  element={<RenewalsPage />}
                />

                {/* Claims */}

                <Route
                  path="claims"
                  element={<ClaimsPage />}
                />

                <Route
                  path="claims/:id"
                  element={<ClaimDetailsPage />}
                />

                {/* Tasks */}

                <Route
                  path="tasks"
                  element={<TasksPage />}
                />

                {/* Notifications */}

                <Route
                  path="notifications"
                  element={<NotificationsPage />}
                />

                {/* Insurance Companies */}

                <Route
                  path="insurers"
                  element={<InsurersPage />}
                />

                {/* More */}

                <Route
                  path="more"
                  element={<MorePage />}
                />

                {/* Future Modules */}

                <Route
                  path="leads"
                  element={<ComingSoonPage />}
                />

                <Route
                  path="documents"
                  element={<ComingSoonPage />}
                />

                <Route
                  path="analytics"
                  element={<ComingSoonPage />}
                />

                <Route
                  path="settings"
                  element={<ComingSoonPage />}
                />

              </Route>

            </Route>

            {/* Unknown URL */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/"
                  replace
                />
              }
            />

          </Routes>

        </Suspense>

      </AuthProvider>

    </BrowserRouter>
  );
}
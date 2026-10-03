import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { AuthProvider } from './features/auth/AuthProvider';
import ProtectedRoute from './features/auth/ProtectedRoute';

import AppLayout from './layouts/AppLayout';

import ClientDetailsPage from './pages/ClientDetailsPage';
import ClientsPage from './pages/ClientsPage';
import ComingSoonPage from './pages/ComingSoonPage';
import DashboardPage from './pages/DashboardPage';
import InsurersPage from './pages/InsurersPage';
import LoginPage from './pages/LoginPage';
import MorePage from './pages/MorePage';
import PoliciesPage from './pages/PoliciesPage';
import RegisterPage from './pages/RegisterPage';
import RenewalsPage from './pages/RenewalsPage';
import SetupPage from './pages/SetupPage';

import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* Public authentication */}
          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/register"
            element={<RegisterPage />}
          />

          {/* Protected application */}
          <Route element={<ProtectedRoute />}>

            {/* First-time organization setup */}
            <Route
              path="/setup"
              element={<SetupPage />}
            />

            {/* Main mobile application shell */}
            <Route element={<AppLayout />}>

              {/* Home */}
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

              {/* Insurers */}
              <Route
                path="insurers"
                element={<InsurersPage />}
              />

              {/* Mobile More screen */}
              <Route
                path="more"
                element={<MorePage />}
              />

              {/* Upcoming application modules */}
              <Route
                path="claims"
                element={<ComingSoonPage />}
              />

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

          {/* Unknown URLs */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
import { type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { LeadsPage } from './pages/LeadsPage';
import { UsersPage } from './pages/UsersPage';
import { PipelineView } from './pages/PipelineView';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { DashboardPage } from './pages/DashboardPage';
import { TasksPage } from './pages/TasksPage';
import { AuditPage } from './pages/AuditPage';
import { AppLayout } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ToastProvider';
import { NotFoundPage } from './pages/NotFoundPage';
import './App.css';

function defaultPath(role?: string) {
  if (!role) return '/dashboard';
  if (role === 'ADMIN') return '/dashboard';
  if (role === 'SALES') return '/dashboard';
  if (role === 'EXECUTIVE') return '/dashboard';
  return '/dashboard';
}

function Protected({ children, roles }: { children: ReactNode, roles?: string[] }) {
  const auth = useAuth();
  
  if (!auth) return <div className="page center"><p className="muted">Initialisation...</p></div>;
  
  const { user, loading } = auth;
  
  if (loading) {
    return (
      <div className="page center">
        <p className="muted">Chargement…</p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={defaultPath(user.role)} replace />;
  }
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}

function LoginRoute() {
  const auth = useAuth();
  if (!auth) return null;
  
  const { user, loading } = auth;
  if (loading) {
    return (
      <div className="page center">
        <p className="muted">Chargement…</p>
      </div>
    );
  }
  if (user) {
    return <Navigate to={defaultPath(auth.user?.role)} replace />;
  }
  return <LoginPage />;
}

function HomeRoute() {
  const auth = useAuth();
  if (!auth) return null;
  if (auth.loading) {
    return (
      <div className="page center">
        <p className="muted">Chargement…</p>
      </div>
    );
  }
  if (!auth.user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultPath(auth.user?.role)} replace />;
}

function AppRoutes() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/dashboard"
          element={
            <Protected>
              <DashboardPage />
            </Protected>
          }
        />
        <Route
          path="/leads"
          element={
            <Protected>
              <LeadsPage />
            </Protected>
          }
        />
        <Route
          path="/pipeline"
          element={
            <Protected roles={['ADMIN', 'SALES', 'EXECUTIVE']}>
              <PipelineView />
            </Protected>
          }
        />
        <Route
          path="/users"
          element={
            <Protected roles={['ADMIN']}>
              <UsersPage />
            </Protected>
          }
        />
        <Route
          path="/profile"
          element={
            <Protected>
              <ProfilePage />
            </Protected>
          }
        />
        <Route
          path="/settings"
          element={
            <Protected>
              <SettingsPage />
            </Protected>
          }
        />
        <Route
          path="/tasks"
          element={
            <Protected>
              <TasksPage />
            </Protected>
          }
        />
        <Route
          path="/audit"
          element={
            <Protected roles={['ADMIN']}>
              <AuditPage />
            </Protected>
          }
        />
        <Route path="/" element={<HomeRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}

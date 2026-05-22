import { type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { LeadsPage } from './pages/LeadsPage';
import { UsersPage } from './pages/UsersPage';
import { PipelineView } from './pages/PipelineView';
import { ProfilePage } from './pages/ProfilePage';
import { SettingsPage } from './pages/SettingsPage';
import { AppLayout } from './components/AppLayout';
import './App.css';

function defaultPath(role?: string) {
  if (!role) return '/leads';
  if (role === 'ADMIN') return '/users';
  if (role === 'SALES') return '/pipeline';
  return '/leads';
}

function Protected({ children, roles }: { children: ReactNode, roles?: string[] }) {
  const auth = useAuth();
  
  if (!auth) return <div className="page center"><p className="muted">Initialisation...</p></div>;
  
  const { token, user, loading } = auth;
  
  if (loading) {
    return (
      <div className="page center">
        <p className="muted">Chargement…</p>
      </div>
    );
  }
  if (!token) {
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
  
  const { token, loading } = auth;
  if (loading) {
    return (
      <div className="page center">
        <p className="muted">Chargement…</p>
      </div>
    );
  }
  if (token) {
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
  if (!auth.token) return <Navigate to="/login" replace />;
  return <Navigate to={defaultPath(auth.user?.role)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />
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
          <Protected roles={['ADMIN', 'SALES']}>
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
      <Route path="/" element={<HomeRoute />} />
      <Route path="*" element={<HomeRoute />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

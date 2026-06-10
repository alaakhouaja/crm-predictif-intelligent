import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function defaultPath(role?: string) {
  if (!role) return '/dashboard';
  return '/dashboard';
}

export function NotFoundPage() {
  const auth = useAuth();
  const back = auth?.user ? defaultPath(auth.user.role) : '/login';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Page introuvable</h2>
        <p className="muted">
          La page demandée n’existe pas ou a été déplacée.
        </p>
        <div style={{ marginTop: '1rem' }}>
          <Link className="btn primary" to={back}>
            Retour
          </Link>
        </div>
      </div>
    </div>
  );
}

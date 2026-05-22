import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';

export function ProfilePage() {
  const { user } = useAuth();
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Profil</h1>
          <p className="muted">Informations de votre compte</p>
        </div>
      </div>

      <div className="card">
        <div className="row-gap" style={{ alignItems: 'center', marginBottom: '1.5rem' }}>
          <div className="user-avatar" style={{ width: 56, height: 56, borderRadius: 18, fontSize: '1.1rem' }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
              {(user?.firstName || user?.lastName) ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() : (user?.email ?? 'Utilisateur')}
            </div>
            <div className="muted small">{user?.email}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div className="muted small">Rôle</div>
            <div className="badge" style={{ display: 'inline-flex', marginTop: '0.25rem' }}>{user?.role ?? '—'}</div>
          </div>
          <div>
            <div className="muted small">ID</div>
            <div style={{ marginTop: '0.25rem', fontWeight: 700 }}>{user?.id ?? '—'}</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


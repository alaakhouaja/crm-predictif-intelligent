import { useMemo, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function SettingsPage() {
  const { token, user, refreshMe, logout } = useAuth();
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const n = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
    return n || user?.email || 'Utilisateur';
  }, [user?.email, user?.firstName, user?.lastName]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setProfileMessage(null);
    setSavingProfile(true);
    try {
      await api('/auth/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        }),
      });
      await refreshMe();
      setProfileMessage('Profil mis à jour.');
    } catch (err) {
      setProfileMessage(err instanceof Error ? err.message : 'Erreur mise à jour.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPasswordMessage(null);
    if (!oldPassword || !newPassword) {
      setPasswordMessage('Veuillez remplir tous les champs.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage('Les mots de passe ne correspondent pas.');
      return;
    }
    setSavingPassword(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        token,
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Mot de passe modifié.');
    } catch (err) {
      setPasswordMessage(err instanceof Error ? err.message : 'Erreur modification.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Paramètres</h1>
          <p className="muted">Profil, sécurité et session</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1.5rem', alignItems: 'start' }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Profil</h2>
          <p className="muted" style={{ marginTop: '0.25rem' }}>
            Mettez à jour vos informations affichées dans l’application.
          </p>

          <form onSubmit={onSaveProfile} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
            <label>
              Prénom
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
            </label>
            <label>
              Nom
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
            </label>

            <label style={{ gridColumn: '1 / -1' }}>
              Email
              <input value={user?.email ?? ''} disabled />
            </label>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div className="muted small">
                Connecté en tant que <span className="badge" style={{ marginLeft: '0.5rem' }}>{user?.role ?? '—'}</span>
              </div>
              <button className="primary" type="submit" disabled={savingProfile || !token}>
                {savingProfile ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>

            {profileMessage ? (
              <div className="muted" style={{ gridColumn: '1 / -1' }}>
                {profileMessage}
              </div>
            ) : null}
          </form>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Sécurité</h2>
            <p className="muted" style={{ marginTop: '0.25rem' }}>
              Modifiez votre mot de passe.
            </p>

            <form onSubmit={onChangePassword} style={{ display: 'grid', gap: '1rem', marginTop: '1.25rem' }}>
              <label>
                Mot de passe actuel
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" />
              </label>
              <label>
                Nouveau mot de passe
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
              </label>
              <label>
                Confirmer
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className="primary" type="submit" disabled={savingPassword || !token}>
                  {savingPassword ? 'Mise à jour…' : 'Changer'}
                </button>
              </div>

              {passwordMessage ? <div className="muted">{passwordMessage}</div> : null}
            </form>
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}>Session</h2>
            <p className="muted" style={{ marginTop: '0.25rem' }}>
              Actions rapides pour votre compte.
            </p>

            <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1.25rem' }}>
              <div className="muted small">Compte : {displayName}</div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button className="secondary" type="button" onClick={() => void refreshMe()} disabled={!token}>
                  Actualiser le profil
                </button>
                <button className="secondary" type="button" onClick={logout}>
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

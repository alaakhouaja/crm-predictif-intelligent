import { useRef, useState, type ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Camera, User, Phone, Mail, Shield, Calendar, Clock, CheckCircle, Settings } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

function formatDate(iso: string | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

function formatDateTime(iso: string | undefined) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrateur',
  SALES: 'Commercial',
  MARKETING: 'Marketing',
  EXECUTIVE: 'Direction',
};

export function ProfilePage() {
  const { user, refreshMe, photoSrc } = useAuth();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase()
    || (user?.email?.[0] ?? 'U').toUpperCase();

  async function onPhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoMessage(null);
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api('/auth/me/photo', { method: 'POST', body: formData });
      await refreshMe();
      setPhotoMessage({ text: 'Photo mise à jour avec succès.', ok: true });
    } catch (err) {
      setPhotoMessage({ text: err instanceof Error ? err.message : 'Erreur lors de la mise à jour.', ok: false });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page">
      <div style={{ marginBottom: '2rem' }}>
        <h1>Mon profil</h1>
        <p className="muted small">Consultez vos informations personnelles. Les modifications se font depuis la page Parametres.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* ── Colonne gauche ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Carte photo + identité */}
          <div className="card" style={{ textAlign: 'center' }}>
            {/* Avatar avec bouton caméra */}
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
              <div
                className="user-avatar"
                style={{ width: 88, height: 88, borderRadius: 24, fontSize: '1.6rem', margin: '0 auto' }}
              >
                {photoSrc ? (
                  <img src={photoSrc} alt="Photo de profil" />
                ) : (
                  initials
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                title="Changer la photo"
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  border: '2px solid var(--bg-main)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <Camera size={14} color="white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={onPhotoChange}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '0.25rem' }}>
              {(user?.firstName || user?.lastName)
                ? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
                : (user?.email ?? 'Utilisateur')}
            </div>
            <div className="muted small" style={{ marginBottom: '0.75rem' }}>{user?.email}</div>

            {/* Badge Actif */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <CheckCircle size={14} color="var(--success)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success)' }}>Compte actif</span>
            </div>

            {photoMessage && (
              <p className="small" style={{ marginTop: '0.75rem', color: photoMessage.ok ? 'var(--success)' : 'var(--danger)' }}>
                {photoMessage.text}
              </p>
            )}
            <p className="muted small" style={{ marginTop: '0.5rem' }}></p>
          </div>

          {/* Carte détails du compte */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1rem' }}>Détails du compte</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Shield size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div>
                  <div className="muted small">Rôle</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {ROLE_LABEL[user?.role ?? ''] ?? user?.role ?? '—'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Calendar size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div>
                  <div className="muted small">Membre depuis</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDate(user?.createdAt)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Clock size={15} color="var(--primary)" style={{ flexShrink: 0 }} />
                <div>
                  <div className="muted small">Dernière mise à jour</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{formatDateTime(user?.updatedAt)}</div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── Colonne droite : infos personnelles en lecture seule ── */}
        <div className="card" style={{ alignSelf: 'start' }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '1.25rem' }}>Informations personnelles</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <User size={13} /> Prénom
                </div>
                <div style={{ fontWeight: 600 }}>{user?.firstName || '—'}</div>
              </div>
              <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)' }}>
                <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <User size={13} /> Nom
                </div>
                <div style={{ fontWeight: 600 }}>{user?.lastName || '—'}</div>
              </div>
            </div>

            <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <Mail size={13} /> Email
              </div>
              <div style={{ fontWeight: 600 }}>{user?.email ?? '—'}</div>
            </div>

            <div style={{ padding: '0.9rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <Phone size={13} /> Téléphone
              </div>
              <div style={{ fontWeight: 600 }}>{user?.phone || '—'}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
              <p className="muted small" style={{ margin: 0 }}>
                Pour modifier ces informations, utilisez la page Parametres.
              </p>
              <Link to="/settings" className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                <Settings size={15} />
                Ouvrir Parametres
              </Link>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}

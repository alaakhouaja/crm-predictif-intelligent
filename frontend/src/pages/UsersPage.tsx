import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { AuthUser, PaginatedResponse, UserRole } from '../types';

const roles: UserRole[] = ['ADMIN', 'SALES', 'MARKETING', 'EXECUTIVE'];

export function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Formulaire User (modal)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<UserRole>('SALES');

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const res = await api<PaginatedResponse<AuthUser>>(`/users?page=${page}&limit=10`, { token });
      if (res) {
        setUsers(res.data);
        setLastPage(res.lastPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [page, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setMode('create');
    setEditingUserId(null);
    setEmail('');
    setPassword('');
    setFirstName('');
    setLastName('');
    setRole('SALES');
    setModalOpen(true);
  }

  function openEdit(u: AuthUser) {
    setMode('edit');
    setEditingUserId(u.id);
    setEmail(u.email);
    setPassword('');
    setFirstName(u.firstName ?? '');
    setLastName(u.lastName ?? '');
    setRole(u.role);
    setModalOpen(true);
  }

  async function onSubmitUser(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      if (mode === 'create') {
        await api<AuthUser>('/users', {
          method: 'POST',
          token,
          body: JSON.stringify({
            email,
            password,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            role,
          }),
        });
      } else if (mode === 'edit' && editingUserId) {
        await api<AuthUser>(`/users/${editingUserId}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            email,
            password: password || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            role,
          }),
        });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    }
  }

  async function onDeleteUser(id: string) {
    if (!token || !window.confirm('Supprimer cet utilisateur ?')) return;
    try {
      await api(`/users/${id}`, { method: 'DELETE', token });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Suppression impossible');
    }
  }

  return (
    <div className="page">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Utilisateurs</h1>
        </div>
        <div className="row-gap">
          <button type="button" className="secondary small" onClick={() => void load()}>
            Actualiser
          </button>
          <button type="button" className="primary" onClick={openCreate}>
            <Plus size={18} />
            Ajouter
          </button>
        </div>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="card"
              style={{ width: '100%', maxWidth: '680px', padding: '2rem' }}
            >
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>{mode === 'create' ? 'Nouvel utilisateur' : 'Modifier utilisateur'}</h2>
                <button type="button" className="secondary small" onClick={() => setModalOpen(false)} style={{ padding: '0.4rem' }}>
                  <X size={18} />
                </button>
              </div>

              <form className="grid-form" onSubmit={onSubmitUser} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <label style={{ gridColumn: '1 / -1' }}>
                  Email
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Mot de passe {mode === 'edit' ? '(optionnel)' : ''}
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={mode === 'create'}
                    minLength={mode === 'create' ? 8 : undefined}
                    placeholder={mode === 'edit' ? 'Laisser vide pour ne pas changer' : undefined}
                  />
                </label>
                <label>
                  Prénom
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </label>
                <label>
                  Nom
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </label>
                <label style={{ gridColumn: '1 / -1' }}>
                  Rôle
                  <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>

                {error && <p className="error" style={{ gridColumn: '1 / -1', margin: 0 }}>{error}</p>}

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="submit" className="primary" style={{ flex: 1 }}>
                    {mode === 'create' ? 'Créer' : 'Enregistrer'}
                  </button>
                  <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>
                    Annuler
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <section className="card">
        <h2>Liste des utilisateurs</h2>
        {error && <p className="error">{error}</p>}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Créé le</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.firstName} {u.lastName}</strong><br/>
                    <span className="muted small">{u.email}</span>
                  </td>
                  <td><span className="badge">{u.role}</span></td>
                  <td className="muted small">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                  <td>
                    <div className="row-gap">
                      <button className="secondary small" onClick={() => openEdit(u)} style={{ padding: '0.4rem' }}>
                        <Pencil size={16} />
                      </button>
                      <button className="secondary small" onClick={() => onDeleteUser(u.id)} style={{ padding: '0.4rem', color: 'var(--danger)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</button>
          <span>Page {page} sur {lastPage}</span>
          <button disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Suivant</button>
        </div>
      </section>
    </div>
  );
}

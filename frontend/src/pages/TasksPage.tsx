import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, CheckCircle2, AlertTriangle, Clock, Pencil, Ban } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { AuthUser, PaginatedResponse, Task, TaskPriority, TaskStatus, TaskType } from '../types';

const statuses: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED'];
const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
const types: TaskType[] = ['SALES', 'MARKETING', 'SUPPORT', 'CALL', 'MEETING', 'EMAIL_FOLLOW_UP'];

type SortBy = '' | 'priority' | 'dueDate' | 'status' | 'progress' | 'createdAt';
type SortDir = 'asc' | 'desc';

export function TasksPage() {
  const { token, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [, setLoading] = useState(true);

  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterType, setFilterType] = useState<TaskType | ''>('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const canCreate = user?.role !== 'EXECUTIVE';
  const isAdmin = user?.role === 'ADMIN';

  const allowedTypes = useMemo<TaskType[]>(() => {
    if (user?.role === 'ADMIN') return types;
    if (user?.role === 'SALES') return ['SALES', 'CALL', 'MEETING', 'EMAIL_FOLLOW_UP'];
    if (user?.role === 'MARKETING') return ['MARKETING', 'EMAIL_FOLLOW_UP'];
    return [];
  }, [user?.role]);

  const [users, setUsers] = useState<AuthUser[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('SALES');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [progress, setProgress] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<TaskType>('SALES');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editStatus, setEditStatus] = useState<TaskStatus>('OPEN');
  const [editProgress, setEditProgress] = useState(0);
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssignedToId, setEditAssignedToId] = useState('');

  const [stats, setStats] = useState<{ total: number; completed: number; overdue: number; highPriority: number } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '10');
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (filterOverdue) params.set('overdue', 'true');
      if (search.trim()) params.set('search', search.trim());
      if (sortBy) params.set('sortBy', sortBy);
      if (sortDir) params.set('sortDir', sortDir);

      const res = await api<PaginatedResponse<Task>>(`/tasks?${params.toString()}`, { token });
      if (res) {
        setTasks(res.data);
        setLastPage(res.lastPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [filterOverdue, filterStatus, filterType, page, search, sortBy, sortDir, token]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (filterOverdue) params.set('overdue', 'true');
      if (search.trim()) params.set('search', search.trim());
      const res = await api<{ total: number; completed: number; overdue: number; highPriority: number }>(`/tasks/stats?${params.toString()}`, { token });
      setStats(res);
    } catch {
      setStats(null);
    }
  }, [filterOverdue, filterStatus, filterType, search, token]);

  const loadUsers = useCallback(async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await api<PaginatedResponse<AuthUser>>('/users?page=1&limit=200', { token });
      if (res?.data) setUsers(res.data);
      else setUsers([]);
    } catch {
      setUsers([]);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (allowedTypes.length && !allowedTypes.includes(type)) {
      setType(allowedTypes[0]);
    }
  }, [allowedTypes, type]);

  function openCreate() {
    if (!canCreate) return;
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setProgress(0);
    setDueDate('');
    setType(allowedTypes[0] ?? 'SALES');
    setAssignedToId('');
    setModalOpen(true);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    try {
      await api<Task>('/tasks', {
        method: 'POST',
        token,
        body: JSON.stringify({
          title,
          description: description || undefined,
          type,
          priority,
          progress,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          assignedToId: isAdmin && assignedToId ? assignedToId : undefined,
        }),
      });
      setModalOpen(false);
      await load();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    }
  }

  function canUpdate(t: Task) {
    if (!user || user.role === 'EXECUTIVE') return false;
    if (user.role === 'ADMIN') return true;
    return t.createdById === user.id || t.assignedToId === user.id;
  }

  function openEdit(t: Task) {
    if (!canUpdate(t)) return;
    setEditing(t);
    setEditTitle(t.title);
    setEditDescription(t.description ?? '');
    setEditType(t.type);
    setEditPriority(t.priority);
    setEditStatus(t.status);
    setEditProgress(t.progress ?? 0);
    setEditDueDate(t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 16) : '');
    setEditAssignedToId(t.assignedToId ?? '');
    setEditModalOpen(true);
  }

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    if (!token || !editing) return;
    setError(null);
    try {
      await api<Task>(`/tasks/${editing.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || undefined,
          type: editType,
          priority: editPriority,
          status: editStatus,
          progress: editProgress,
          dueDate: editDueDate ? new Date(editDueDate).toISOString() : undefined,
          assignedToId: isAdmin && editAssignedToId ? editAssignedToId : undefined,
        }),
      });
      setEditModalOpen(false);
      setEditing(null);
      await load();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible');
    }
  }

  async function markDone(task: Task) {
    if (!token) return;
    try {
      await api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: 'DONE' }),
      });
      await load();
      await loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  }

  async function cancelTask(task: Task) {
    if (!token) return;
    try {
      await api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ status: 'CANCELED' }),
      });
      await load();
      await loadStats();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  }

  function statusBadge(s: TaskStatus) {
    if (s === 'DONE') return 'badge-green';
    if (s === 'CANCELED') return 'badge-red';
    return 'badge-blue';
  }

  const now = Date.now();

  function initialsOf(u: { firstName: string | null; lastName: string | null; email: string }) {
    const a = (u.firstName?.[0] ?? '').toUpperCase();
    const b = (u.lastName?.[0] ?? '').toUpperCase();
    const i = `${a}${b}` || (u.email?.[0] ?? 'U').toUpperCase();
    return i;
  }

  return (
    <div className="page">
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Tâches</h1>
          <p className="muted" style={{ margin: 0 }}>
            Suivi des tâches commerciales et marketing.
          </p>
        </div>
        <div className="row-gap">
          <button className="secondary small" onClick={() => window.location.reload()} title="Actualiser">
            <Clock size={14} /> Actualiser
          </button>
          {canCreate && (
            <button className="primary small" onClick={openCreate}>
              <Plus size={14} /> Nouvelle tâche
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '1rem', borderColor: 'rgba(239,68,68,0.4)' }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {stats && (
        <div className="grid-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Tasks', value: stats.total, color: '#7c3aed' },
            { label: 'Completed', value: stats.completed, color: '#10b981' },
            { label: 'Overdue', value: stats.overdue, color: '#ef4444' },
            { label: 'High Priority', value: stats.highPriority, color: '#f59e0b' },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: '1.25rem', borderLeft: `3px solid ${s.color}` }}>
              <div className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '0.25rem' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <section className="card" style={{ padding: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <div className="row-gap">
            <div style={{ minWidth: '260px' }}>
              <div className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Recherche
              </div>
              <input
                type="search"
                placeholder="Titre ou description..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <div>
              <div className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Trier
              </div>
              <div className="row-gap">
                <select value={sortBy} onChange={(e) => { setSortBy(e.target.value as SortBy); setPage(1); }} style={{ width: '180px' }}>
                  <option value="">Par défaut</option>
                  <option value="priority">Priorité</option>
                  <option value="dueDate">Échéance</option>
                  <option value="status">Statut</option>
                  <option value="progress">Progress</option>
                  <option value="createdAt">Création</option>
                </select>
                <select value={sortDir} onChange={(e) => { setSortDir(e.target.value as SortDir); setPage(1); }} style={{ width: '120px' }}>
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>
            <div>
              <div className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Statut
              </div>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value as TaskStatus | ''); setPage(1); }}
                style={{ width: '180px' }}
              >
                <option value="">Tous</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Type
              </div>
              <select
                value={lockedType ?? filterType}
                onChange={(e) => { setFilterType(e.target.value as TaskType | ''); setPage(1); }}
                disabled={!!lockedType}
                style={{ width: '180px' }}
              >
                <option value="">Tous</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Retard
              </div>
              <label className="flex-center small" style={{ gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={filterOverdue}
                  onChange={(e) => { setFilterOverdue(e.target.checked); setPage(1); }}
                />
                En retard
              </label>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Titre</th>
                <th>Client/Lead</th>
                <th>Type</th>
                <th>Priorité</th>
                <th>Assigné</th>
                <th>Progress</th>
                <th>Échéance</th>
                <th>Statut</th>
                <th>Création</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const isOverdue =
                  (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
                  t.dueDate &&
                  new Date(t.dueDate).getTime() < now;
                const assigned = t.assignedTo ?? null;
                const lead = t.lead ?? null;
                return (
                  <motion.tr key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <td style={{ fontWeight: 700 }}>
                      <div className="flex-center" style={{ gap: '0.5rem' }}>
                        {isOverdue && <AlertTriangle size={14} color="var(--danger)" />}
                        {t.title}
                      </div>
                      {t.description && (
                        <div className="text-muted x-small" style={{ marginTop: '0.25rem' }}>
                          {t.description}
                        </div>
                      )}
                    </td>
                    <td className="small">
                      {lead ? (
                        <div>
                          <div style={{ fontWeight: 700 }}>{lead.firstName} {lead.lastName}</div>
                          <div className="text-muted x-small">{lead.email}</div>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${t.type === 'MARKETING' ? 'badge-orange' : 'badge-blue'}`}>{t.type}</span>
                    </td>
                    <td>
                      <span className={`badge ${t.priority === 'HIGH' ? 'badge-red' : t.priority === 'LOW' ? 'badge-green' : 'badge-blue'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td>
                      {assigned ? (
                        <div className="flex-center" style={{ gap: '0.6rem' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                            {initialsOf(assigned)}
                          </div>
                          <div>
                            <div className="small" style={{ fontWeight: 700 }}>
                              {`${assigned.firstName ?? ''} ${assigned.lastName ?? ''}`.trim() || assigned.email}
                            </div>
                            <div className="text-muted x-small">{assigned.role}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <div style={{ minWidth: '140px' }}>
                        <div className="flex-between x-small" style={{ marginBottom: '6px' }}>
                          <span className="text-muted">{t.progress ?? 0}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(0, Math.min(100, t.progress ?? 0))}%` }}
                            style={{
                              height: '100%',
                              background: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="small text-muted">
                      {t.dueDate ? new Date(t.dueDate).toLocaleString() : '—'}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(t.status)}`}>{t.status}</span>
                    </td>
                    <td className="small text-muted">
                      {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <div className="row-gap">
                        {canUpdate(t) && (
                          <button className="secondary small" onClick={() => openEdit(t)} style={{ padding: '0.4rem 0.6rem' }}>
                            <Pencil size={14} /> Éditer
                          </button>
                        )}
                        {canUpdate(t) && (t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                          <>
                            <button className="secondary small" onClick={() => void markDone(t)} style={{ padding: '0.4rem 0.6rem', color: 'var(--success)' }}>
                              <CheckCircle2 size={14} /> Terminer
                            </button>
                            <button className="secondary small" onClick={() => void cancelTask(t)} style={{ padding: '0.4rem 0.6rem', color: 'var(--danger)' }}>
                              <Ban size={14} /> Annuler
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)', marginTop: '1rem' }}>
            <p className="text-muted small">Aucune tâche.</p>
          </div>
        )}

        <div style={{ paddingTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
          <button
            className="secondary small"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </button>
          <div className="flex-center small text-muted" style={{ padding: '0 1rem' }}>
            Page {page} sur {lastPage}
          </div>
          <button
            className="secondary small"
            disabled={page === lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      </section>

      <AnimatePresence>
        {modalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card"
              style={{ width: '100%', maxWidth: '650px', padding: '2.5rem' }}
            >
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Nouvelle tâche</h2>
                <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                  <X />
                </button>
              </div>

              <form onSubmit={onCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Titre</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: '90px' }} />
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as TaskType)}>
                    {allowedTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Priorité</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                    {priorities.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Échéance</label>
                  <input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Progress (0-100)</label>
                  <input type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value))))} />
                </div>

                {isAdmin && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Assigné à</label>
                    <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
                      <option value="">Moi-même</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                  <button type="submit" className="primary" style={{ flex: 1 }}>Créer</button>
                  <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Annuler</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editModalOpen && editing && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="card"
              style={{ width: '100%', maxWidth: '650px', padding: '2.5rem' }}
            >
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Modifier tâche</h2>
                <button
                  onClick={() => { setEditModalOpen(false); setEditing(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}
                >
                  <X />
                </button>
              </div>

              <form onSubmit={onUpdate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Titre</label>
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Description</label>
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ minHeight: '90px' }} />
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Type</label>
                  <select value={editType} onChange={(e) => setEditType(e.target.value as TaskType)} disabled={!isAdmin && allowedTypes.length === 0}>
                    {(isAdmin ? types : allowedTypes).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Priorité</label>
                  <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority)}>
                    {priorities.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Statut</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)}>
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Échéance</label>
                  <input type="datetime-local" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Progress (0-100)</label>
                  <input type="number" min={0} max={100} value={editProgress} onChange={(e) => setEditProgress(Math.max(0, Math.min(100, Number(e.target.value))))} />
                </div>

                {isAdmin && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Assigné à</label>
                    <select value={editAssignedToId} onChange={(e) => setEditAssignedToId(e.target.value)}>
                      <option value="">Non assigné</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email} ({u.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                  <button type="submit" className="primary" style={{ flex: 1 }}>Sauvegarder</button>
                  <button
                    type="button"
                    className="secondary"
                    style={{ flex: 1 }}
                    onClick={() => { setEditModalOpen(false); setEditing(null); }}
                  >
                    Fermer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

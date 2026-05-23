import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { PaginatedResponse, Task, TaskPriority, TaskStatus, TaskType } from '../types';

const statuses: TaskStatus[] = ['OPEN', 'DONE', 'CANCELED'];
const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
const types: TaskType[] = ['SALES', 'MARKETING'];

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

  const canCreate = user?.role !== 'EXECUTIVE';

  const lockedType = useMemo<TaskType | null>(() => {
    if (user?.role === 'MARKETING') return 'MARKETING';
    if (user?.role === 'SALES') return 'SALES';
    return null;
  }, [user?.role]);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('SALES');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');

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
  }, [filterOverdue, filterStatus, filterType, page, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (lockedType) setType(lockedType);
  }, [lockedType]);

  function openCreate() {
    if (!canCreate) return;
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setDueDate('');
    setType(lockedType ?? 'SALES');
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
          type: lockedType ?? type,
          priority,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        }),
      });
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
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

      <section className="card" style={{ padding: '1.5rem' }}>
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <div className="row-gap">
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
                <th>Type</th>
                <th>Priorité</th>
                <th>Échéance</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => {
                const isOverdue = t.status === 'OPEN' && t.dueDate && new Date(t.dueDate).getTime() < now;
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
                    <td>
                      <span className={`badge ${t.type === 'MARKETING' ? 'badge-orange' : 'badge-blue'}`}>{t.type}</span>
                    </td>
                    <td>
                      <span className={`badge ${t.priority === 'HIGH' ? 'badge-red' : t.priority === 'LOW' ? 'badge-green' : 'badge-blue'}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="small text-muted">
                      {t.dueDate ? new Date(t.dueDate).toLocaleString() : '—'}
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(t.status)}`}>{t.status}</span>
                    </td>
                    <td>
                      {user?.role !== 'EXECUTIVE' && t.status === 'OPEN' && (
                        <button className="secondary small" onClick={() => void markDone(t)} style={{ padding: '0.4rem 0.6rem' }}>
                          <CheckCircle2 size={14} /> Terminer
                        </button>
                      )}
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
                  <select value={lockedType ?? type} onChange={(e) => setType(e.target.value as TaskType)} disabled={!!lockedType}>
                    {types.map((t) => (
                      <option key={t} value={t}>{t}</option>
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

                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
                  <button type="submit" className="primary" style={{ flex: 1 }}>Créer</button>
                  <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Annuler</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


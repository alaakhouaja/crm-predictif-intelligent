import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { Plus, X, CheckCircle2, AlertTriangle, Clock, Pencil, Ban, Kanban, List, Paperclip, Activity, Eye } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../components/ToastProvider';
import { formatDateTime } from '../utils/datetime';
import type { AuditLogEntry, AuthUser, PaginatedResponse, Task, TaskAttachment, TaskPriority, TaskStatus, TaskType } from '../types';

const statuses: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED'];
const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
const types: TaskType[] = ['CALL', 'EMAIL', 'MEETING', 'TODO'];

const TASK_TEMPLATES = [
  { id: 'appel-decouverte', label: '📞 Appel de découverte', type: 'CALL' as TaskType, priority: 'HIGH' as TaskPriority, title: 'Appel de découverte', description: 'Premier contact téléphonique pour comprendre les besoins du prospect.', dueInDays: 1 },
  { id: 'email-intro', label: '✉️ Email d\'introduction', type: 'EMAIL' as TaskType, priority: 'MEDIUM' as TaskPriority, title: 'Email d\'introduction', description: 'Envoyer un email de présentation avec notre offre commerciale.', dueInDays: 1 },
  { id: 'relance', label: '📩 Relance', type: 'EMAIL' as TaskType, priority: 'MEDIUM' as TaskPriority, title: 'Relance commerciale', description: 'Relancer le prospect suite à un premier contact sans réponse.', dueInDays: 3 },
  { id: 'demo', label: '🤝 Démonstration', type: 'MEETING' as TaskType, priority: 'HIGH' as TaskPriority, title: 'Démonstration produit', description: 'Présentation live du produit/service au prospect.', dueInDays: 5 },
  { id: 'proposition', label: '📋 Envoyer proposition', type: 'TODO' as TaskType, priority: 'HIGH' as TaskPriority, title: 'Envoyer la proposition commerciale', description: 'Préparer et envoyer le devis ou la proposition commerciale.', dueInDays: 3 },
  { id: 'suivi', label: '🔁 Suivi post-réunion', type: 'EMAIL' as TaskType, priority: 'MEDIUM' as TaskPriority, title: 'Suivi post-réunion', description: 'Envoyer un récapitulatif de la réunion et les prochaines étapes.', dueInDays: 1 },
  { id: 'negociation', label: '💬 Appel de négociation', type: 'CALL' as TaskType, priority: 'HIGH' as TaskPriority, title: 'Appel de négociation', description: 'Discuter des conditions tarifaires et finaliser les termes.', dueInDays: 2 },
  { id: 'closing', label: '🏆 Closing', type: 'CALL' as TaskType, priority: 'HIGH' as TaskPriority, title: 'Appel de closing', description: 'Appel final pour confirmer l\'accord et les modalités de signature.', dueInDays: 1 },
];

type SortBy = '' | 'priority' | 'dueDate' | 'status' | 'progress' | 'createdAt';
type SortDir = 'asc' | 'desc';
type ViewMode = 'table' | 'kanban';

export function TasksPage() {
  const { user } = useAuth();
  const toast = useToast();
  const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [, setLoading] = useState(true);

  const [view, setView] = useState<ViewMode>('table');
  const [filterStatus, setFilterStatus] = useState<TaskStatus | ''>('');
  const [filterType, setFilterType] = useState<TaskType | ''>('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const canCreate = !!user;
  const isAdmin = user?.role === 'ADMIN';
  const isExecutive = user?.role === 'EXECUTIVE';
  const canAssignOtherUsers = isAdmin || isExecutive;

  const allowedTypes = useMemo<TaskType[]>(() => {
    if (user?.role === 'ADMIN') return types;
    if (user?.role === 'EXECUTIVE') return types;
    if (user?.role === 'SALES') return types;
    if (user?.role === 'MARKETING') return types;
    return [];
  }, [user?.role]);

  const [users, setUsers] = useState<AuthUser[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TaskType>('TODO');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [progress, setProgress] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<TaskType>('TODO');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editStatus, setEditStatus] = useState<TaskStatus>('OPEN');
  const [editProgress, setEditProgress] = useState(0);
  const [editDueDate, setEditDueDate] = useState('');
  const [editAssignedToId, setEditAssignedToId] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activityLogs, setActivityLogs] = useState<AuditLogEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; mime: string; name: string } | null>(null);

  const [stats, setStats] = useState<{ total: number; completed: number; overdue: number; highPriority: number } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const effectivePage = view === 'kanban' ? 1 : page;
      params.set('page', String(effectivePage));
      params.set('limit', view === 'kanban' ? '200' : '10');
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (filterOverdue) params.set('overdue', 'true');
      if (search.trim()) params.set('search', search.trim());
      if (sortBy) params.set('sortBy', sortBy);
      if (sortDir) params.set('sortDir', sortDir);

      const res = await api<PaginatedResponse<Task>>(`/tasks?${params.toString()}`);
      if (res) {
        setTasks(res.data);
        setLastPage(view === 'kanban' ? 1 : res.lastPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [filterOverdue, filterStatus, filterType, page, search, sortBy, sortDir, user, view]);

  const loadStats = useCallback(async () => {
    if (!user) return;
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterType) params.set('type', filterType);
      if (filterOverdue) params.set('overdue', 'true');
      if (search.trim()) params.set('search', search.trim());
      const res = await api<{ total: number; completed: number; overdue: number; highPriority: number }>(`/tasks/stats?${params.toString()}`);
      setStats(res);
    } catch {
      setStats(null);
    }
  }, [filterOverdue, filterStatus, filterType, search, user]);

  const loadUsers = useCallback(async () => {
    if (!user || !canAssignOtherUsers) return;
    try {
      const res = await api<PaginatedResponse<AuthUser>>(
        '/users?page=1&limit=200',
      );
      if (res?.data) {
        setUsers(res.data.filter((candidate) => candidate.role === 'SALES'));
      }
      else setUsers([]);
    } catch {
      setUsers([]);
    }
  }, [canAssignOtherUsers, user]);

  const loadTaskDetails = useCallback(async (taskId: string) => {
    if (!user) return;
    try {
      const t = await api<Task>(`/tasks/${taskId}`);
      setEditing(t);
      setAttachments(t.attachments ?? []);
    } catch {
      setAttachments([]);
    }
  }, [user]);

  const loadActivity = useCallback(async (taskId: string) => {
    if (!user) return;
    try {
      const logs = await api<AuditLogEntry[]>(`/tasks/${taskId}/activity`);
      setActivityLogs(logs ?? []);
    } catch {
      setActivityLogs([]);
    }
  }, [user]);

  const loadAttachments = useCallback(async (taskId: string) => {
    if (!user) return;
    try {
      const list = await api<TaskAttachment[]>(`/tasks/${taskId}/attachments`);
      setAttachments(list ?? []);
    } catch {
      setAttachments([]);
    }
  }, [user]);

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

  useEffect(() => {
    if (view === 'kanban') setPage(1);
  }, [view]);

  function openCreate() {
    if (!canCreate) return;
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setProgress(0);
    setDueDate('');
    setType(allowedTypes[0] ?? 'TODO');
    setAssignedToId('');
    setSelectedTemplate('');
    setModalOpen(true);
  }

  function applyTemplate(templateId: string) {
    const tpl = TASK_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    setTitle(tpl.title);
    setDescription(tpl.description);
    setType(tpl.type);
    setPriority(tpl.priority);
    const d = new Date();
    d.setDate(d.getDate() + tpl.dueInDays);
    d.setHours(9, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    setDueDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T09:00`);
    setSelectedTemplate(templateId);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user || !canCreate) return;
    if (isExecutive && !assignedToId) {
      setError('Choisissez un commercial pour cette tache.');
      return;
    }
    setError(null);
    try {
      await api<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description: description || undefined,
          type,
          priority,
          progress,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          assignedToId: canAssignOtherUsers && assignedToId ? assignedToId : undefined,
        }),
      });
      setSelectedTemplate('');
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

  function openDetails(t: Task) {
    setEditing(t);
    setAttachments([]);
    setActivityLogs([]);
    setEditTitle(t.title);
    setEditDescription(t.description ?? '');
    setEditType(t.type);
    setEditPriority(t.priority);
    setEditStatus(t.status);
    setEditProgress(t.progress ?? 0);
    setEditDueDate(t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 16) : '');
    setEditAssignedToId(t.assignedToId ?? '');
    setEditModalOpen(true);
    void loadTaskDetails(t.id);
    void loadAttachments(t.id);
    void loadActivity(t.id);
  }

  function openEdit(t: Task) {
    if (!canUpdate(t)) return;
    openDetails(t);
  }

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    if (!user || !editing) return;
    if (!canUpdate(editing)) return;
    setError(null);
    try {
      await api<Task>(`/tasks/${editing.id}`, {
        method: 'PATCH',
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
    if (!user || !canUpdate(task)) return;
    try {
      await api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DONE' }),
      });
      await load();
      await loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise à jour impossible', 'Tâche');
    }
  }

  async function cancelTask(task: Task) {
    if (!user || !canUpdate(task)) return;
    try {
      await api<Task>(`/tasks/${task.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELED' }),
      });
      await load();
      await loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mise à jour impossible', 'Tâche');
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

  function formatBytes(bytes: number) {
    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  async function uploadAttachment(file: File) {
    if (!user || !editing || !canUpdate(editing)) return;
    setUploading(true);
    setAttachmentError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await api<TaskAttachment>(`/tasks/${editing.id}/attachments`, {
        method: 'POST',
        body: form,
        headers: {},
      });
      await loadAttachments(editing.id);
      await loadTaskDetails(editing.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload impossible';
      setAttachmentError(msg);
      toast.error(msg, 'Upload');
    } finally {
      setUploading(false);
    }
  }

  async function downloadAttachment(att: TaskAttachment) {
    const res = await fetch(`${API}/tasks/attachments/${att.id}/download`, {
      credentials: 'include',
    });
    if (!res.ok) {
      toast.error('Téléchargement impossible', 'Pièce jointe');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = att.originalName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function removeAttachment(att: TaskAttachment) {
    if (!user || !editing || !canUpdate(editing)) return;
    if (!window.confirm('Supprimer cette pièce jointe ?')) return;
    try {
      await api(`/tasks/attachments/${att.id}`, { method: 'DELETE' });
      await loadAttachments(editing.id);
      await loadTaskDetails(editing.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Suppression impossible', 'Pièce jointe');
    }
  }

  async function previewAttachment(att: TaskAttachment) {
    const previewable = att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf';
    if (!previewable) { void downloadAttachment(att); return; }
    const res = await fetch(`${API}/tasks/attachments/${att.id}/download`, { credentials: 'include' });
    if (!res.ok) { toast.error('Impossible de charger le fichier', 'Aperçu'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    setPreview({ url, mime: att.mimeType, name: att.originalName });
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  function activityLabel(a: AuditLogEntry) {
    if (a.action === 'ATTACH') {
      const v = (a.newValue as { originalName?: string } | null) ?? null;
      return `Pièce jointe ajoutée${v?.originalName ? `: ${v.originalName}` : ''}`;
    }
    if (a.action === 'DETACH') {
      return 'Pièce jointe supprimée';
    }
    if (a.action === 'POST') return 'Tâche créée';
    if (a.action === 'DELETE') return 'Tâche supprimée';
    if (a.action === 'PATCH') {
      const v = (a.newValue as { status?: TaskStatus; title?: string } | null) ?? null;
      if (v?.status === 'DONE') return 'Tâche terminée';
      if (v?.status === 'CANCELED') return 'Tâche annulée';
      if (v?.status === 'IN_PROGRESS') return 'Tâche en cours';
      if (v?.status === 'OPEN') return 'Tâche ouverte';
      if (v?.title) return 'Titre modifié';
      return 'Tâche mise à jour';
    }
    return a.action;
  }

  const kanbanColumns: { status: TaskStatus; label: string }[] = [
    { status: 'OPEN', label: 'Open' },
    { status: 'IN_PROGRESS', label: 'In Progress' },
    { status: 'DONE', label: 'Completed' },
    { status: 'CANCELED', label: 'Cancelled' },
  ];

  async function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const taskId = result.draggableId;
    const nextStatus = result.destination.droppableId as TaskStatus;
    const prevStatus = result.source.droppableId as TaskStatus;
    if (nextStatus === prevStatus && result.destination.index === result.source.index) return;
    const t = tasks.find((x) => x.id === taskId);
    if (!t || !canUpdate(t) || !user) return;

    setTasks((prev) => prev.map((x) => (x.id === taskId ? { ...x, status: nextStatus } : x)));
    try {
      await api<Task>(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
      await loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Déplacement impossible', 'Kanban');
      await load();
    }
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
          <button
            className="secondary small"
            onClick={() => setView('table')}
            style={{ color: view === 'table' ? 'var(--primary-light)' : undefined }}
            title="Vue liste"
          >
            <List size={14} /> Liste
          </button>
          <button
            className="secondary small"
            onClick={() => setView('kanban')}
            style={{ color: view === 'kanban' ? 'var(--primary-light)' : undefined }}
            title="Vue kanban"
          >
            <Kanban size={14} /> Kanban
          </button>
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
                value={filterType}
                onChange={(e) => { setFilterType(e.target.value as TaskType | ''); setPage(1); }}
                style={{ width: '180px' }}
              >
                <option value="">Tous</option>
                {(isAdmin ? types : allowedTypes).map((t) => (
                  <option key={t} value={t}>
                    {t === 'CALL' ? 'Appel' : t === 'EMAIL' ? 'E-mail' : t === 'MEETING' ? 'Reunion' : 'Autre tache'}
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

        {view === 'table' ? (
          <>
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
                          <button
                            type="button"
                            onClick={() => openDetails(t)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                            }}
                          >
                            <div className="flex-center" style={{ gap: '0.5rem' }}>
                              {isOverdue && <AlertTriangle size={14} color="var(--danger)" />}
                              <span style={{ color: 'var(--text-main)', fontWeight: 700, textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.textDecorationColor = 'var(--primary)')}
                                onMouseLeave={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                              >
                                {t.title}
                              </span>
                              <Eye size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </div>
                            {t.description && (
                              <div className="text-muted x-small" style={{ marginTop: '0.25rem', textAlign: 'left' }}>
                                {t.description.length > 80 ? t.description.slice(0, 80) + '…' : t.description}
                              </div>
                            )}
                          </button>
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
                          <span className="badge badge-blue">
                            {t.type === 'CALL' ? 'Appel' : t.type === 'EMAIL' ? 'E-mail' : t.type === 'MEETING' ? 'Reunion' : 'Autre tache'}
                          </span>
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
                          {t.dueDate ? formatDateTime(t.dueDate) : '—'}
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
          </>
        ) : (
          <>
            <DragDropContext onDragEnd={onDragEnd}>
              <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {kanbanColumns.map((c) => {
                  const colTasks = tasks
                    .filter((t) => t.status === c.status)
                    .sort((a, b) => {
                      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
                      return ad - bd;
                    });
                  return (
                    <Droppable key={c.status} droppableId={c.status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{
                            flex: '0 0 320px',
                            minWidth: '320px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--glass-border)',
                            background: snapshot.isDraggingOver ? 'rgba(124, 58, 237, 0.12)' : 'rgba(30, 41, 59, 0.35)',
                            padding: '1rem',
                          }}
                        >
                          <div className="flex-between" style={{ marginBottom: '1rem' }}>
                            <div style={{ fontWeight: 800 }}>{c.label}</div>
                            <span className="badge badge-blue">{colTasks.length}</span>
                          </div>

                          {colTasks.map((t, index) => {
                            const isOverdue =
                              (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
                              t.dueDate &&
                              new Date(t.dueDate).getTime() < now;
                            const canDrag = canUpdate(t);
                            return (
                              <Draggable key={t.id} draggableId={t.id} index={index} isDragDisabled={!canDrag}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    style={{
                                      ...dragProvided.draggableProps.style,
                                      padding: '1rem',
                                      borderRadius: 'var(--radius-md)',
                                      border: '1px solid var(--glass-border)',
                                      background: 'rgba(15, 23, 42, 0.6)',
                                      boxShadow: dragSnapshot.isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                                      marginBottom: '0.75rem',
                                      cursor: canDrag ? 'grab' : 'default',
                                    }}
                                    onClick={() => openDetails(t)}
                                  >
                                    <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                                      <div className="flex-center" style={{ gap: '0.5rem', fontWeight: 800 }}>
                                        {isOverdue && <AlertTriangle size={14} color="var(--danger)" />}
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
                                          {t.title}
                                        </span>
                                      </div>
                                      <span className={`badge ${t.priority === 'HIGH' ? 'badge-red' : t.priority === 'LOW' ? 'badge-green' : 'badge-blue'}`}>
                                        {t.priority}
                                      </span>
                                    </div>

                                    {t.lead && (
                                      <div className="text-muted x-small" style={{ marginBottom: '0.5rem' }}>
                                        {t.lead.firstName} {t.lead.lastName}
                                      </div>
                                    )}

                                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                      <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.max(0, Math.min(100, t.progress ?? 0))}%` }}
                                        style={{
                                          height: '100%',
                                          background: 'linear-gradient(90deg, var(--primary), var(--primary-light))',
                                        }}
                                      />
                                    </div>

                                    <div className="flex-between x-small text-muted">
                                      <span>{t.assignedTo ? `${t.assignedTo.firstName ?? ''} ${t.assignedTo.lastName ?? ''}`.trim() || t.assignedTo.email : '—'}</span>
                                      <span>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</span>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}

                          {colTasks.length === 0 && (
                            <div style={{ padding: '1.25rem', textAlign: 'center', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                              <p className="text-muted small" style={{ margin: 0 }}>Aucune tâche</p>
                            </div>
                          )}

                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </DragDropContext>
          </>
        )}
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
                <button onClick={() => { setSelectedTemplate(''); setModalOpen(false); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                  <X />
                </button>
              </div>

              {/* Sélecteur de template */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                  Démarrer depuis un template (optionnel)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {TASK_TEMPLATES.map(tpl => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl.id)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '5px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${selectedTemplate === tpl.id ? 'var(--primary)' : 'var(--glass-border)'}`,
                        background: selectedTemplate === tpl.id ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                        color: selectedTemplate === tpl.id ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {tpl.label}
                    </button>
                  ))}
                </div>
                {selectedTemplate && (
                  <button
                    type="button"
                    onClick={() => { setSelectedTemplate(''); setTitle(''); setDescription(''); setType('TODO'); setPriority('MEDIUM'); setDueDate(''); }}
                    style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Effacer le template
                  </button>
                )}
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
                        {t === 'CALL' ? 'Appel' : t === 'EMAIL' ? 'E-mail' : t === 'MEETING' ? 'Reunion' : 'Autre tache'}
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

                {canAssignOtherUsers && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>
                      {isExecutive ? 'Commercial assigne' : 'Assigne a'}
                    </label>
                    <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}>
                      <option value="">{isExecutive ? 'Choisir un sales' : 'Non assigne'}</option>
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
                  <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => { setSelectedTemplate(''); setModalOpen(false); }}>Annuler</button>
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
              style={{ width: '100%', maxWidth: '980px', padding: '2.5rem', maxHeight: '85vh', overflowY: 'auto' }}
            >
              {(() => {
                const readOnly = !canUpdate(editing);
                return (
                  <>
              <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0 }}>{readOnly ? 'Détails tâche' : 'Modifier tâche'}</h2>
                  {readOnly && (
                    <div className="text-muted small" style={{ marginTop: '0.25rem' }}>
                      Lecture seule
                    </div>
                  )}
                </div>
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
                  <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required disabled={readOnly} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Description</label>
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} style={{ minHeight: '90px' }} disabled={readOnly} />
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Type</label>
                  <select value={editType} onChange={(e) => setEditType(e.target.value as TaskType)} disabled={readOnly || (!isAdmin && allowedTypes.length === 0)}>
                    {(isAdmin ? types : allowedTypes).map((t) => (
                      <option key={t} value={t}>
                        {t === 'CALL' ? 'Appel' : t === 'EMAIL' ? 'E-mail' : t === 'MEETING' ? 'Reunion' : 'Autre tache'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Priorité</label>
                  <select value={editPriority} onChange={(e) => setEditPriority(e.target.value as TaskPriority)} disabled={readOnly}>
                    {priorities.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Statut</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as TaskStatus)} disabled={readOnly}>
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Échéance</label>
                  <input type="datetime-local" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} disabled={readOnly} />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Progress (0-100)</label>
                  <input type="number" min={0} max={100} value={editProgress} onChange={(e) => setEditProgress(Math.max(0, Math.min(100, Number(e.target.value))))} disabled={readOnly} />
                </div>

                {isAdmin && (
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Assigné à</label>
                    <select value={editAssignedToId} onChange={(e) => setEditAssignedToId(e.target.value)} disabled={readOnly}>
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
                  {!readOnly && (
                    <button type="submit" className="primary" style={{ flex: 1 }}>Sauvegarder</button>
                  )}
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

              <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', background: 'rgba(30, 41, 59, 0.35)' }}>
                  <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <div className="flex-center" style={{ gap: '0.5rem', fontWeight: 800 }}>
                      <Paperclip size={16} /> Pièces jointes
                    </div>
                    <span className="badge badge-blue">{attachments.length}</span>
                  </div>

                  {!readOnly && (
                    <div style={{ marginBottom: '1rem' }}>
                      <label className="secondary small" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}>
                        <Paperclip size={14} /> Ajouter un fichier
                        <input
                          type="file"
                          style={{ display: 'none' }}
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void uploadAttachment(f);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {attachmentError && <div className="inline-error">{attachmentError}</div>}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {attachments.map((a) => (
                      <div key={a.id} style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div className="flex-between" style={{ gap: '1rem' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.originalName}
                            </div>
                            <div className="text-muted x-small" style={{ marginTop: '0.25rem' }}>
                              {formatBytes(a.size)} • {formatDateTime(a.createdAt)}
                            </div>
                          </div>
                          <div className="row-gap">
                            {(a.mimeType.startsWith('image/') || a.mimeType === 'application/pdf') && (
                              <button className="secondary small" onClick={() => void previewAttachment(a)} style={{ padding: '0.35rem 0.6rem' }}>
                                Aperçu
                              </button>
                            )}
                            <button className="secondary small" onClick={() => void downloadAttachment(a)} style={{ padding: '0.35rem 0.6rem' }}>
                              Télécharger
                            </button>
                            {!readOnly && (
                              <button className="secondary small" onClick={() => void removeAttachment(a)} style={{ padding: '0.35rem 0.6rem', color: 'var(--danger)' }}>
                                Supprimer
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {attachments.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '1.25rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                        <p className="text-muted small" style={{ margin: 0 }}>Aucun fichier.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', background: 'rgba(30, 41, 59, 0.35)' }}>
                  <div className="flex-between" style={{ marginBottom: '1rem' }}>
                    <div className="flex-center" style={{ gap: '0.5rem', fontWeight: 800 }}>
                      <Activity size={16} /> Historique
                    </div>
                    <span className="badge badge-blue">{activityLogs.length}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activityLogs.map((a) => (
                      <div key={a.id} style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.75rem', background: 'rgba(15, 23, 42, 0.5)' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{activityLabel(a)}</div>
                        <div className="text-muted x-small" style={{ marginTop: '0.25rem' }}>
                          {a.user ? `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim() || a.user.email : '—'} • {formatDateTime(a.createdAt)}
                        </div>
                      </div>
                    ))}
                    {activityLogs.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '1.25rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                        <p className="text-muted small" style={{ margin: 0 }}>Aucun événement.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
                  </>
              );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Preview modal ──────────────────────────────────────────────────── */}
      {preview && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
          onClick={closePreview}
        >
          <div
            style={{
              position: 'relative', maxWidth: '90vw', maxHeight: '90vh',
              background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--glass-border)',
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px' }}>
                {preview.name}
              </span>
              <button className="secondary small" onClick={closePreview} style={{ padding: '4px 8px', marginLeft: '12px' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              {preview.mime.startsWith('image/') ? (
                <img
                  src={preview.url}
                  alt={preview.name}
                  style={{ maxWidth: '80vw', maxHeight: '75vh', display: 'block', borderRadius: 'var(--radius-sm)' }}
                />
              ) : (
                <iframe
                  src={preview.url}
                  title={preview.name}
                  style={{ width: '80vw', height: '75vh', border: 'none', borderRadius: 'var(--radius-sm)' }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

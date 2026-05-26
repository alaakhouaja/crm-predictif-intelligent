import React, { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  RefreshCw, 
  FileUp, 
  BrainCircuit, 
  Search as SearchIcon, 
  UserPlus,
  TrendingUp,
  Target,
  CheckCircle,
  AlertTriangle,
  Mail,
  Phone,
  Building2,
  Calendar,
  MoreVertical,
  X,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Lead, LeadStage, PaginatedResponse, Interaction, InteractionType, Task } from '../types';

const stages: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST',
];

const interactionTypes: InteractionType[] = ['EMAIL', 'CALL', 'MEETING', 'NOTE'];

export function LeadsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [filter] = useState<LeadStage | ''>('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [showArchived, setShowArchived] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Formulaire Lead (Creation)
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createCompany, setCreateCompany] = useState('');
  const [createSource, setCreateSource] = useState('site web');
    const [createNotes, setCreateNotes] = useState('');
    // Gestion des interactions et sélection
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [newInteractionContent, setNewInteractionContent] = useState('');
  const [newInteractionType, setNewInteractionType] = useState<InteractionType>('NOTE');
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Modaux
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // États d'édition
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editStage, setEditStage] = useState<LeadStage>('NEW');

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      let url = `/leads?page=${page}&limit=10`;
      if (filter) url += `&stage=${filter}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      url += `&archived=${showArchived ? 'true' : 'false'}`;
      
      const res = await api<PaginatedResponse<Lead>>(url);
      if (res) {
        setLeads(res.data);
        setTotalLeads(res.total);
        setLastPage(res.lastPage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement');
    } finally {
      setLoading(false);
    }
  }, [filter, page, search, showArchived, user]);

  async function onExportAiDataset() {
    if (!user) return;
    try {
      const data = await api<{
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
        company: string | null;
        source: string | null;
        stage: LeadStage;
        score: number | null;
        conversionProbability: number | null;
        ownerEmail: string;
        interactionsCount: number;
        createdAt: string;
        updatedAt: string;
        label: number;
      }[]>('/leads/export-ai');
      const headers = [
        'firstName',
        'lastName',
        'email',
        'phone',
        'company',
        'source',
        'stage',
        'score',
        'conversionProbability',
        'ownerEmail',
        'interactionsCount',
        'createdAt',
        'updatedAt',
        'label',
      ];
      const escapeCsv = (value: unknown) => {
        const text = value == null ? '' : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      };
      const rows = data.map((row) =>
        headers.map((header) => escapeCsv(row[header as keyof typeof row])).join(','),
      );
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `dataset_ia_leads_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors de l'export du dataset IA");
    }
  }

  async function onExportLeadCsv() {
    if (!selectedLead) return;
    try {
      const headers = [
        'firstName',
        'lastName',
        'email',
        'phone',
        'company',
        'source',
        'stage',
        'score',
        'conversionProbability',
        'ownerEmail',
        'createdAt',
        'updatedAt',
        'notes',
        'interactionsCount',
      ];
      const row = {
        firstName: selectedLead.firstName,
        lastName: selectedLead.lastName,
        email: selectedLead.email,
        phone: selectedLead.phone,
        company: selectedLead.company,
        source: selectedLead.source,
        stage: selectedLead.stage,
        score: selectedLead.score,
        conversionProbability: selectedLead.conversionProbability,
        ownerEmail: selectedLead.owner?.email ?? '',
        createdAt: selectedLead.createdAt,
        updatedAt: selectedLead.updatedAt,
        notes: selectedLead.notes ?? '',
        interactionsCount: interactions.length,
      };
      const escapeCsv = (value: unknown) => {
        const text = value == null ? '' : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      };
      const csvContent =
        '\uFEFF' +
        [
          headers.join(','),
          headers.map((header) => escapeCsv(row[header as keyof typeof row])).join(','),
        ].join('\n');
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const safeName = `${selectedLead.firstName}_${selectedLead.lastName}`
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `lead_${safeName || selectedLead.id}_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de l\'exportation');
    }
  }

  async function onImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const formData = new FormData();
    formData.append('file', file);

    setLoading(true);
    try {
      const res = await api<{ message: string }>('/leads/import', {
        method: 'POST',
        body: formData,
        // Ne pas mettre de Content-Type ici pour que fetch le gère automatiquement avec le boundary
        headers: {} 
      });
      if (res) {
        alert(res.message);
        await load();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'importation');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const loadInteractions = useCallback(async (leadId: string) => {
    if (!user) return;
    setLoadingInteractions(true);
    try {
      const res = await api<PaginatedResponse<Interaction>>(
        `/interactions?leadId=${leadId}&limit=50`,
      );
      if (res && res.data) {
        setInteractions(res.data);
      } else {
        setInteractions([]);
      }
    } catch (err) {
      console.error('Erreur interactions:', err);
      setInteractions([]);
    } finally {
      setLoadingInteractions(false);
    }
  }, [user]);

  const loadTasks = useCallback(async (leadId: string) => {
    if (!user) return;
    setLoadingTasks(true);
    try {
      const res = await api<PaginatedResponse<Task>>(
        `/tasks?leadId=${leadId}&limit=20`,
      );
      if (res && res.data) {
        setTasks(res.data);
      } else {
        setTasks([]);
      }
    } catch (err) {
      console.error('Erreur tâches:', err);
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== search) {
      setSearch(urlSearch);
      setPage(1);
    }
  }, [searchParams, search]);

  const canCreateLead = user?.role === 'ADMIN' || user?.role === 'SALES' || user?.role === 'MARKETING';
  const canEditLead = user?.role === 'ADMIN' || user?.role === 'SALES' || user?.role === 'MARKETING';
  const canEditCommercial = user?.role === 'ADMIN' || user?.role === 'SALES';
  const canArchive = user?.role === 'ADMIN';
  const canDeleteLead = user?.role === 'ADMIN';
  const canExportLead = !!user;
  const canExportAiDataset = user?.role === 'ADMIN' || user?.role === 'EXECUTIVE';
  const canAddInteraction = user?.role === 'ADMIN' || user?.role === 'SALES';
  const canAddTask = user?.role === 'ADMIN' || user?.role === 'SALES' || user?.role === 'MARKETING';
  const canUpdateTask = (t: Task) => {
    if (!user || user.role === 'EXECUTIVE') return false;
    if (user.role === 'ADMIN') return true;
    return t.createdById === user.id || t.assignedToId === user.id;
  };

  useEffect(() => {
    if (selectedLead) {
      void loadInteractions(selectedLead.id);
      void loadTasks(selectedLead.id);
      setIsEditModalOpen(false); // Reset edit modal on lead change
      setEditFirstName(selectedLead.firstName);
      setEditLastName(selectedLead.lastName);
      setEditEmail(selectedLead.email);
      setEditPhone(selectedLead.phone || '');
      setEditCompany(selectedLead.company || '');
      setEditSource(selectedLead.source || '');
      setEditNotes(selectedLead.notes || '');
      setEditStage(selectedLead.stage);
    } else {
      setInteractions([]);
      setTasks([]);
      setNewTaskTitle('');
      setNewTaskDueDate('');
      setIsEditModalOpen(false);
    }
  }, [loadInteractions, loadTasks, selectedLead]);

  async function onUpdateLead(e: FormEvent) {
    e.preventDefault();
    if (!user || !selectedLead) return;
    try {
      const payload: Record<string, unknown> = {
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
        phone: editPhone || null,
        company: editCompany || null,
        source: editSource || null,
        notes: editNotes || null,
      };
      if (canEditCommercial) payload.stage = editStage;

      const updated = await api<Lead>(`/leads/${selectedLead.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setSelectedLead(updated);
      setIsEditModalOpen(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Modification impossible');
    }
  }

  async function onArchiveLead() {
    if (!user || !selectedLead || !window.confirm('Archiver ce lead ?')) return;
    try {
      const updated = await api<Lead>(`/leads/${selectedLead.id}/archive`, {
        method: 'POST',
      });
      setSelectedLead(updated);
      await load();
    } catch {
      alert('Erreur lors de l\'archivage');
    }
  }

  async function onUnarchiveLead() {
    if (!user || !selectedLead || !window.confirm('Désarchiver ce lead ?')) return;
    try {
      const updated = await api<Lead>(`/leads/${selectedLead.id}/unarchive`, {
        method: 'POST',
      });
      setSelectedLead(updated);
      await load();
    } catch {
      alert('Erreur lors du désarchivage');
    }
  }

  async function onDeleteLead() {
    if (!user || !selectedLead || !window.confirm('Supprimer ce lead définitivement ?')) return;
    try {
      await api<Lead>(`/leads/${selectedLead.id}`, {
        method: 'DELETE',
      });
      setSelectedLead(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  }

  async function onCreateLead(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    try {
      await api<Lead>('/leads', {
        method: 'POST',
        body: JSON.stringify({
          firstName: createFirstName,
          lastName: createLastName,
          email: createEmail,
          phone: createPhone || undefined,
          company: createCompany || undefined,
          source: createSource || undefined,
          notes: createNotes || undefined,
        }),
      });
      setCreateFirstName('');
      setCreateLastName('');
      setCreateEmail('');
      setCreatePhone('');
      setCreateCompany('');
      setCreateSource('site web');
      setCreateNotes('');
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible');
    }
  }

  async function onCreateInteraction(e: FormEvent) {
    e.preventDefault();
    if (!user || !selectedLead || !newInteractionContent) return;
    try {
      await api<Interaction>('/interactions', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          type: newInteractionType,
          content: newInteractionContent,
        }),
      });
      setNewInteractionContent('');
      await loadInteractions(selectedLead.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur création interaction');
    }
  }

  async function onCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!user || !selectedLead || !newTaskTitle || !canAddTask) return;
    try {
      await api<Task>('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: newTaskTitle,
          leadId: selectedLead.id,
          dueDate: newTaskDueDate ? new Date(newTaskDueDate).toISOString() : undefined,
          type: user?.role === 'MARKETING' ? 'MARKETING' : 'SALES',
        }),
      });
      setNewTaskTitle('');
      setNewTaskDueDate('');
      await loadTasks(selectedLead.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur création tâche');
    }
  }

  async function markTaskDone(id: string) {
    if (!user || !selectedLead) return;
    try {
      await api<Task>(`/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'DONE' }),
      });
      await loadTasks(selectedLead.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Mise à jour impossible');
    }
  }

  return (
    <div className="leads-page">
      {/* Header with quick actions */}
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div className="row-gap">
          <button className="secondary small" onClick={() => window.location.reload()}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            className="secondary small"
            onClick={() => { setShowArchived(v => !v); setSelectedLead(null); setPage(1); }}
            style={{ color: showArchived ? 'var(--warning)' : undefined }}
          >
            {showArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
            {showArchived ? 'Archivés' : 'Actifs'}
          </button>
          {canCreateLead && (
            <button className="primary glow-effect" onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={18} /> Nouveau Prospect
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="card" 
              style={{ width: '100%', maxWidth: '600px', padding: '2.5rem' }}
            >
              <div className="flex-between" style={{ marginBottom: '2rem' }}>
                <h2 style={{ margin: 0 }}>Nouveau Prospect</h2>
                <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X /></button>
              </div>

              <form onSubmit={async (e) => { await onCreateLead(e); setIsCreateModalOpen(false); }} className="grid-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                 <div className="form-group">
                   <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Prénom</label>
                   <input value={createFirstName} onChange={e => setCreateFirstName(e.target.value)} required placeholder="Jean" />
                 </div>
                 <div className="form-group">
                   <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Nom</label>
                   <input value={createLastName} onChange={e => setCreateLastName(e.target.value)} required placeholder="Dupont" />
                 </div>
                 <div className="form-group" style={{ gridColumn: 'span 2' }}>
                   <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Email Professionnel</label>
                   <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} required placeholder="jean.dupont@entreprise.com" />
                 </div>
                 <div className="form-group">
                   <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Téléphone</label>
                   <input value={createPhone} onChange={e => setCreatePhone(e.target.value)} placeholder="+33 6..." />
                 </div>
                 <div className="form-group">
                   <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Entreprise</label>
                   <input value={createCompany} onChange={e => setCreateCompany(e.target.value)} placeholder="NexGen Inc." />
                 </div>
                 <div className="form-group" style={{ gridColumn: 'span 2' }}>
                   <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Notes initiales</label>
                   <textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} placeholder="Besoin identifié..." style={{ minHeight: '80px' }} />
                 </div>
                
                <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button type="submit" className="primary" style={{ flex: 1 }}>Créer le profil</button>
                  <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsCreateModalOpen(false)}>Annuler</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stats Dashboard Section */}
      <div className="stat-grid">
        {[
          { label: 'Total Leads', value: totalLeads, icon: UserPlus, color: '#7c3aed', trend: '+12%', bg: 'rgba(124, 58, 237, 0.1)' },
          { label: 'Conversion', value: '24.5%', icon: TrendingUp, color: '#10b981', trend: 'Objectif 30%', bg: 'rgba(16, 185, 129, 0.1)' },
          { label: 'Qualifiés', value: leads.filter(l => l.stage === 'QUALIFIED').length, icon: Target, color: '#f59e0b', trend: 'En cours', bg: 'rgba(245, 158, 11, 0.1)' },
          { label: 'Gagnés', value: leads.filter(l => l.stage === 'WON').length, icon: CheckCircle, color: '#059669', trend: 'Trimestre', bg: 'rgba(5, 150, 105, 0.1)' }
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="card stat-card"
            style={{ borderLeftColor: stat.color }}
          >
            <div className="flex-between">
              <span className="label text-muted" style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>{stat.label}</span>
              <div style={{ padding: '0.5rem', background: stat.bg, borderRadius: '12px' }}>
                <stat.icon size={20} color={stat.color} />
              </div>
            </div>
            <div className="value">{stat.value}</div>
            <div className="small" style={{ marginTop: '0.5rem' }}>
              <span style={{ color: stat.color, fontWeight: 700 }}>{stat.trend}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid-main" style={{ gridTemplateColumns: selectedLead ? '1fr 450px' : '1fr' }}>
        <div className="main-content">
          <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }} className="flex-between">
              <div className="flex-center">
                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Portefeuille Prospects</h2>
                <span className="badge badge-blue">{totalLeads} {showArchived ? 'archivés' : 'actifs'}</span>
              </div>
              <div className="row-gap">
                {(user?.role === 'ADMIN' || user?.role === 'MARKETING') && (
                  <button className="secondary small" onClick={() => fileInputRef.current?.click()}>
                    <FileUp size={14} /> Import
                    <input type="file" accept=".csv" ref={fileInputRef} style={{ display: 'none' }} onChange={onImportCSV} />
                  </button>
                )}
                {canExportAiDataset && (
                  <button className="secondary small" onClick={() => void onExportAiDataset()}>
                    <BrainCircuit size={14} /> Exporter dataset IA
                  </button>
                )}
                <div style={{ position: 'relative' }}>
                  <SearchIcon size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="search" 
                    placeholder="Filtrer..." 
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    style={{ paddingLeft: '36px', width: '200px', fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.4)' }}
                  />
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Prospect</th>
                    <th>Entreprise</th>
                    <th>Statut</th>
                    <th>Score IA</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <motion.tr 
                      layout
                      key={l.id} 
                      className={selectedLead?.id === l.id ? 'active' : ''}
                      onClick={() => setSelectedLead(l)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="flex-center">
                          <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '12px', 
                            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 800, 
                            color: 'white',
                            boxShadow: 'var(--shadow-sm)'
                          }}>
                            {l.firstName[0]}{l.lastName[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{l.firstName} {l.lastName}</div>
                            <div className="text-muted" style={{ fontSize: '0.75rem' }}>{l.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex-center small text-muted">
                          <Building2 size={14} />
                          {l.company || '—'}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${
                          l.stage === 'WON' ? 'badge-green' : 
                          l.stage === 'LOST' ? 'badge-red' : 
                          l.stage === 'NEW' ? 'badge-blue' : 'badge-orange'
                        }`}>
                          {l.stage}
                        </span>
                      </td>
                      <td>
                        {l.score ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div className="flex-between x-small">
                              <span style={{ fontWeight: 800, color: l.score > 7 ? 'var(--success)' : 'var(--text-main)' }}>{l.score * 10}%</span>
                            </div>
                            <div style={{ width: '80px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${l.score * 10}%` }}
                                style={{ 
                                  height: '100%', 
                                  background: l.score > 7 
                                    ? 'linear-gradient(90deg, #10b981, #34d399)' 
                                    : 'linear-gradient(90deg, var(--primary), var(--primary-light))' 
                                }} 
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted x-small">Calcul en cours...</span>
                        )}
                      </td>
                      <td>
                        <button className="secondary small" style={{ padding: '0.4rem' }}>
                          <MoreVertical size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
              <button 
                className="secondary small" 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >Précédent</button>
              <div className="flex-center small text-muted" style={{ padding: '0 1rem' }}>
                Page {page} sur {lastPage}
              </div>
              <button 
                className="secondary small" 
                disabled={page === lastPage}
                onClick={() => setPage(p => p + 1)}
              >Suivant</button>
            </div>
          </section>
        </div>

        <AnimatePresence>
          {selectedLead && (
            <motion.aside 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 50, opacity: 0 }}
              className="side-panel"
            >
              <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                {/* Profile Header */}
                <div style={{ 
                  padding: '2.5rem 2rem', 
                  background: 'linear-gradient(to bottom, rgba(124, 58, 237, 0.1), transparent)', 
                  borderBottom: '1px solid var(--border)', 
                  textAlign: 'center', 
                  position: 'relative' 
                }}>
                  <button 
                    onClick={() => setSelectedLead(null)} 
                    style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} />
                  </button>
                  
                  <div style={{ 
                    width: '90px', 
                    height: '90px', 
                    borderRadius: '28px', 
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', 
                    margin: '0 auto 1.5rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '2rem', 
                    fontWeight: 800, 
                    color: 'white', 
                    boxShadow: 'var(--glow-primary)',
                    border: '4px solid rgba(255,255,255,0.1)'
                  }}>
                    {selectedLead.firstName[0]}{selectedLead.lastName[0]}
                  </div>
                  
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem' }}>{selectedLead.firstName} {selectedLead.lastName}</h3>
                  <div className="flex-center" style={{ justifyContent: 'center' }}>
                    <Building2 size={14} className="text-muted" />
                    <span className="text-muted small">{selectedLead.company || 'Indépendant'}</span>
                  </div>
                  
                  <div className="flex-center" style={{ justifyContent: 'center', marginTop: '2rem', gap: '0.75rem' }}>
                    {canEditLead && (
                      <button className="primary small" onClick={() => setIsEditModalOpen(true)} disabled={!!selectedLead.isAnonymized}>
                        <Edit2 size={14} /> Éditer
                      </button>
                    )}
                    {canArchive && !selectedLead.isAnonymized && (
                      <button className="secondary small" style={{ color: 'var(--warning)' }} onClick={() => void onArchiveLead()}>
                        <Archive size={14} />
                      </button>
                    )}
                    {canArchive && !!selectedLead.isAnonymized && (
                      <button className="secondary small" style={{ color: 'var(--warning)' }} onClick={() => void onUnarchiveLead()}>
                        <ArchiveRestore size={14} />
                      </button>
                    )}
                    {canDeleteLead && (
                      <button className="secondary small" style={{ color: 'var(--danger)' }} onClick={() => void onDeleteLead()}>
                        <Trash2 size={14} />
                      </button>
                    )}
                    {canExportLead && (
                      <button className="secondary small" onClick={() => void onExportLeadCsv()}>
                        <BrainCircuit size={14} /> Exporter ce lead
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit Modal */}
                <AnimatePresence>
                  {isEditModalOpen && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                      <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="card" 
                        style={{ width: '100%', maxWidth: '600px', padding: '2.5rem' }}
                      >
                        <div className="flex-between" style={{ marginBottom: '2rem' }}>
                          <h2 style={{ margin: 0 }}>Modifier le profil</h2>
                          <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X /></button>
                        </div>

                        <form onSubmit={async (e) => { await onUpdateLead(e); setIsEditModalOpen(false); }} className="grid-form" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div className="form-group">
                            <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Prénom</label>
                            <input value={editFirstName} onChange={e => setEditFirstName(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Nom</label>
                            <input value={editLastName} onChange={e => setEditLastName(e.target.value)} required />
                          </div>
                          <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Email</label>
                            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required />
                          </div>
                          <div className="form-group">
                            <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Étape Pipeline</label>
                            <select value={editStage} onChange={e => setEditStage(e.target.value as LeadStage)} disabled={!canEditCommercial}>
                              {stages.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase' }}>Entreprise</label>
                            <input value={editCompany} onChange={e => setEditCompany(e.target.value)} />
                          </div>
                          
                          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button type="submit" className="primary" style={{ flex: 1 }}>Sauvegarder</button>
                            <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setIsEditModalOpen(false)}>Fermer</button>
                          </div>
                        </form>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                {/* Content Tabs Area */}
                <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
                    {[
                      { icon: Mail, label: 'Email', value: selectedLead.email },
                      { icon: Phone, label: 'Téléphone', value: selectedLead.phone || '—' },
                      { icon: Target, label: 'Source', value: selectedLead.source || 'Direct' },
                      { icon: Calendar, label: 'Dernier Contact', value: new Date(selectedLead.createdAt).toLocaleDateString() }
                    ].map(item => (
                      <div key={item.label}>
                        <div className="text-muted x-small" style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>{item.label}</div>
                        <div className="flex-center small" style={{ fontWeight: 600 }}>
                          <item.icon size={14} color="var(--primary)" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginBottom: '2.5rem' }}>
                    <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Tâches</h4>
                      <span className="badge badge-blue">{tasks.length}</span>
                    </div>

                    {canAddTask && !selectedLead.isAnonymized ? (
                      <form onSubmit={onCreateTask} style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <input
                          placeholder="Nouvelle tâche..."
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          required
                          style={{ gridColumn: 'span 2', background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--glass-border)' }}
                        />
                        <input
                          type="datetime-local"
                          value={newTaskDueDate}
                          onChange={(e) => setNewTaskDueDate(e.target.value)}
                          style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--glass-border)' }}
                        />
                        <button type="submit" className="primary small" style={{ padding: '0.4rem 0.8rem' }}>
                          <Plus size={14} /> Ajouter
                        </button>
                      </form>
                    ) : (
                      <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-muted small" style={{ margin: 0 }}>
                          {selectedLead.isAnonymized ? 'Lead archivé : tâches désactivées.' : 'Accès en lecture seule aux tâches.'}
                        </p>
                      </div>
                    )}

                    <div className="interactions-list">
                      {loadingTasks ? (
                        <div className="flex-center" style={{ padding: '1.5rem', justifyContent: 'center' }}>
                          <RefreshCw size={24} className="animate-spin text-muted" />
                        </div>
                      ) : (
                        tasks.map((t, idx) => {
                          const isOverdue =
                            (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
                            t.dueDate &&
                            new Date(t.dueDate).getTime() < Date.now();
                          return (
                            <motion.div
                              key={t.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04 }}
                              className="interaction-item"
                            >
                              <div className="flex-between" style={{ marginBottom: '0.5rem' }}>
                                <span className={`badge ${t.type === 'MARKETING' ? 'badge-orange' : 'badge-blue'}`} style={{ fontSize: '0.6rem' }}>
                                  {t.type}
                                </span>
                                <div className="flex-center" style={{ gap: '0.5rem' }}>
                                  <span className={`badge ${
                                    t.status === 'DONE' ? 'badge-green' :
                                    t.status === 'CANCELED' ? 'badge-red' : 'badge-blue'
                                  }`} style={{ fontSize: '0.6rem' }}>
                                    {t.status}
                                  </span>
                                  <span className="text-muted x-small">
                                    {t.dueDate ? new Date(t.dueDate).toLocaleString() : '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex-between" style={{ gap: '0.75rem' }}>
                                <div style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'var(--text-main)', fontWeight: 600 }}>
                                  <span className="flex-center" style={{ gap: '0.5rem' }}>
                                    {isOverdue && <AlertTriangle size={14} color="var(--danger)" />}
                                    {t.title}
                                  </span>
                                </div>
                                {canUpdateTask(t) && t.status === 'OPEN' && (
                                  <button className="secondary small" onClick={() => void markTaskDone(t.id)} style={{ padding: '0.3rem 0.6rem', color: 'var(--success)' }}>
                                    <CheckCircle size={14} /> Fait
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })
                      )}

                      {tasks.length === 0 && !loadingTasks && (
                        <div style={{ textAlign: 'center', padding: '1.5rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                          <p className="text-muted small">Aucune tâche sur ce lead.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="interactions-section">
                    <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Journal d'activités</h4>
                      <span className="badge badge-blue">{interactions.length}</span>
                    </div>
                    
                    {canAddInteraction && !selectedLead.isAnonymized ? (
                      <form onSubmit={onCreateInteraction} className="interaction-form" style={{ marginBottom: '2rem' }}>
                        <div style={{ position: 'relative' }}>
                          <textarea 
                            placeholder="Notez une interaction..."
                            value={newInteractionContent}
                            onChange={(e) => setNewInteractionContent(e.target.value)}
                            required
                            style={{ 
                              background: 'rgba(15, 23, 42, 0.4)', 
                              border: '1px solid var(--glass-border)', 
                              fontSize: '0.85rem', 
                              minHeight: '100px',
                              padding: '1rem',
                              resize: 'none'
                            }}
                          />
                          <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                            <select 
                              value={newInteractionType} 
                              onChange={(e) => setNewInteractionType(e.target.value as InteractionType)}
                              style={{ width: 'auto', padding: '0.3rem 0.6rem', fontSize: '0.7rem', background: 'var(--bg-main)' }}
                            >
                              {interactionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button type="submit" className="primary small" style={{ padding: '0.3rem 0.8rem' }}>Poster</button>
                          </div>
                        </div>
                      </form>
                    ) : (
                      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-muted small" style={{ margin: 0 }}>
                          {selectedLead.isAnonymized ? 'Lead archivé : interactions désactivées.' : 'Accès en lecture seule aux interactions.'}
                        </p>
                      </div>
                    )}

                    <div className="interactions-list">
                      {loadingInteractions ? (
                        <div className="flex-center" style={{ padding: '2rem', justifyContent: 'center' }}><RefreshCw size={24} className="animate-spin text-muted" /></div>
                      ) : (
                        interactions.map((i, idx) => (
                          <motion.div 
                            key={i.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="interaction-item"
                          >
                            <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                              <span className={`badge ${
                                i.type === 'CALL' ? 'badge-orange' : 
                                i.type === 'EMAIL' ? 'badge-blue' : 'badge-green'
                              }`} style={{ fontSize: '0.6rem' }}>{i.type}</span>
                              <span className="text-muted x-small">{new Date(i.createdAt).toLocaleString()}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.6', color: 'var(--text-main)' }}>{i.content}</p>
                          </motion.div>
                        ))
                      )}
                      {interactions.length === 0 && !loadingInteractions && (
                        <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                          <p className="text-muted small">Aucun historique pour le moment.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

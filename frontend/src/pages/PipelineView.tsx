import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Building2,
  Calendar,
  Filter,
  X,
  User,
  Mail,
  Phone,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Lead, LeadStage, PaginatedResponse } from '../types';

const stages: LeadStage[] = [
  'Nouveau',
  'Contacte',
  'Qualifie',
  'Proposition',
  'Gagne',
  'Perdu',
];

const stageColors: Record<LeadStage, string> = {
  Nouveau: '#7c3aed',
  Contacte: '#6366f1',
  Qualifie: '#f59e0b',
  Proposition: '#ec4899',
  Gagne: '#10b981',
  Perdu: '#ef4444',
};

function emptyGroups(): Record<LeadStage, Lead[]> {
  return {
    Nouveau: [],
    Contacte: [],
    Qualifie: [],
    Proposition: [],
    Gagne: [],
    Perdu: [],
  };
}

function ownerInitials(lead: Lead): string {
  const first = lead.owner?.firstName?.[0] ?? '';
  const last = lead.owner?.lastName?.[0] ?? '';
  return (first + last).toUpperCase() || lead.owner?.email?.[0]?.toUpperCase() ?? '?';
}

export function PipelineView() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<LeadStage | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [onlyWithCompany, setOnlyWithCompany] = useState(false);
  const [hiddenStages, setHiddenStages] = useState<Set<LeadStage>>(new Set());
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const canMoveLeads = user?.role === 'ADMIN' || user?.role === 'SALES';

  const loadLeads = useCallback(
    async (silent = false) => {
      if (!user) return;
      if (!silent) setLoading(true);
      try {
        const pageSize = 100;
        const firstPage = await api<PaginatedResponse<Lead>>(`/leads?limit=${pageSize}&page=1`);
        const allLeads = [...(firstPage?.data ?? [])];

        if ((firstPage?.lastPage ?? 1) > 1) {
          const remainingPages = Array.from(
            { length: (firstPage?.lastPage ?? 1) - 1 },
            (_, index) => index + 2,
          );
          const pageResponses = await Promise.all(
            remainingPages.map((page) =>
              api<PaginatedResponse<Lead>>(`/leads?limit=${pageSize}&page=${page}`),
            ),
          );
          allLeads.push(...pageResponses.flatMap((pageResponse) => pageResponse?.data ?? []));
        }

        setLeads(allLeads);
        setLastRefreshAt(new Date().toLocaleTimeString('fr-FR'));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur chargement');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoreValue = minScore.trim() === '' ? null : Number(minScore);

    return leads.filter((lead) => {
      if (query) {
        const haystack = [lead.firstName, lead.lastName, lead.email, lead.company ?? '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (scoreValue !== null) {
        if (Number.isNaN(scoreValue)) return false;
        if ((lead.score ?? 0) < scoreValue) return false;
      }
      if (onlyWithCompany && !lead.company) return false;
      return true;
    });
  }, [leads, minScore, onlyWithCompany, search]);

  const leadsByStage = useMemo(() => {
    const groups = emptyGroups();
    for (const lead of filteredLeads) {
      groups[lead.stage].push(lead);
    }
    return groups;
  }, [filteredLeads]);

  const visibleStages = useMemo(
    () => stages.filter((s) => !hiddenStages.has(s)),
    [hiddenStages],
  );

  function toggleStage(stage: LeadStage) {
    setHiddenStages((prev) => {
      const next = new Set(prev);
      if (next.has(stage)) next.delete(stage);
      else next.add(stage);
      return next;
    });
  }

  // dataTransfer est owned par le navigateur → immune aux stale closures React
  function onDragStart(e: React.DragEvent, leadId: string) {
    if (!canMoveLeads) return;
    e.dataTransfer.setData('text/plain', leadId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLeadId(leadId);
    setError(null);
  }

  function onDragEnd() {
    setDraggedLeadId(null);
    setDragOverStage(null);
  }

  // leadId passé en paramètre (lu depuis dataTransfer) — plus de dépendance à la closure
  async function moveLeadToStage(destStage: LeadStage, leadId: string) {
    if (!canMoveLeads || !leadId) return;
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.stage === destStage) return;

    const previousLeads = leads;
    const previousSelected = selectedLead;
    setSavingId(leadId);
    setError(null);

    // Optimistic update
    setLeads((prev) =>
      prev.map((item) => (item.id === leadId ? { ...item, stage: destStage } : item)),
    );

    if (selectedLead?.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, stage: destStage } : prev));
    }

    try {
      if (!user) throw new Error('Session invalide, reconnectez-vous.');
      await api(`/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage: destStage }),
      });
    } catch (err) {
      setLeads(previousLeads);
      setSelectedLead(previousSelected);
      setError(err instanceof Error ? err.message : 'Erreur sauvegarde');
    } finally {
      setSavingId(null);
    }
  }

  if (loading && leads.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <RefreshCw size={48} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className={`pipeline-view${draggedLeadId ? ' is-dragging' : ''}`}>
      {/* ── Header ── */}
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div className="row-gap">
          {/* FIX #1 : appelle loadLeads() au lieu de window.location.reload() */}
          <button
            className="secondary small"
            onClick={() => void loadLeads()}
            disabled={!!savingId || loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>

          {!canMoveLeads ? (
            <span
              className="badge x-small"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                borderRadius: '10px',
              }}
            >
              Lecture seule
            </span>
          ) : null}

          <button
            className="secondary small"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <Filter size={14} /> Filtres {filtersOpen ? '▲' : '▼'}
          </button>

          {savingId ? (
            <span
              className="badge x-small"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '10px' }}
            >
              Sauvegarde...
            </span>
          ) : null}

          {lastRefreshAt ? (
            <span
              className="badge x-small"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '10px' }}
            >
              Maj : {lastRefreshAt}
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="muted" style={{ color: 'var(--danger)', fontWeight: 700 }}>
            {error}
          </div>
        ) : null}
      </div>

      {/* ── Filters ── */}
      {filtersOpen ? (
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 0.8fr auto auto',
              gap: '1rem',
              alignItems: 'end',
            }}
          >
            <label style={{ display: 'grid', gap: '0.4rem' }}>
              <span className="muted small">Recherche</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, email, entreprise"
              />
            </label>
            <label style={{ display: 'grid', gap: '0.4rem' }}>
              <span className="muted small">Score minimum</span>
              <input
                type="number"
                min="0"
                max="100"
                value={minScore}
                onChange={(e) => setMinScore(e.target.value)}
                placeholder="Ex: 50"
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minHeight: '46px' }}>
              <input
                type="checkbox"
                checked={onlyWithCompany}
                onChange={(e) => setOnlyWithCompany(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <span className="muted small">Avec entreprise</span>
            </label>
            <button
              className="secondary small"
              onClick={() => {
                setSearch('');
                setMinScore('');
                setOnlyWithCompany(false);
                setHiddenStages(new Set());
              }}
            >
              Reset
            </button>
          </div>

          {/* FIX #8 : filtre par stage */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted small" style={{ marginRight: '0.25rem' }}>Stages :</span>
            {stages.map((stage) => (
              <button
                key={stage}
                onClick={() => toggleStage(stage)}
                style={{
                  background: hiddenStages.has(stage)
                    ? 'rgba(255,255,255,0.04)'
                    : `${stageColors[stage]}22`,
                  color: hiddenStages.has(stage) ? 'var(--text-muted)' : stageColors[stage],
                  border: `1px solid ${hiddenStages.has(stage) ? 'var(--glass-border)' : stageColors[stage]}`,
                  padding: '3px 10px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textDecoration: hiddenStages.has(stage) ? 'line-through' : 'none',
                  transition: 'all 0.15s',
                } as React.CSSProperties}
              >
                {stage}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Pipeline + Detail panel ── */}
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div className="pipeline-container" style={{ flex: 1, minWidth: 0 }}>
          {visibleStages.map((stage) => {
            const stageLeads = leadsByStage[stage];
            const scoredLeads = stageLeads.filter((l) => l.score != null);
            const avgScore =
              scoredLeads.length > 0
                ? Math.round(scoredLeads.reduce((s, l) => s + (l.score ?? 0), 0) / scoredLeads.length)
                : null;

            return (
              <div key={stage} className="pipeline-column">
                {/* Column header */}
                <div
                  className="column-header"
                  style={{ borderTop: `4px solid ${stageColors[stage]}` }}
                >
                  <div className="flex-center">
                    <h3>{stage}</h3>
                    <span className="column-count">{stageLeads.length}</span>
                  </div>
                  {/* FIX #9 : score moyen par colonne */}
                  {avgScore !== null ? (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Moy. {avgScore}
                    </span>
                  ) : null}
                </div>

                {/* Drop zone */}
                <div
                  className="column-content"
                  style={{
                    background: dragOverStage === stage ? 'rgba(255,255,255,0.04)' : 'transparent',
                    outline: dragOverStage === stage ? `1px dashed ${stageColors[stage]}` : 'none',
                    outlineOffset: '-1px',
                    minHeight: '80px',
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!canMoveLeads) return;
                    // Évite les re-renders inutiles quand on est déjà sur ce stage
                    if (dragOverStage !== stage) setDragOverStage(stage);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    if (!canMoveLeads) return;
                    setDragOverStage(stage);
                  }}
                  onDragLeave={(e) => {
                    if (!canMoveLeads) return;
                    const current = e.currentTarget;
                    const related = e.relatedTarget as Node | null;
                    if (!related || !current.contains(related)) {
                      setDragOverStage((prev) => (prev === stage ? null : prev));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!canMoveLeads) return;
                    // Lit l'ID depuis dataTransfer — valeur garantie par le navigateur,
                    // pas depuis une closure React potentiellement périmée
                    const leadId = e.dataTransfer.getData('text/plain');
                    setDraggedLeadId(null);
                    setDragOverStage(null);
                    if (leadId) void moveLeadToStage(stage, leadId);
                  }}
                >
                  {/* FIX #5 : indicateur de drop sur colonne vide */}
                  {stageLeads.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontSize: '0.75rem',
                        padding: '1.5rem 0.5rem',
                        opacity: draggedLeadId && canMoveLeads ? 0.9 : 0.4,
                        border:
                          draggedLeadId && canMoveLeads
                            ? `1px dashed ${stageColors[stage]}70`
                            : 'none',
                        borderRadius: '8px',
                        transition: 'all 0.15s',
                      }}
                    >
                      {draggedLeadId && canMoveLeads ? 'Déposer ici' : 'Aucun lead'}
                    </div>
                  ) : null}

                  {stageLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`kanban-card${draggedLeadId === lead.id ? ' dragging' : ''}`}
                      draggable={canMoveLeads && savingId !== lead.id}
                      onDragStart={canMoveLeads ? (e) => onDragStart(e, lead.id) : undefined}
                      onDragEnd={canMoveLeads ? onDragEnd : undefined}
                      // FIX #4 : carte cliquable → panneau de détail
                      onClick={() =>
                        setSelectedLead((prev) => (prev?.id === lead.id ? null : lead))
                      }
                      style={{
                        borderColor:
                          selectedLead?.id === lead.id
                            ? stageColors[lead.stage]
                            : draggedLeadId === lead.id
                            ? stageColors[lead.stage]
                            : 'var(--glass-border)',
                        boxShadow:
                          selectedLead?.id === lead.id
                            ? `0 0 0 2px ${stageColors[lead.stage]}50`
                            : draggedLeadId === lead.id
                            ? `0 10px 30px -5px ${stageColors[lead.stage]}40`
                            : 'var(--shadow-sm)',
                        opacity: savingId === lead.id ? 0.75 : 1,
                        cursor: 'pointer',
                      }}
                    >
                      <h4>
                        {lead.firstName} {lead.lastName}
                      </h4>
                      <div className="company">
                        <Building2 size={12} />
                        <span>{lead.company || 'Indépendant'}</span>
                      </div>

                      <div className="footer">
                        <div className="flex-center x-small text-muted">
                          <Calendar size={12} />
                          <span>{new Date(lead.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {/* FIX #2 : score=0 doit s'afficher */}
                          {lead.score != null ? (
                            <div
                              className="badge x-small"
                              style={{
                                background: `${stageColors[lead.stage]}15`,
                                color: stageColors[lead.stage],
                                padding: '2px 6px',
                                borderRadius: '6px',
                              }}
                            >
                              {lead.score}
                            </div>
                          ) : null}
                          {/* FIX #6 : initiales du propriétaire */}
                          <div
                            title={
                              `${lead.owner?.firstName ?? ''} ${lead.owner?.lastName ?? ''}`.trim() ||
                              lead.owner?.email
                            }
                            style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              background: `${stageColors[lead.stage]}30`,
                              color: stageColors[lead.stage],
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.6rem',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {ownerInitials(lead)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── FIX #4 : Panneau de détail ── */}
        {selectedLead ? (
          <div
            className="card"
            style={{
              width: '280px',
              flexShrink: 0,
              position: 'sticky',
              top: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div className="flex-between">
              <h3 style={{ margin: 0 }}>Détails</h3>
              <button
                className="secondary small"
                style={{ padding: '4px 8px' }}
                onClick={() => setSelectedLead(null)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Stage */}
            <span
              style={{
                display: 'inline-block',
                background: `${stageColors[selectedLead.stage]}20`,
                color: stageColors[selectedLead.stage],
                border: `1px solid ${stageColors[selectedLead.stage]}40`,
                padding: '3px 10px',
                borderRadius: '10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                alignSelf: 'flex-start',
              }}
            >
              {selectedLead.stage}
            </span>

            {/* Identity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={14} className="text-muted" />
                <span style={{ fontWeight: 600 }}>
                  {selectedLead.firstName} {selectedLead.lastName}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={14} className="text-muted" />
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="muted small"
                  style={{ wordBreak: 'break-all' }}
                >
                  {selectedLead.email}
                </a>
              </div>
              {selectedLead.phone ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Phone size={14} className="text-muted" />
                  <span className="muted small">{selectedLead.phone}</span>
                </div>
              ) : null}
              {selectedLead.company ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={14} className="text-muted" />
                  <span className="muted small">{selectedLead.company}</span>
                </div>
              ) : null}
            </div>

            {/* Score bar */}
            {selectedLead.score != null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted small">Score</span>
                  <span style={{ fontWeight: 700, color: stageColors[selectedLead.stage] }}>
                    {selectedLead.score}/100
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: 'rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${selectedLead.score}%`,
                      background: stageColors[selectedLead.stage],
                      borderRadius: '3px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ) : null}

            {/* Conversion probability */}
            {selectedLead.conversionProbability != null ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted small">Proba. conversion</span>
                <span style={{ fontWeight: 600 }}>
                  {Math.round(selectedLead.conversionProbability * 100)}%
                </span>
              </div>
            ) : null}

            {/* Owner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted small">Responsable</span>
              <span className="small" style={{ fontWeight: 500 }}>
                {`${selectedLead.owner?.firstName ?? ''} ${selectedLead.owner?.lastName ?? ''}`.trim() ||
                  selectedLead.owner?.email}
              </span>
            </div>

            {/* Source */}
            {selectedLead.source ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="muted small">Source</span>
                <span className="small">{selectedLead.source}</span>
              </div>
            ) : null}

            {/* Notes */}
            {selectedLead.notes ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <span className="muted small">Notes</span>
                <p
                  className="small"
                  style={{
                    margin: 0,
                    padding: '0.5rem',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '6px',
                    lineHeight: 1.5,
                  }}
                >
                  {selectedLead.notes}
                </p>
              </div>
            ) : null}

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
              <span className="muted small">
                Créé le {new Date(selectedLead.createdAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

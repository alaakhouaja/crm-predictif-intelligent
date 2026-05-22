import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Building2,
  MoreVertical,
  Calendar,
  Filter,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { Lead, LeadStage, PaginatedResponse } from '../types';

const stages: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL',
  'WON',
  'LOST',
];

const stageColors: Record<LeadStage, string> = {
  NEW: '#7c3aed',
  CONTACTED: '#6366f1',
  QUALIFIED: '#f59e0b',
  PROPOSAL: '#ec4899',
  WON: '#10b981',
  LOST: '#ef4444',
};

function emptyGroups(): Record<LeadStage, Lead[]> {
  return {
    NEW: [],
    CONTACTED: [],
    QUALIFIED: [],
    PROPOSAL: [],
    WON: [],
    LOST: [],
  };
}

export function PipelineView() {
  const { token } = useAuth();
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
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const loadLeads = useCallback(
    async (silent = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const res = await api<PaginatedResponse<Lead>>('/leads?limit=100', {
          token,
        });
        setLeads(res?.data ?? []);
        setLastRefreshAt(new Date().toLocaleTimeString());
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur chargement');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoreValue = minScore.trim() === '' ? null : Number(minScore);

    return leads.filter((lead) => {
      if (query) {
        const haystack = [
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.company ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (scoreValue !== null) {
        if (Number.isNaN(scoreValue)) return false;
        if ((lead.score ?? 0) < scoreValue) return false;
      }

      if (onlyWithCompany && !lead.company) {
        return false;
      }

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

  function onDragStart(leadId: string) {
    setDraggedLeadId(leadId);
    setError(null);
  }

  function onDragEnd() {
    setDraggedLeadId(null);
    setDragOverStage(null);
  }

  async function moveLeadToStage(destStage: LeadStage) {
    if (!draggedLeadId) return;
    const lead = leads.find((item) => item.id === draggedLeadId);
    if (!lead) {
      setDraggedLeadId(null);
      setDragOverStage(null);
      return;
    }
    if (lead.stage === destStage) {
      setDraggedLeadId(null);
      setDragOverStage(null);
      return;
    }

    const previousLeads = leads;
    setSavingId(draggedLeadId);
    setError(null);
    setDraggedLeadId(null);
    setDragOverStage(null);

    setLeads((prev) => {
      const updated = prev.map((item) =>
        item.id === draggedLeadId ? { ...item, stage: destStage } : item,
      );
      // Keep the moved lead at the end of the destination column.
      updated.sort((a, b) => {
        if (a.id === draggedLeadId && b.stage === destStage && b.id !== draggedLeadId) {
          return 1;
        }
        if (b.id === draggedLeadId && a.stage === destStage && a.id !== draggedLeadId) {
          return -1;
        }
        return 0;
      });
      return updated;
    });

    try {
      if (!token) {
        throw new Error('Session invalide, reconnectez-vous.');
      }
      await api(`/leads/${draggedLeadId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ stage: destStage }),
      });
      await loadLeads(true);
    } catch (err) {
      setLeads(previousLeads);
      setError(err instanceof Error ? err.message : 'Erreur sauvegarde');
    } finally {
      setSavingId(null);
    }
  }

  if (loading && leads.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
        }}
      >
        <RefreshCw size={48} className="animate-spin text-muted" />
      </div>
    );
  }

  return (
    <div className={`pipeline-view${draggedLeadId ? ' is-dragging' : ''}`}>
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div className="row-gap">
          <button
            className="secondary small"
            onClick={() => void loadLeads(false)}
            disabled={!!savingId}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{' '}
            Actualiser
          </button>
          <button
            className="secondary small"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <Filter size={14} /> Filtres
          </button>
          {savingId ? (
            <span
              className="badge x-small"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                borderRadius: '10px',
              }}
            >
              Sauvegarde...
            </span>
          ) : null}
          {lastRefreshAt ? (
            <span
              className="badge x-small"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-muted)',
                padding: '4px 8px',
                borderRadius: '10px',
              }}
            >
              Maj: {lastRefreshAt}
            </span>
          ) : null}
        </div>
        {error ? (
          <div className="muted" style={{ color: 'var(--danger)', fontWeight: 700 }}>
            {error}
          </div>
        ) : null}
      </div>

      {filtersOpen ? (
        <div
          className="card"
          style={{
            marginBottom: '1.5rem',
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
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              minHeight: '46px',
            }}
          >
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
            }}
          >
            Reset
          </button>
        </div>
      ) : null}

      <div className="pipeline-container">
        {stages.map((stage) => (
          <div key={stage} className="pipeline-column">
            <div
              className="column-header"
              style={{ borderTop: `4px solid ${stageColors[stage]}` }}
            >
              <div className="flex-center">
                <h3>{stage}</h3>
                <span className="column-count">{leadsByStage[stage].length}</span>
              </div>
              <MoreVertical
                size={16}
                className="text-muted"
                style={{ cursor: 'pointer' }}
              />
            </div>

            <div
              className="column-content"
              style={{
                background:
                  dragOverStage === stage
                    ? 'rgba(255,255,255,0.04)'
                    : 'transparent',
                outline:
                  dragOverStage === stage
                    ? `1px dashed ${stageColors[stage]}`
                    : 'none',
                outlineOffset: '-1px',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (!draggedLeadId) return;
                setDragOverStage(stage);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                if (!draggedLeadId) return;
                setDragOverStage(stage);
              }}
              onDragLeave={(e) => {
                const current = e.currentTarget;
                const related = e.relatedTarget as Node | null;
                if (!related || !current.contains(related)) {
                  setDragOverStage((prev) => (prev === stage ? null : prev));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                void moveLeadToStage(stage);
              }}
            >
              {leadsByStage[stage].map((lead) => (
                <div
                  key={lead.id}
                  className={`kanban-card${
                    draggedLeadId === lead.id ? ' dragging' : ''
                  }`}
                  draggable={savingId !== lead.id}
                  onDragStart={() => onDragStart(lead.id)}
                  onDragEnd={onDragEnd}
                  style={{
                    borderColor:
                      draggedLeadId === lead.id
                        ? stageColors[lead.stage]
                        : 'var(--glass-border)',
                    boxShadow:
                      draggedLeadId === lead.id
                        ? `0 10px 30px -5px ${stageColors[lead.stage]}40`
                        : 'var(--shadow-sm)',
                    opacity: savingId === lead.id ? 0.75 : 1,
                  }}
                >
                  <h4>{lead.firstName} {lead.lastName}</h4>
                  <div className="company">
                    <Building2 size={12} />
                    <span>{lead.company || 'Independant'}</span>
                  </div>

                  <div className="footer">
                    <div className="flex-center x-small text-muted">
                      <Calendar size={12} />
                      <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                    </div>
                    {lead.score ? (
                      <div
                        className="badge x-small"
                        style={{
                          background: `${stageColors[lead.stage]}15`,
                          color: stageColors[lead.stage],
                          padding: '2px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        Score: {lead.score}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

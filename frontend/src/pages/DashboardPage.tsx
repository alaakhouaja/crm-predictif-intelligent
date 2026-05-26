import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Users, Target, CheckCircle, XCircle, Clock, BarChart2, Phone, Mail, MessageSquare } from 'lucide-react';
import { api } from '../api/client';

interface OverviewData {
  total: number;
  newLeads: number;
  contacted: number;
  qualified: number;
  proposal: number;
  won: number;
  lost: number;
  conversionRate: number;
  closed: number;
  avgScore: number | null;
}

interface PipelineStage {
  stage: string;
  label: string;
  count: number;
  percentage: number;
}

interface SourceData {
  source: string;
  count: number;
  percentage: number;
}

interface OwnerData {
  ownerId: string;
  ownerName: string;
  ownerRole: string;
  total: number;
  won: number;
  lost: number;
  newLeads: number;
  conversionRate: number;
}

interface ActivityData {
  id: string;
  type: string;
  subtype: string;
  content: string;
  user: string;
  lead: string;
  leadEmail?: string;
  createdAt: string;
}

const STAGE_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  CONTACTED: '#8b5cf6',
  QUALIFIED: '#f59e0b',
  PROPOSAL: '#f97316',
  WON: '#10b981',
  LOST: '#ef4444',
};

const INTERACTION_ICONS: Record<string, React.ReactNode> = {
  EMAIL: <Mail size={14} />,
  CALL: <Phone size={14} />,
  MEETING: <Users size={14} />,
  NOTE: <MessageSquare size={14} />,
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function DashboardPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [owners, setOwners] = useState<OwnerData[]>([]);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    setRefreshing(true);
    try {
      const [ov, pi, so, ow, ac] = await Promise.all([
        api<OverviewData>('/dashboard/overview'),
        api<PipelineStage[]>('/dashboard/pipeline'),
        api<SourceData[]>('/dashboard/by-source'),
        api<OwnerData[]>('/dashboard/by-owner'),
        api<ActivityData[]>('/dashboard/activity?limit=15'),
      ]);
      setOverview(ov);
      setPipeline(pi);
      setSources(so);
      setOwners(ow);
      setActivities(ac);
      setError(null);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Erreur lors du chargement du dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>Chargement du dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>Dashboard Commercial</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0' }}>Vue d'ensemble de la performance commerciale</p>
        </div>
        <button
          className="secondary small"
          onClick={() => window.location.reload()}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '20px', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="stat-grid">
        <div className="card stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="flex-between">
            <span className="label text-muted" style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Leads</span>
            <div style={{ padding: '0.5rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
              <Users size={18} color="#3b82f6" />
            </div>
          </div>
          <div className="value">{overview?.total ?? 0}</div>
          <div className="small" style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            {overview?.closed ?? 0} clos
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeftColor: '#10b981' }}>
          <div className="flex-between">
            <span className="label text-muted" style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Taux de Conversion</span>
            <div style={{ padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
              <TrendingUp size={18} color="#10b981" />
            </div>
          </div>
          <div className="value">{overview?.conversionRate ?? 0}%</div>
          <div className="small" style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            {overview?.won ?? 0} gagne / {overview?.lost ?? 0} perdu
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="flex-between">
            <span className="label text-muted" style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qualifies</span>
            <div style={{ padding: '0.5rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px' }}>
              <Target size={18} color="#f59e0b" />
            </div>
          </div>
          <div className="value">{overview?.qualified ?? 0}</div>
          <div className="small" style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            {overview?.proposal ?? 0} en proposition
          </div>
        </div>

        <div className="card stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <div className="flex-between">
            <span className="label text-muted" style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score Moyen IA</span>
            <div style={{ padding: '0.5rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px' }}>
              <BarChart2 size={18} color="#8b5cf6" />
            </div>
          </div>
          <div className="value">{overview?.avgScore !== null && overview?.avgScore !== undefined ? overview.avgScore : '—'}</div>
          <div className="small" style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            Score moyen
          </div>
        </div>
      </div>

      <div className="grid-main" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card">
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Pipeline Commercial
          </h2>
          {pipeline.map((s) => (
            <div key={s.stage} style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: STAGE_COLORS[s.stage] || 'var(--text-muted)' }}>
                  {s.count} ({s.percentage}%)
                </span>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{
                  background: STAGE_COLORS[s.stage] || 'var(--primary)',
                  height: '100%',
                  width: `${s.percentage}%`,
                  borderRadius: '6px',
                  transition: 'width 0.5s'
                }} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Leads par Source
          </h2>
          {sources.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune donnee disponible</p>
          ) : (
            sources.slice(0, 8).map((s) => (
              <div key={s.source} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <div style={{ minWidth: '100px', fontSize: '0.875rem', fontWeight: 500 }}>{s.source}</div>
                <div style={{ flex: 1, background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', height: '8px' }}>
                  <div style={{ background: 'var(--primary)', height: '100%', width: `${s.percentage}%`, borderRadius: '6px' }} />
                </div>
                <div style={{ minWidth: '40px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 700 }}>{s.count}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid-main" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '1.5rem' }}>
        <div className="card">
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Performance par Commercial
          </h2>
          {owners.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune donnee disponible</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Commercial</th>
                    <th style={{ textAlign: 'center' }}>Total</th>
                    <th style={{ textAlign: 'center' }}><CheckCircle size={13} /></th>
                    <th style={{ textAlign: 'center' }}><XCircle size={13} /></th>
                    <th style={{ textAlign: 'center' }}>% Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((o) => (
                    <tr key={o.ownerId}>
                      <td style={{ fontWeight: 600 }}>{o.ownerName}</td>
                      <td style={{ textAlign: 'center' }}>{o.total}</td>
                      <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{o.won}</td>
                      <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: 700 }}>{o.lost}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          background: o.conversionRate >= 50 ? 'rgba(16, 185, 129, 0.1)' : o.conversionRate >= 25 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: o.conversionRate >= 50 ? '#34d399' : o.conversionRate >= 25 ? '#fbbf24' : '#f87171',
                          borderRadius: 'var(--radius-full)',
                          padding: '2px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}>
                          {o.conversionRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Activite Recente
          </h2>
          {activities.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune activite recente</p>
          ) : (
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {activities.map((a) => (
                <div key={a.id} className="interaction-item">
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{
                      background: a.type === 'interaction' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                      color: a.type === 'interaction' ? '#c4b5fd' : '#93c5fd',
                      borderRadius: '10px',
                      padding: '8px',
                      height: 'fit-content',
                      flexShrink: 0,
                    }}>
                      {INTERACTION_ICONS[a.subtype] || <MessageSquare size={14} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{a.lead}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={10} />
                          {formatDate(a.createdAt)}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.content}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'rgba(148, 163, 184, 0.7)', margin: '2px 0 0' }}>
                        Par {a.user}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
          Repartition Globale
        </h2>
        <div className="stat-grid">
          {pipeline.map((s) => (
            <div key={s.stage} style={{
              textAlign: 'center',
              padding: '1.25rem',
              background: `${STAGE_COLORS[s.stage]}10`,
              border: `1px solid ${STAGE_COLORS[s.stage]}30`,
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${STAGE_COLORS[s.stage]}`,
            }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: STAGE_COLORS[s.stage] }}>{s.count}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(148, 163, 184, 0.6)', marginTop: '2px' }}>{s.percentage}%</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

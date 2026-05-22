import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Users, Target, CheckCircle, XCircle, Clock, BarChart2, Phone, Mail, MessageSquare } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

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

function StatCard({ title, value, subtitle, color, icon }: {
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>{title}</p>
          <h2 style={{ fontSize: '28px', fontWeight: '700', margin: '4px 0', color: '#111827' }}>{value}</h2>
          {subtitle && <p style={{ color: '#9ca3af', fontSize: '12px', margin: 0 }}>{subtitle}</p>}
        </div>
        <div style={{ background: `${color}20`, borderRadius: '10px', padding: '10px', color }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function PipelineBar({ label, count, percentage, color }: { label: string; count: number; percentage: number; color: string }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', color: '#374151' }}>{label}</span>
        <span style={{ fontSize: '13px', fontWeight: '600', color }}>{count} ({percentage}%)</span>
      </div>
      <div style={{ background: '#f3f4f6', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${percentage}%`, borderRadius: '6px', transition: 'width 0.5s' }} />
      </div>
    </div>
  );
}

function SourceBar({ source, count, percentage }: { source: string; count: number; percentage: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
      <div style={{ minWidth: '100px', fontSize: '13px', color: '#374151' }}>{source}</div>
      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '6px', height: '8px' }}>
        <div style={{ background: '#8b5cf6', height: '100%', width: `${percentage}%`, borderRadius: '6px' }} />
      </div>
      <div style={{ minWidth: '50px', textAlign: 'right', fontSize: '13px', fontWeight: '600' }}>{count}</div>
    </div>
  );
}

export function DashboardPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [owners, setOwners] = useState<OwnerData[]>([]);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [ov, pi, so, ow, ac] = await Promise.all([
        api.get('/dashboard/overview', { headers }).then((r) => r.data),
        api.get('/dashboard/pipeline', { headers }).then((r) => r.data),
        api.get('/dashboard/by-source', { headers }).then((r) => r.data),
        api.get('/dashboard/by-owner', { headers }).then((r) => r.data),
        api.get('/dashboard/activity?limit=15', { headers }).then((r) => r.data),
      ]);
      setOverview(ov);
      setPipeline(pi);
      setSources(so);
      setOwners(ow);
      setActivities(ac);
      setError(null);
    } catch {
      setError('Erreur lors du chargement du dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#8b5cf6' }} />
          <p style={{ color: '#6b7280', marginTop: '12px' }}>Chargement du dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button className="btn btn-primary" onClick={fetchAll}>Réessayer</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#111827' }}>
            Dashboard Commercial
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: '4px 0 0' }}>
            Vue d'ensemble de la performance commerciale
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={fetchAll}
          disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          Actualiser
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginBottom: '20px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          title="Total Leads"
          value={overview?.total ?? 0}
          subtitle={`${overview?.closed ?? 0} clos`}
          color="#3b82f6"
          icon={<Users size={22} />}
        />
        <StatCard
          title="Taux de Conversion"
          value={`${overview?.conversionRate ?? 0}%`}
          subtitle={`${overview?.won ?? 0} gagnés / ${overview?.lost ?? 0} perdus`}
          color="#10b981"
          icon={<TrendingUp size={22} />}
        />
        <StatCard
          title="Leads Qualifiés"
          value={overview?.qualified ?? 0}
          subtitle={`${overview?.proposal ?? 0} en proposition`}
          color="#f59e0b"
          icon={<Target size={22} />}
        />
        <StatCard
          title="Score Moyen"
          value={overview?.avgScore ?? '—'}
          subtitle="Score IA moyen"
          color="#8b5cf6"
          icon={<BarChart2 size={22} />}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px', color: '#111827' }}>Pipeline Commercial</h3>
          {pipeline.map((s) => (
            <PipelineBar
              key={s.stage}
              label={s.label}
              count={s.count}
              percentage={s.percentage}
              color={STAGE_COLORS[s.stage] || '#6b7280'}
            />
          ))}
        </div>

        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px', color: '#111827' }}>Leads par Source</h3>
          {sources.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Aucune donnée disponible</p>
          ) : (
            sources.slice(0, 8).map((s) => (
              <SourceBar key={s.source} source={s.source} count={s.count} percentage={s.percentage} />
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px', color: '#111827' }}>Performance par Commercial</h3>
          {owners.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Aucune donnée disponible</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '8px 8px', color: '#6b7280', fontWeight: '500' }}>Commercial</th>
                    <th style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontWeight: '500' }}>Total</th>
                    <th style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontWeight: '500' }}><CheckCircle size={13} /></th>
                    <th style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontWeight: '500' }}><XCircle size={13} /></th>
                    <th style={{ textAlign: 'center', padding: '8px', color: '#6b7280', fontWeight: '500' }}>% Conv.</th>
                  </tr>
                </thead>
                <tbody>
                  {owners.map((o) => (
                    <tr key={o.ownerId} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '8px 8px', fontWeight: '500', color: '#374151' }}>{o.ownerName}</td>
                      <td style={{ textAlign: 'center', color: '#374151' }}>{o.total}</td>
                      <td style={{ textAlign: 'center', color: '#10b981', fontWeight: '600' }}>{o.won}</td>
                      <td style={{ textAlign: 'center', color: '#ef4444', fontWeight: '600' }}>{o.lost}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          background: o.conversionRate >= 50 ? '#d1fae5' : o.conversionRate >= 25 ? '#fef3c7' : '#fee2e2',
                          color: o.conversionRate >= 50 ? '#065f46' : o.conversionRate >= 25 ? '#92400e' : '#991b1b',
                          borderRadius: '12px',
                          padding: '2px 8px',
                          fontSize: '12px',
                          fontWeight: '600',
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
          <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px', color: '#111827' }}>Activité Récente</h3>
          {activities.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Aucune activité récente</p>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {activities.map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{
                    background: a.type === 'interaction' ? '#ede9fe' : '#dbeafe',
                    color: a.type === 'interaction' ? '#7c3aed' : '#2563eb',
                    borderRadius: '8px',
                    padding: '6px',
                    height: 'fit-content',
                    flexShrink: 0,
                  }}>
                    {INTERACTION_ICONS[a.subtype] || <MessageSquare size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                        {a.lead}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                        <Clock size={10} style={{ marginRight: '3px' }} />
                        {formatDate(a.createdAt)}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.content}
                    </p>
                    <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0' }}>
                      Par {a.user}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 16px', color: '#111827' }}>Répartition Globale</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
          {pipeline.map((s) => (
            <div key={s.stage} style={{ textAlign: 'center', padding: '16px', background: `${STAGE_COLORS[s.stage]}10`, borderRadius: '10px', border: `1px solid ${STAGE_COLORS[s.stage]}30` }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: STAGE_COLORS[s.stage] }}>{s.count}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{s.percentage}%</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          border: 1px solid #f3f4f6;
        }
        .btn {
          padding: 8px 16px;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-primary {
          background: #7c3aed;
          color: white;
        }
        .btn-primary:hover { background: #6d28d9; }
        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }
        .btn-secondary:hover { background: #e5e7eb; }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}

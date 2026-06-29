import React, { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  BarChart2,
  Phone,
  Mail,
  MessageSquare,
  AlertTriangle,
  Award,
  Zap,
  Activity,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

// ─── Interfaces ────────────────────────────────────────────────────────────────

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

interface TrendData {
  date: string;
  created: number;
  won: number;
  lost: number;
}

interface StageConversion {
  from: string;
  to: string;
  fromCount: number;
  toCount: number;
  rate: number;
}

interface AlertsData {
  leadsWithoutActivity: Array<{
    id: string;
    name: string;
    ownerName: string;
    daysSinceActivity: number;
    stage: string;
  }>;
  overdueHighPriorityTasks: Array<{
    id: string;
    title: string;
    assigneeName: string;
    daysOverdue: number;
  }>;
}

interface TaskStats {
  total: number;
  completed: number;
  overdue: number;
  highPriority: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  Nouveau: '#3b82f6',
  Contacte: '#8b5cf6',
  Qualifie: '#f59e0b',
  Proposition: '#f97316',
  Gagne: '#10b981',
  Perdu: '#ef4444',
};

const INTERACTION_ICONS: Record<string, React.ReactNode> = {
  EMAIL: <Mail size={14} />,
  CALL: <Phone size={14} />,
  MEETING: <Users size={14} />,
  NOTE: <MessageSquare size={14} />,
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Admin',
  SALES: 'Commercial',
  MARKETING: 'Marketing',
  EXECUTIVE: 'Directeur',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

// ─── SVG Trend Chart ───────────────────────────────────────────────────────────

function TrendChart({ data, period }: { data: TrendData[]; period: number }) {
  if (data.length === 0) {
    return (
      <div
        style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Pas de données pour cette période
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap((d) => [d.created, d.won, d.lost]),
    1,
  );

  const allZero = data.every((d) => d.created === 0 && d.won === 0 && d.lost === 0);
  if (allZero) {
    return (
      <div
        style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Pas de données pour cette période
      </div>
    );
  }

  const W = 760;
  const H = 160;
  const PAD_X = 20;
  const PAD_Y = 20;

  const getX = (i: number) =>
    data.length > 1 ? (i / (data.length - 1)) * W + PAD_X : W / 2 + PAD_X;
  const getY = (val: number) => PAD_Y + H - (val / maxValue) * H;

  function buildPath(key: 'created' | 'won' | 'lost') {
    const pts = data.map((d, i) => [getX(i), getY(d[key])] as [number, number]);
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
  }

  function buildFill(key: 'created' | 'won' | 'lost') {
    const pts = data.map((d, i) => [getX(i), getY(d[key])] as [number, number]);
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]},${p[1]}`).join(' ');
    const lastX = pts[pts.length - 1][0];
    const firstX = pts[0][0];
    const bottom = PAD_Y + H;
    return `${line} L ${lastX},${bottom} L ${firstX},${bottom} Z`;
  }

  const firstDate = data[0]?.date;
  const lastDate = data[data.length - 1]?.date;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W + PAD_X * 2} ${H + PAD_Y * 2}`}
        preserveAspectRatio="none"
        width="100%"
        height="200"
        style={{ display: 'block' }}
      >
        <defs>
          <linearGradient id="grad-created" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grad-won" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grad-lost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = PAD_Y + H * (1 - t);
          return (
            <line
              key={t}
              x1={PAD_X}
              y1={y}
              x2={W + PAD_X}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          );
        })}

        {/* Fill areas */}
        <path d={buildFill('created')} fill="url(#grad-created)" />
        <path d={buildFill('won')} fill="url(#grad-won)" />
        <path d={buildFill('lost')} fill="url(#grad-lost)" />

        {/* Lines */}
        <path
          d={buildPath('created')}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={buildPath('won')}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={buildPath('lost')}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* X-axis date labels */}
        {firstDate && (
          <text
            x={PAD_X}
            y={H + PAD_Y * 2 - 2}
            fill="rgba(148,163,184,0.7)"
            fontSize="10"
            textAnchor="start"
          >
            {formatShortDate(firstDate)}
          </text>
        )}
        {lastDate && lastDate !== firstDate && (
          <text
            x={W + PAD_X}
            y={H + PAD_Y * 2 - 2}
            fill="rgba(148,163,184,0.7)"
            fontSize="10"
            textAnchor="end"
          >
            {formatShortDate(lastDate)}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '20px',
          justifyContent: 'center',
          marginTop: '8px',
        }}
      >
        {[
          { color: '#3b82f6', label: 'Créés' },
          { color: '#10b981', label: 'Gagnés' },
          { color: '#ef4444', label: 'Perdus' },
        ].map(({ color, label }) => (
          <div
            key={label}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: color,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card stat-card" style={{ borderLeftColor: color }}>
      <div className="flex-between">
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        <div
          style={{
            padding: '0.5rem',
            background: `${color}1a`,
            borderRadius: '12px',
          }}
        >
          {icon}
        </div>
      </div>
      <div className="value">{value}</div>
      <div className="small" style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
        {sub}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const isAdminOrExec =
    user?.role === 'ADMIN' || user?.role === 'EXECUTIVE';

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [sources, setSources] = useState<SourceData[]>([]);
  const [owners, setOwners] = useState<OwnerData[]>([]);
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [stageConversion, setStageConversion] = useState<StageConversion[]>([]);
  const [alerts, setAlerts] = useState<AlertsData | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const requests: Promise<unknown>[] = [
        api<OverviewData>('/dashboard/overview'),
        api<PipelineStage[]>('/dashboard/pipeline'),
        api<SourceData[]>('/dashboard/by-source'),
        api<OwnerData[]>('/dashboard/by-owner'),
        api<ActivityData[]>('/dashboard/activity?limit=10'),
        api<TrendData[]>(`/dashboard/trends?days=${period}`),
        api<StageConversion[]>('/dashboard/stage-conversion'),
        api<TaskStats>('/tasks/stats'),
      ];

      if (isAdminOrExec) {
        requests.push(api<AlertsData>('/dashboard/alerts'));
      }

      const results = await Promise.all(requests);

      setOverview(results[0] as OverviewData);
      setPipeline(results[1] as PipelineStage[]);
      setSources(results[2] as SourceData[]);
      setOwners(results[3] as OwnerData[]);
      setActivities(results[4] as ActivityData[]);
      setTrends(results[5] as TrendData[]);
      setStageConversion(results[6] as StageConversion[]);
      setTaskStats(results[7] as TaskStats);
      if (isAdminOrExec && results[8]) {
        setAlerts(results[8] as AlertsData);
      }

      setError(null);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Erreur lors du chargement du dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdminOrExec, period]);

  // Initial load + refresh when period changes
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Reload only trends when period changes (after initial load)
  useEffect(() => {
    if (loading) return;
    api<TrendData[]>(`/dashboard/trends?days=${period}`)
      .then(setTrends)
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '60vh',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <RefreshCw
            size={32}
            style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }}
          />
          <p style={{ color: 'var(--text-muted)', marginTop: '12px' }}>
            Chargement du dashboard…
          </p>
        </div>
      </div>
    );
  }

  const sortedOwners = [...owners].sort((a, b) => b.conversionRate - a.conversionRate);

  const hasAlerts =
    alerts &&
    (alerts.leadsWithoutActivity.length > 0 ||
      alerts.overdueHighPriorityTasks.length > 0);

  return (
    <div>
      {/* ── Section 1 : Header ─────────────────────────────────────────────── */}
      <div
        className="flex-between"
        style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '12px' }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
            Dashboard Commercial
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              margin: '4px 0 0',
            }}
          >
            Vue d'ensemble de la performance commerciale
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {([7, 30, 90] as const).map((p) => (
            <button
              key={p}
              className="secondary small"
              onClick={() => setPeriod(p)}
              style={{
                background:
                  period === p ? 'var(--primary)' : undefined,
                color: period === p ? '#fff' : undefined,
                borderColor: period === p ? 'var(--primary)' : undefined,
              }}
            >
              {p}j
            </button>
          ))}
          <button
            className="secondary small"
            onClick={() => fetchAll()}
            disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCw
              size={14}
              style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
            />
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            marginBottom: '20px',
            color: 'var(--danger)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Section 2 : 6 KPI Cards ────────────────────────────────────────── */}
      <div
        className="stat-grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          marginBottom: '1.5rem',
        }}
      >
        <KpiCard
          label="Total Leads"
          value={overview?.total ?? 0}
          sub={`${overview?.newLeads ?? 0} nouveaux`}
          color="#3b82f6"
          icon={<Users size={18} color="#3b82f6" />}
        />
        <KpiCard
          label="Taux Conversion"
          value={`${overview?.conversionRate ?? 0}%`}
          sub={`${overview?.won ?? 0} gagnés · ${overview?.lost ?? 0} perdus`}
          color="#10b981"
          icon={<TrendingUp size={18} color="#10b981" />}
        />
        <KpiCard
          label="En cours"
          value={(overview?.qualified ?? 0) + (overview?.proposal ?? 0)}
          sub={`${overview?.qualified ?? 0} qualifiés · ${overview?.proposal ?? 0} propositions`}
          color="#f97316"
          icon={<Activity size={18} color="#f97316" />}
        />
        <KpiCard
          label="Score IA moyen"
          value={
            overview?.avgScore !== null && overview?.avgScore !== undefined
              ? `${overview.avgScore}/10`
              : '—/10'
          }
          sub="Score moyen des leads"
          color="#8b5cf6"
          icon={<BarChart2 size={18} color="#8b5cf6" />}
        />
        <KpiCard
          label="Tâches"
          value={taskStats?.total ?? 0}
          sub={`${taskStats?.overdue ?? 0} en retard`}
          color="#06b6d4"
          icon={<CheckCircle size={18} color="#06b6d4" />}
        />
        <KpiCard
          label="Tâches critiques"
          value={taskStats?.highPriority ?? 0}
          sub="haute priorité"
          color="#ef4444"
          icon={<Zap size={18} color="#ef4444" />}
        />
      </div>

      {/* ── Section 3 : Trend Chart ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2
          style={{
            margin: '0 0 1rem 0',
            fontSize: '1rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Calendar size={16} />
          Évolution des leads — {period} derniers jours
        </h2>
        <TrendChart data={trends} period={period} />
      </div>

      {/* ── Section 4 : Entonnoir + Sources ───────────────────────────────── */}
      <div
        className="grid-main"
        style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Entonnoir */}
        <div className="card">
          <h2
            style={{
              margin: '0 0 1.25rem 0',
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
            }}
          >
            Entonnoir de conversion
          </h2>
          {stageConversion.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Aucune donnée disponible
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stageConversion.map((s) => {
                const widthPct =
                  stageConversion[0].fromCount > 0
                    ? Math.min(
                        100,
                        (s.fromCount / stageConversion[0].fromCount) * 100,
                      )
                    : 0;
                const barColor =
                  s.rate >= 60 ? '#10b981' : s.rate >= 30 ? '#f97316' : '#ef4444';
                return (
                  <div key={s.from}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                        fontSize: '0.8rem',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{s.from}</span>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {s.fromCount} · {s.rate}%
                      </span>
                    </div>
                    <div
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '6px',
                        height: '28px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          background: barColor,
                          width: `${widthPct}%`,
                          height: '100%',
                          borderRadius: '6px',
                          transition: 'width 0.5s',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sources */}
        <div className="card">
          <h2
            style={{
              margin: '0 0 1.25rem 0',
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
            }}
          >
            Leads par source
          </h2>
          {sources.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Aucune donnée disponible
            </p>
          ) : (
            sources.slice(0, 8).map((s) => (
              <div
                key={s.source}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '10px',
                }}
              >
                <div
                  style={{ minWidth: '100px', fontSize: '0.875rem', fontWeight: 500 }}
                >
                  {s.source}
                </div>
                <div
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    height: '8px',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--primary)',
                      height: '100%',
                      width: `${s.percentage}%`,
                      borderRadius: '6px',
                    }}
                  />
                </div>
                <div
                  style={{
                    minWidth: '60px',
                    textAlign: 'right',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                  }}
                >
                  {s.count} ({s.percentage}%)
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Section 5 : Performance commerciaux (admin/exec only) ─────────── */}
      {isAdminOrExec && owners.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2
            style={{
              margin: '0 0 1.25rem 0',
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Award size={16} />
            Classement commerciaux
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: 'center', width: '48px' }}>Rang</th>
                  <th>Commercial</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Gagnés</th>
                  <th style={{ textAlign: 'center' }}>Perdus</th>
                  <th style={{ textAlign: 'center' }}>Taux conv.</th>
                  <th style={{ textAlign: 'center' }}>Performance</th>
                </tr>
              </thead>
              <tbody>
                {sortedOwners.map((o, idx) => (
                  <tr key={o.ownerId}>
                    <td style={{ textAlign: 'center', fontSize: '1.1rem' }}>
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{o.ownerName}</span>
                      <span
                        style={{
                          marginLeft: '8px',
                          fontSize: '0.7rem',
                          background: 'rgba(139,92,246,0.15)',
                          color: '#c4b5fd',
                          borderRadius: 'var(--radius-sm)',
                          padding: '1px 6px',
                          fontWeight: 600,
                        }}
                      >
                        {ROLE_LABELS[o.ownerRole] ?? o.ownerRole}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{o.total}</td>
                    <td
                      style={{
                        textAlign: 'center',
                        color: '#10b981',
                        fontWeight: 700,
                      }}
                    >
                      {o.won}
                    </td>
                    <td
                      style={{
                        textAlign: 'center',
                        color: '#ef4444',
                        fontWeight: 700,
                      }}
                    >
                      {o.lost}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          background:
                            o.conversionRate >= 50
                              ? 'rgba(16,185,129,0.1)'
                              : o.conversionRate >= 25
                              ? 'rgba(245,158,11,0.1)'
                              : 'rgba(239,68,68,0.1)',
                          color:
                            o.conversionRate >= 50
                              ? '#34d399'
                              : o.conversionRate >= 25
                              ? '#fbbf24'
                              : '#f87171',
                          borderRadius: 'var(--radius-full)',
                          padding: '2px 10px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {o.conversionRate}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          width: 120,
                          height: 6,
                          background: 'rgba(255,255,255,0.07)',
                          borderRadius: 'var(--radius-sm)',
                          margin: '0 auto',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, o.conversionRate)}%`,
                            height: '100%',
                            background:
                              o.conversionRate >= 50
                                ? '#10b981'
                                : o.conversionRate >= 25
                                ? '#f97316'
                                : '#ef4444',
                            borderRadius: 'var(--radius-sm)',
                            transition: 'width 0.5s',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Section 6 : Alertes (admin/exec only) ─────────────────────────── */}
      {isAdminOrExec && hasAlerts && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          {/* Leads sans activité */}
          {alerts!.leadsWithoutActivity.length > 0 && (
            <div
              style={{
                background: 'rgba(245,158,11,0.05)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '1rem',
                }}
              >
                <AlertTriangle size={18} color="#f59e0b" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  Leads sans activité récente
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(245,158,11,0.15)',
                    color: '#fbbf24',
                    borderRadius: 'var(--radius-full)',
                    padding: '1px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {alerts!.leadsWithoutActivity.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alerts!.leadsWithoutActivity.map((lead) => (
                  <div
                    key={lead.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {lead.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          {lead.ownerName}
                        </div>
                      </div>
                      <span
                        style={{
                          background: `${STAGE_COLORS[lead.stage] ?? '#6b7280'}1a`,
                          color: STAGE_COLORS[lead.stage] ?? '#6b7280',
                          borderRadius: 'var(--radius-sm)',
                          padding: '1px 7px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {lead.stage}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: lead.daysSinceActivity > 14 ? '#ef4444' : '#f97316',
                      }}
                    >
                      Inactif depuis {lead.daysSinceActivity} jours
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tâches critiques en retard */}
          {alerts!.overdueHighPriorityTasks.length > 0 && (
            <div
              style={{
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '1rem',
                }}
              >
                <Zap size={18} color="#ef4444" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                  Tâches critiques en retard
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(239,68,68,0.15)',
                    color: '#f87171',
                    borderRadius: 'var(--radius-full)',
                    padding: '1px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {alerts!.overdueHighPriorityTasks.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alerts!.overdueHighPriorityTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.title}
                    </div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}
                    >
                      {task.assigneeName}
                    </div>
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#ef4444',
                      }}
                    >
                      {task.daysOverdue} jours de retard
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Section 7 : Activité récente ──────────────────────────────────── */}
      <div className="card">
        <h2
          style={{
            margin: '0 0 1.25rem 0',
            fontSize: '1rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Activity size={16} />
          Activité récente
        </h2>
        {activities.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Aucune activité récente
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                activities.length > 6 ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
              gap: '12px',
            }}
          >
            {activities.map((a) => (
              <div key={a.id} className="interaction-item">
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      background:
                        a.type === 'interaction'
                          ? 'rgba(139,92,246,0.15)'
                          : 'rgba(59,130,246,0.15)',
                      color:
                        a.type === 'interaction' ? '#c4b5fd' : '#93c5fd',
                      borderRadius: '10px',
                      padding: '8px',
                      height: 'fit-content',
                      flexShrink: 0,
                    }}
                  >
                    {INTERACTION_ICONS[a.subtype] || <MessageSquare size={14} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                        {a.lead}
                      </span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Clock size={10} />
                        {formatDate(a.createdAt)}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        margin: '4px 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {a.content}
                    </p>
                    <p
                      style={{
                        fontSize: '0.7rem',
                        color: 'rgba(148,163,184,0.7)',
                        margin: '2px 0 0',
                      }}
                    >
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
  );
}

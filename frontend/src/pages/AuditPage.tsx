import { useCallback, useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface AuditUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: unknown | null;
  newValue: unknown | null;
  createdAt: string;
  user?: AuditUser;
}

interface AuditLogsResponse {
  data: AuditLog[];
  total: number;
  page: number;
  lastPage: number;
}

const ENTITY_TYPE_OPTIONS = [
  { value: '', label: 'Tous' },
  { value: 'Lead', label: 'Lead' },
  { value: 'Task', label: 'Task' },
];

function actionBadgeStyle(action: string): React.CSSProperties {
  switch (action.toUpperCase()) {
    case 'CREATE':
      return {
        background: 'rgba(16, 185, 129, 0.15)',
        color: '#6ee7b7',
        border: '1px solid rgba(16, 185, 129, 0.3)',
      };
    case 'UPDATE':
      return {
        background: 'rgba(59, 130, 246, 0.15)',
        color: '#93c5fd',
        border: '1px solid rgba(59, 130, 246, 0.3)',
      };
    case 'DELETE':
      return {
        background: 'rgba(239, 68, 68, 0.15)',
        color: '#fca5a5',
        border: '1px solid rgba(239, 68, 68, 0.3)',
      };
    case 'ARCHIVE':
      return {
        background: 'rgba(245, 158, 11, 0.15)',
        color: '#fcd34d',
        border: '1px solid rgba(245, 158, 11, 0.3)',
      };
    default:
      return {
        background: 'rgba(148, 163, 184, 0.15)',
        color: '#cbd5e1',
        border: '1px solid rgba(148, 163, 184, 0.3)',
      };
  }
}

function truncateJson(value: unknown, maxLen = 100): string {
  if (value === null || value === undefined) return '—';
  const str = JSON.stringify(value);
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

function formatUser(user?: AuditUser): string {
  if (!user) return '—';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email;
}

export function AuditPage() {
  const { user } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entityType, setEntityType] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (entityType) params.set('entityType', entityType);
      if (actionFilter.trim()) params.set('action', actionFilter.trim().toUpperCase());

      const res = await api<AuditLogsResponse>(`/audit-logs?${params.toString()}`);
      if (res) {
        setLogs(res.data);
        setLastPage(res.lastPage);
        setTotal(res.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du journal');
    } finally {
      setLoading(false);
    }
  }, [user, page, entityType, actionFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityType, actionFilter]);

  const badgeBase: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Shield size={28} style={{ color: 'var(--primary)' }} />
          <div>
            <h1 style={{ margin: 0 }}>Journal d'audit</h1>
            {!loading && (
              <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                {total} entrée{total !== 1 ? 's' : ''} au total
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          className="secondary small"
          onClick={() => void load()}
          disabled={loading}
        >
          Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
              Type d'entité
            </span>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, flex: 1 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', whiteSpace: 'nowrap' }}>
              Action
            </span>
            <input
              type="text"
              placeholder="Filtrer par action..."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              style={{ flex: 1, minWidth: '180px' }}
            />
          </label>
        </div>
      </div>

      {/* Tableau */}
      <section className="card">
        {error && (
          <p className="error" style={{ marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {loading ? (
          <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>
            Chargement…
          </p>
        ) : logs.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: '2rem 0' }}>
            Aucun événement trouvé.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date / Heure</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Type</th>
                  <th>Entité</th>
                  <th>Changements</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(log.createdAt).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <strong style={{ fontSize: '0.875rem' }}>{formatUser(log.user)}</strong>
                      {log.user && (
                        <>
                          <br />
                          <span className="muted small">{log.user.email}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <span style={{ ...badgeBase, ...actionBadgeStyle(log.action) }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="badge">{log.entityType}</span>
                    </td>
                    <td className="muted small" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {log.entityId.slice(0, 8)}…
                    </td>
                    <td style={{ maxWidth: '320px' }}>
                      {log.oldValue !== null && log.oldValue !== undefined ? (
                        <div style={{ marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Avant&nbsp;
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: '#fca5a5',
                              wordBreak: 'break-all',
                            }}
                          >
                            {truncateJson(log.oldValue)}
                          </span>
                        </div>
                      ) : null}
                      {log.newValue !== null && log.newValue !== undefined ? (
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Après&nbsp;
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              color: '#6ee7b7',
                              wordBreak: 'break-all',
                            }}
                          >
                            {truncateJson(log.newValue)}
                          </span>
                        </div>
                      ) : null}
                      {log.oldValue === null && log.newValue === null && (
                        <span className="muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </button>
          <span>Page {page} / {lastPage}</span>
          <button
            type="button"
            disabled={page >= lastPage || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </button>
        </div>
      </section>
    </div>
  );
}

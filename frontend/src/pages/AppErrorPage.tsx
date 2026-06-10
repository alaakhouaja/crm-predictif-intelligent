import { useLocation } from 'react-router-dom';

export function AppErrorPage({ requestId }: { requestId?: string }) {
  const location = useLocation();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: 640, textAlign: 'center' }}>
        <h2 style={{ marginTop: 0 }}>Une erreur est survenue</h2>
        <p className="muted">
          L’application a rencontré un problème. Tu peux réessayer ou recharger la
          page.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          <button className="btn primary" onClick={() => window.location.reload()}>
            Recharger
          </button>
          <button className="btn secondary" onClick={() => window.history.back()}>
            Retour
          </button>
        </div>
        <div style={{ marginTop: '1rem' }} className="text-muted x-small">
          <div>Chemin: {location.pathname}</div>
          {requestId && <div>RequestId: {requestId}</div>}
        </div>
      </div>
    </div>
  );
}

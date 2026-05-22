import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  LayoutDashboard, 
  Kanban, 
  Search,
  ChevronRight,
  ChevronDown,
  BrainCircuit,
  X,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navItems = (() => {
    if (user?.role === 'ADMIN') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Leads', path: '/leads', icon: Users },
        { label: 'Pipeline', path: '/pipeline', icon: Kanban },
        { label: 'Utilisateurs', path: '/users', icon: Users },
      ];
    }
    if (user?.role === 'SALES') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Mes leads', path: '/leads', icon: Users },
        { label: 'Mon pipeline', path: '/pipeline', icon: Kanban },
      ];
    }
    if (user?.role === 'MARKETING') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Leads entrants', path: '/leads', icon: Users },
      ];
    }
    if (user?.role === 'EXECUTIVE') {
      return [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Leads', path: '/leads', icon: Users },
        { label: 'Pipeline', path: '/pipeline', icon: Kanban },
      ];
    }
    return [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }];
  })();

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || (user?.email?.[0] ?? 'U').toUpperCase();

  return (
    <div className="app-layout">
      {/* Sidebar V2 - Creative & Floating */}
      <motion.aside 
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="sidebar"
      >
        <div className="sidebar-logo">
          <div style={{ 
            width: '40px', 
            height: '40px', 
            background: 'white', 
            borderRadius: '12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: 'var(--bg-sidebar)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}>
            <BrainCircuit size={24} />
          </div>
          <span style={{ fontSize: '1.25rem' }}>CRM</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeNav"
                    style={{ marginLeft: 'auto' }}
                  >
                    <ChevronRight size={16} />
                  </motion.div>
                )}
              </Link>
            );
          })}
        </nav>
      </motion.aside>

      {/* Main Content */}
      <div className="main-wrapper">
        <motion.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="header"
        >
          <div className="flex-center" style={{ flex: 1 }}>
            <div style={{ position: 'relative', width: '350px' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Rechercher un client, une note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/leads?search=${encodeURIComponent(searchQuery.trim())}`);
                    setSearchQuery('');
                  }
                }}
                style={{ paddingLeft: '48px', paddingRight: searchQuery ? '40px' : '16px', width: '100%', border: 'none', background: '#f1f5f9', color: '#0f172a' }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="secondary small"
              onClick={() => window.location.reload()}
              style={{ marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
              title="Actualiser"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="header-right" ref={menuRef}>
            <button
              type="button"
              className="user-menu-trigger"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="user-avatar">{initials}</span>
              <span className="user-name">{user?.firstName ?? user?.email}</span>
              <ChevronDown size={16} className="text-muted" />
            </button>

            {menuOpen && (
              <div className="user-menu">
                <Link to="/profile" className="user-menu-item" onClick={() => setMenuOpen(false)}>
                  Profil
                </Link>
                <Link to="/settings" className="user-menu-item" onClick={() => setMenuOpen(false)}>
                  Paramètres
                </Link>
                <div className="user-menu-sep" />
                <button
                  type="button"
                  className="user-menu-item danger"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </motion.header>

        <motion.main 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="content-area"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

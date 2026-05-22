import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../auth/AuthContext';
import { api } from '../api/client';

type CrmNotification = {
  id: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState<CrmNotification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!user || !token) return;

    // Load initial notifications
    void api<CrmNotification[]>('/notifications', { token }).then(res => {
      if (res) setNotifications(res);
    });

    // Connect to WebSocket
    const socket: Socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      auth: { token },
    });

    socket.on('notification', (newNotif: CrmNotification) => {
      setNotifications(prev => [newNotif, ...prev]);
      // Optional: Browser notification
      if (window.Notification && window.Notification.permission === 'granted') {
        new window.Notification(newNotif.title, { body: newNotif.content });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user, token]);

  async function markAsRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH', token });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }

  return (
    <div className="notification-bell-container">
      <button className="bell-btn" onClick={() => setShowDropdown(!showDropdown)}>
        🔔 {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {showDropdown && (
        <div className="notification-dropdown">
          <div className="dropdown-header">
            <h4>Notifications</h4>
          </div>
          <div className="notification-list">
            {notifications.length === 0 && <p className="muted small p-1">Aucune notification.</p>}
            {notifications.map(n => (
              <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`} onClick={() => void markAsRead(n.id)}>
                <strong>{n.title}</strong>
                <p className="small">{n.content}</p>
                <span className="x-small muted">{new Date(n.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

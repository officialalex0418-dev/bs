import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Menu, X, Moon, Sun, Bell, LogOut, ChevronDown, MapPin,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useSocket, useSocketEvent } from '@/context/SocketContext';
import { useLocationTracker } from '@/hooks/useLocationTracker';
import { api } from '@/api/client';
import { cn, ROLE_LABELS } from '@/lib/utils';
import { t } from '@/lib/i18n';

export default function DashboardLayout({ title, nav }) {
  const { user, logout } = useAuth();
  const { dark, toggle, branding } = useTheme();
  const language = user?.company?.settings?.language || 'English';
  const { connected } = useSocket() || {};
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Background location tracking for staff
  const isTrackingEnabled = user?.role === 'STAFF';
  const { isAlerting } = useLocationTracker(isTrackingEnabled);

  useEffect(() => {
    // Dispatch a resize event when sidebar toggles to help components like Leaflet recalculate
    window.dispatchEvent(new Event('resize'));
  }, [sidebarOpen]);
  const [notifOpen, setNotifOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications?limit=10');
      setNotifications(data.data.items);
      setUnread(data.data.unreadCount);
    } catch {}
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  useSocketEvent('notification:new', useCallback((n) => {
    setNotifications((prev) => [n, ...prev].slice(0, 10));
    setUnread((u) => u + 1);
  }, []));

  const markRead = async () => {
    setNotifOpen((o) => !o);
    if (unread > 0) {
      try { await api.patch('/notifications/read', {}); setUnread(0); } catch {}
    }
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const handleNotificationClick = (n) => {
    setNotifOpen(false);
    const role = user?.role;
    const isOwner = role === 'COMPANY_OWNER';
    const isManager = role === 'COMPANY_MANAGER';
    const isStaff = role === 'STAFF';

    // Base paths based on role
    const mgmtPrefix = isOwner ? '/company' : (isManager ? '/staff/management' : '');
    const staffPrefix = '/staff';

    if (n.link) {
      navigate(n.link);
      return;
    }

    switch (n.type) {
      case 'LEAVE_APPLIED':
        navigate(`${mgmtPrefix}/leaves`);
        break;
      case 'LEAVE_APPROVED':
      case 'LEAVE_REJECTED':
        navigate(`${staffPrefix}/leaves`);
        break;
      case 'PAYROLL_GENERATED':
        navigate(isStaff ? `${staffPrefix}/payroll` : `${mgmtPrefix}/payroll`);
        break;
      case 'LOW_STOCK':
        navigate(`${mgmtPrefix}/inventory`);
        break;
      case 'SALE_SUBMITTED':
        navigate(`${mgmtPrefix}/sales`);
        break;
      case 'STAFF_CREATED':
        navigate(`${mgmtPrefix}/staff`);
        break;
      case 'COMPANY_CREATED':
        if (['SUPER_ADMIN', 'ADMIN_EMPLOYEE'].includes(role)) navigate('/admin/companies');
        break;
      case 'PACKAGE_ASSIGNED':
        if (isOwner) navigate('/company/settings');
        break;
      case 'GENERAL':
        navigate(isOwner ? '/company/complaints' : '/staff/complaints');
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    if (!user) return undefined;
    const idleTimeoutMs = 30 * 60 * 1000;
    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    let timeoutId;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(async () => {
        await logout();
        navigate('/login', { replace: true });
      }, idleTimeoutMs);
    };

    resetTimer();
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [user, logout, navigate]);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-[9999] w-64 transform flex flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary-600 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">{branding.appName}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">{t(title, language)}</p>
            </div>
          </div>
          <button className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              )}
            >
              <Icon className="h-4.5 w-4.5 h-5 w-5" />
              {t(label, language)}
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-[55] bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {isAlerting && (
          <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-3 animate-pulse sticky top-0 z-[60]">
            <Bell className="h-5 w-5 animate-bounce" />
            <span className="font-bold text-sm uppercase tracking-wider">
              Alert: Tracking Issues! Please Enable GPS and Mobile Data.
            </span>
          </div>
        )}
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <span className={cn('hidden items-center gap-1.5 text-xs sm:flex', connected ? 'text-emerald-500' : 'text-slate-400')}>
              <span className={cn('h-2 w-2 rounded-full', connected ? 'bg-emerald-500' : 'bg-slate-400')} />
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={toggle} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button onClick={markRead} className="relative rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <p className="border-b border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-800">Notifications</p>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-8 text-center text-sm text-slate-400">No notifications</p>
                    ) : notifications.map((n) => (
                      <div
                        key={n._id}
                        onClick={() => handleNotificationClick(n)}
                        className="cursor-pointer border-b border-slate-100 px-4 py-3 transition hover:bg-slate-50 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800/50"
                      >
                        <p className="text-sm font-medium">{n.title}</p>
                        <p className="text-xs text-slate-500">{n.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User menu */}
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium leading-tight">{user?.name}</p>
                <p className="text-[10px] text-slate-400">{ROLE_LABELS[user?.role]}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" />
            </div>
            <button onClick={handleLogout} title={t('Logout', language)} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30">
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

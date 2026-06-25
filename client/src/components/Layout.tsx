import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { getAvatarColor, getInitials } from '../lib/format';
import { TaskNotificationWatcher } from './TaskNotificationWatcher';
import { QuickTaskSearch } from './QuickTaskSearch';

const SIDEBAR_COLLAPSED_KEY = 'homesfy:sidebarCollapsed';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const isTasks = location.pathname.startsWith('/tasks');
  const isAdminUsers = location.pathname.startsWith('/admin/users');

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarLink = (to: string, label: string, Icon: Icon, active: boolean) => (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={`sidebar-link ${active ? 'sidebar-link-active' : ''} ${
        collapsed ? 'lg:sidebar-link-collapsed lg:mx-auto' : ''
      }`}
    >
      <Icon className="sidebar-link-icon" />
      <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{label}</span>
    </NavLink>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden app-bg">
      <TaskNotificationWatcher />

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`glass-sidebar fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col shadow-sidebar transition-[width,transform] duration-300 ease-in-out lg:static lg:z-20 lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]'}`}
      >
        <div
          className={`sidebar-header justify-between ${
            collapsed ? 'lg:justify-center lg:gap-0 lg:px-2' : ''
          }`}
        >
          <div className={`flex min-w-0 items-center gap-3 ${collapsed ? 'lg:justify-center lg:gap-0' : ''}`}>
            <div className="sidebar-brand-icon">
              <CheckCircleIcon className="h-5 w-5 text-[#2fc6f6]" />
            </div>
            <div className={`sidebar-brand-text ${collapsed ? 'lg:hidden' : ''}`}>
              <span className="sidebar-brand-title">Homesfy</span>
              <span className="sidebar-brand-subtitle">Task Manager</span>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav className={`sidebar-nav ${collapsed ? 'lg:px-2' : ''}`}>
          {!collapsed && <p className="sidebar-section-label">Collaboration</p>}
          {sidebarLink('/tasks', 'Tasks', RectangleStackIcon, isTasks)}
          {user?.role === 'admin' &&
            sidebarLink('/admin/users', 'Users', UsersIcon, isAdminUsers)}
        </nav>

        <div className={`sidebar-footer ${collapsed ? 'lg:sidebar-footer-collapsed lg:p-2' : ''}`}>
          <button
            type="button"
            className={`sidebar-collapse-btn ${collapsed ? 'lg:sidebar-collapse-btn-collapsed' : ''}`}
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeftIcon className="h-4 w-4 shrink-0" />
                <span>Hide sidebar</span>
              </>
            )}
          </button>

          <div
            className={`sidebar-user w-full ${collapsed ? 'lg:sidebar-user-collapsed lg:w-full' : ''}`}
          >
            <div className={`sidebar-user-avatar ${getAvatarColor(user?.name ?? 'U')}`}>
              {getInitials(user?.name ?? 'User')}
            </div>
            <div className={`sidebar-user-meta ${collapsed ? 'lg:hidden' : ''}`}>
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200/60 bg-white/60 px-3 backdrop-blur-xl sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              className="rounded-xl p-2 text-slate-600 transition hover:bg-white lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="hidden rounded-xl p-2 text-slate-500 transition hover:bg-white hover:text-slate-700 lg:inline-flex"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
            <NavLink
              to="/tasks"
              className="hidden truncate text-sm font-semibold text-slate-800 sm:inline"
            >
              Tasks
            </NavLink>
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:flex-none sm:gap-2">
            <QuickTaskSearch />
            <button
              type="button"
              className="hidden rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-600 sm:inline-flex"
              title="Help"
            >
              <QuestionMarkCircleIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="relative hidden rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-600 sm:inline-flex"
              title="Notifications"
            >
              <BellIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-0.5 flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 sm:px-3"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

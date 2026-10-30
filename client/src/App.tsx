import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Tasks } from './pages/Tasks';
import { lazy, Suspense, type ReactNode } from 'react';

// Less-visited pages load on demand to keep the first page load small.
const TaskNew = lazy(() => import('./pages/TaskNew').then((m) => ({ default: m.TaskNew })));
const TaskEdit = lazy(() => import('./pages/TaskEdit').then((m) => ({ default: m.TaskEdit })));
const TaskDetail = lazy(() => import('./pages/TaskDetail').then((m) => ({ default: m.TaskDetail })));
const AuthVerify = lazy(() => import('./pages/AuthVerify').then((m) => ({ default: m.AuthVerify })));
const SetPassword = lazy(() => import('./pages/SetPassword').then((m) => ({ default: m.SetPassword })));
const AdminUsers = lazy(() => import('./pages/AdminUsers').then((m) => ({ default: m.AdminUsers })));

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 app-bg text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2fc6f6] border-t-transparent" />
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/tasks" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/verify" element={<AuthVerify />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/new" element={<TaskNew />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/tasks/:id/edit" element={<TaskEdit />} />
            <Route
              path="/admin/users"
              element={
                <AdminOnly>
                  <AdminUsers />
                </AdminOnly>
              }
            />
            <Route path="/projects" element={<Navigate to="/tasks" replace />} />
          </Route>
          <Route path="/" element={<Navigate to="/tasks" replace />} />
          <Route path="*" element={<Navigate to="/tasks" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

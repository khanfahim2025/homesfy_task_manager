import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Tasks } from './pages/Tasks';
import { TaskNew } from './pages/TaskNew';
import { TaskDetail } from './pages/TaskDetail';
import { AuthVerify } from './pages/AuthVerify';
import { SetPassword } from './pages/SetPassword';
import { AdminUsers } from './pages/AdminUsers';
import type { ReactNode } from 'react';

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
    </BrowserRouter>
  );
}

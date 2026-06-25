import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';

export function Login() {
  const { user, login } = useAuth();
  const { data: config } = useQuery({ queryKey: ['config'], queryFn: api.getConfig });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/tasks" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  const domain = config?.allowedEmailDomain;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 app-bg">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#2fc6f6]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2fc6f6]/15">
            <CheckCircleIcon className="h-8 w-8 text-[#2fc6f6]" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Homesfy Task Manager</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage your projects and tasks</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel space-y-4 p-7">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={domain ? `you@${domain}` : 'you@example.com'}
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? 'Please wait…' : 'Sign in'}
          </button>

          <div className="space-y-1 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
            <p>New user? Ask your admin for a set-password link.</p>
            <p>Need to sign in without a password? Ask admin for a magic login link.</p>
          </div>
        </form>
      </div>
    </div>
  );
}

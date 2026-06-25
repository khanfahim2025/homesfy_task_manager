import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';

export function SetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUserFromSession } = useAuth();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['set-password-verify', token],
    queryFn: () => api.verifySetPasswordToken(token),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (!token) setError('Missing set-password link.');
  }, [token]);

  if (user) return <Navigate to="/tasks" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const verifiedUser = await api.setPassword(token, password);
      setUserFromSession(verifiedUser);
      navigate('/tasks', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not set password.');
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 app-bg">
        <p className="text-red-600">Invalid link.</p>
        <Link to="/login" className="text-sm text-[#2fc6f6] hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 app-bg text-slate-500">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2fc6f6] border-t-transparent" />
        Verifying link…
      </div>
    );
  }

  if (isError || !data?.valid) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 app-bg">
        <p className="text-center text-red-600">This link is invalid or has expired.</p>
        <Link to="/login" className="text-sm text-[#2fc6f6] hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 app-bg">
      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2fc6f6]/15">
            <CheckCircleIcon className="h-8 w-8 text-[#2fc6f6]" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Set your password</h1>
          <p className="mt-2 text-sm text-slate-500">{data.email}</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel space-y-4 p-5 sm:p-7">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Confirm password</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  );
}

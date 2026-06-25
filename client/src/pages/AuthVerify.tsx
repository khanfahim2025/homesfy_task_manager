import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../api/client';

export function AuthVerify() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUserFromSession } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate('/tasks', { replace: true });
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setError('Missing sign-in link.');
      return;
    }

    api
      .verifyMagicLink(token)
      .then((verifiedUser) => {
        setUserFromSession(verifiedUser);
        navigate('/tasks', { replace: true });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Sign-in link is invalid or expired.');
      });
  }, [searchParams, navigate, user, setUserFromSession]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 app-bg">
        <p className="text-center text-red-600">{error}</p>
        <Link to="/login" className="text-sm font-medium text-[#2fc6f6] hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center gap-3 app-bg text-slate-500">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2fc6f6] border-t-transparent" />
      Signing you in…
    </div>
  );
}

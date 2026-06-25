import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export function QuickTaskSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const [value, setValue] = useState(urlQ);

  useEffect(() => {
    if (location.pathname === '/tasks' || location.pathname.startsWith('/tasks/')) {
      setValue(urlQ);
    }
  }, [urlQ, location.pathname]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = value.trim();
    navigate(trimmed ? `/tasks?q=${encodeURIComponent(trimmed)}` : '/tasks');
  };

  return (
    <form onSubmit={submit} className="relative min-w-0 flex-1 sm:max-w-xs lg:max-w-none lg:flex-none">
      <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-3" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full min-w-0 rounded-xl border border-slate-200/80 bg-white/80 py-1.5 pl-8 pr-2 text-sm placeholder:text-slate-400 focus:border-[#2fc6f6] focus:outline-none focus:ring-2 focus:ring-[#2fc6f6]/20 sm:pl-9 sm:pr-3 lg:w-56"
        placeholder="Search…"
        aria-label="Search tasks by title or project id"
      />
    </form>
  );
}

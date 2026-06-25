import { useMemo, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { User, UserRef } from '../types';
import { getAvatarColor, getInitials } from '../lib/format';

type Person = Pick<User, 'id' | 'name' | 'email'> | UserRef;

interface Props {
  label: string;
  hint?: string;
  users: User[];
  value: string[];
  onChange: (ids: string[]) => void;
}

export function UserMultiSelect({ label, hint, users, value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const selectedUsers = useMemo(
    () => value.map((id) => users.find((u) => u.id === id)).filter(Boolean) as User[],
    [value, users]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [users, query]);

  const toggle = (id: string) => {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const remove = (id: string) => {
    onChange(value.filter((v) => v !== id));
  };

  return (
    <div>
      <div className="mb-1.5">
        <label className="mb-0 block text-sm font-medium text-slate-700">{label}</label>
        {hint && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</p>}
      </div>

      {selectedUsers.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex max-w-full items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-0.5 pr-1 text-[11px] font-medium text-slate-700"
            >
              <span className={`avatar h-4 w-4 text-[7px] ${getAvatarColor(user.name)}`}>
                {getInitials(user.name)}
              </span>
              <span className="truncate">{user.name}</span>
              <button
                type="button"
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                onClick={() => remove(user.id)}
                aria-label={`Remove ${user.name}`}
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-xs shadow-sm placeholder:text-slate-400 focus:border-[#2fc6f6] focus:outline-none focus:ring-2 focus:ring-[#2fc6f6]/20"
          placeholder="Search people…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
            onClick={() => setQuery('')}
            aria-label="Clear search"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {query.trim() ? (
        filtered.length === 0 ? (
          <p className="mt-1.5 px-1 text-[11px] text-slate-400">No people match your search.</p>
        ) : (
          <div className="mt-1.5 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            {filtered.map((user) => (
              <label
                key={user.id}
                className="flex cursor-pointer items-center gap-2 border-b border-slate-50 px-2 py-1.5 last:border-0 hover:bg-[#2fc6f6]/5"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#2fc6f6] focus:ring-[#2fc6f6]/30"
                  checked={selected.has(user.id)}
                  onChange={() => toggle(user.id)}
                />
                <span className={`avatar h-5 w-5 text-[8px] ${getAvatarColor(user.name)}`}>
                  {getInitials(user.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-800" title={user.email}>
                  {user.name}
                </span>
              </label>
            ))}
          </div>
        )
      ) : (
        <p className="mt-1.5 px-1 text-[11px] text-slate-400">
          {selectedUsers.length === 0 ? 'Search to add people.' : 'Search to add more people.'}
        </p>
      )}
    </div>
  );
}

export function UserChipList({ users, emptyLabel = 'None' }: { users: Person[]; emptyLabel?: string }) {
  if (users.length === 0) {
    return <span className="text-slate-500">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {users.map((user) => (
        <span
          key={user.id}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
        >
          <span className={`avatar h-5 w-5 text-[8px] ${getAvatarColor(user.name)}`}>
            {getInitials(user.name)}
          </span>
          {user.name}
        </span>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowPathIcon,
  LinkIcon,
  PlusIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { api, ApiError } from '../api/client';
import type { Role, User } from '../types';
import { CopyButton } from '../components/CopyButton';

function UserRow({ user, onUpdated }: { user: User; onUpdated: () => void }) {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<'invite' | 'login' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (input: { role?: Role; isActive?: boolean }) => api.updateUser(user.id, input),
    onSuccess: onUpdated,
  });

  const inviteMutation = useMutation({
    mutationFn: () => api.createInviteLink(user.id),
    onSuccess: (data) => {
      setLinkUrl(data.url);
      setLinkType('invite');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed'),
  });

  const loginMutation = useMutation({
    mutationFn: () => api.createLoginLink(user.id),
    onSuccess: (data) => {
      setLinkUrl(data.url);
      setLinkType('login');
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed'),
  });

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{user.name}</div>
        <div className="text-xs text-slate-500">{user.email}</div>
      </td>
      <td className="px-4 py-3 capitalize text-sm text-slate-600">{user.role}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            user.isActive !== false
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {user.isActive !== false ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            disabled={inviteMutation.isPending || user.isActive === false}
            onClick={() => inviteMutation.mutate()}
          >
            <UserPlusIcon className="h-3.5 w-3.5" />
            Set-password link
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            disabled={loginMutation.isPending || user.isActive === false}
            onClick={() => loginMutation.mutate()}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            Login link
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                role: user.role === 'admin' ? 'member' : 'admin',
              })
            }
          >
            <ArrowPathIcon className="h-3.5 w-3.5" />
            Make {user.role === 'admin' ? 'member' : 'admin'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({ isActive: user.isActive === false })
            }
          >
            {user.isActive === false ? 'Activate' : 'Deactivate'}
          </button>
        </div>
        {linkUrl && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {linkType === 'invite' ? 'Set password' : 'Magic login'}
            </span>
            <code className="max-w-xs truncate text-xs text-slate-600">{linkUrl}</code>
            <CopyButton text={linkUrl} label="Copy" />
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function AdminUsers() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [formError, setFormError] = useState<string | null>(null);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: api.listUsers,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createUser({ name, email, role }),
    onSuccess: (data) => {
      setNewInviteUrl(data.inviteUrl);
      setName('');
      setEmail('');
      setRole('member');
      setShowForm(false);
      setFormError(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : 'Could not create user'),
  });

  return (
    <div className="page-shell overflow-y-auto">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Users</h1>
            <p className="mt-1 text-sm text-slate-500">
              Create accounts and copy set-password or magic login links to share manually.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => {
              setShowForm((v) => !v);
              setNewInviteUrl(null);
              setFormError(null);
            }}
          >
            <PlusIcon className="h-4 w-4" />
            Add user
          </button>
        </div>

        {newInviteUrl && (
          <div className="mb-4 rounded-xl border border-[#2fc6f6]/30 bg-[#2fc6f6]/5 p-4">
            <p className="text-sm font-medium text-slate-800">User created — share this set-password link:</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs text-slate-700">
                {newInviteUrl}
              </code>
              <CopyButton text={newInviteUrl} label="Copy link" />
            </div>
          </div>
        )}

        {showForm && (
          <form
            className="card mb-6 space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
          >
            <h2 className="text-sm font-semibold text-slate-900">New user</h2>
            {formError && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Name</label>
                <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Role</label>
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create & get link'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="card overflow-hidden">
          {isLoading ? (
            <p className="p-6 text-sm text-slate-500">Loading users…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onUpdated={() => qc.invalidateQueries({ queryKey: ['admin-users'] })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

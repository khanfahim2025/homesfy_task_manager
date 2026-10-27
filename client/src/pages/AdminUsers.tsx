import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  KeyIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { api, ApiError } from '../api/client';
import type { Role, Team, User } from '../types';
import { CopyButton } from '../components/CopyButton';
import { getAvatarColor, getInitials, TEAM_LABELS, TEAM_ORDER } from '../lib/format';

type FilterTab = 'all' | 'active' | 'inactive';

function RoleBadge({ role }: { role: Role }) {
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
        isAdmin
          ? 'bg-[#2fc6f6]/10 text-[#137fa8] ring-1 ring-[#2fc6f6]/15'
          : isManager
            ? 'bg-[#121826]/5 text-[#121826] ring-1 ring-slate-200/80'
          : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
      }`}
    >
      {(isAdmin || isManager) && <ShieldCheckIcon className="h-3 w-3" />}
      {role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function TeamBadge({ team }: { team: Team }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[#2fc6f6]/10 px-2.5 py-0.5 text-xs font-semibold text-[#137fa8] ring-1 ring-[#2fc6f6]/15">
      {TEAM_LABELS[team]}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: typeof UserGroupIcon;
  tone?: 'default' | 'cyan' | 'green' | 'indigo';
}) {
  const tones = {
    default: 'bg-slate-50 text-slate-600',
    cyan: 'bg-[#2fc6f6]/10 text-[#1a8fb8]',
    green: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-[#121826]/5 text-[#121826]',
  };

  return (
    <div className="admin-stat-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function LinkBanner({
  title,
  url,
  onDismiss,
}: {
  title: string;
  url: string;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-[#2fc6f6]/25 bg-gradient-to-r from-[#2fc6f6]/8 to-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2fc6f6]/15">
            <CheckCircleIcon className="h-5 w-5 text-[#1a8fb8]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="mt-0.5 text-xs text-slate-500">Copy and send this link to the team member.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs text-slate-700">
                {url}
              </code>
              <CopyButton text={url} label="Copy link" />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-slate-600"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function AddUserModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (inviteUrl: string) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [team, setTeam] = useState<Team>('tech');
  const [formError, setFormError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => api.createUser({ name, email, role, team }),
    onSuccess: (data) => {
      setName('');
      setEmail('');
      setRole('member');
      setTeam('tech');
      setFormError(null);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      onCreated(data.inviteUrl);
      onClose();
    },
    onError: (err) =>
      setFormError(err instanceof ApiError ? err.message : 'Could not create user'),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add team member</h2>
            <p className="mt-0.5 text-sm text-slate-500">Create an account and get a set-password link.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form
          className="space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          {formError && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
              {formError}
            </div>
          )}

          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              required
              autoFocus
              placeholder="Ashwini Poojary"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Work email</label>
            <input
              type="email"
              className="input"
              required
              placeholder="name@homesfy.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(['member', 'manager', 'admin'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRole(option)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    role === option
                      ? 'border-[#2fc6f6] bg-[#2fc6f6]/5 ring-2 ring-[#2fc6f6]/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-semibold capitalize text-slate-800">{option}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {option === 'admin'
                      ? 'Full access'
                      : option === 'manager'
                        ? 'Manage team'
                        : 'Work on tasks'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Team</label>
            <div className="grid grid-cols-2 gap-2">
              {TEAM_ORDER.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTeam(option)}
                  className={`rounded-xl border px-3 py-3 text-left transition ${
                    team === option
                      ? 'border-[#2fc6f6] bg-[#2fc6f6]/5 ring-2 ring-[#2fc6f6]/20'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-800">{TEAM_LABELS[option]}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {option === 'tech' ? 'Website, QA, product' : 'Creative, content, campaigns'}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create & get link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserRow({
  user,
  onUpdated,
}: {
  user: User;
  onUpdated: () => void;
}) {
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<'invite' | 'login' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = user.isActive !== false;

  const updateMutation = useMutation({
    mutationFn: (input: { role?: Role; team?: Team; isActive?: boolean }) => api.updateUser(user.id, input),
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

  const toggleActive = () => {
    const next = !active;
    if (!next && !window.confirm(`Deactivate ${user.name}? They will not be able to sign in.`)) {
      return;
    }
    updateMutation.mutate({ isActive: next });
  };

  const changeTeam = (team: Team) => {
    updateMutation.mutate({ team });
  };

  return (
    <>
      <tr className="admin-user-row">
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`avatar h-10 w-10 text-xs ${getAvatarColor(user.name)}`}>
              {getInitials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{user.name}</div>
              <div className="truncate text-sm text-slate-500">{user.email}</div>
            </div>
          </div>
        </td>
        <td className="px-5 py-4">
          <RoleBadge role={user.role} />
        </td>
        <td className="px-5 py-4">
          <TeamBadge team={user.team} />
        </td>
        <td className="px-5 py-4">
          <StatusBadge active={active} />
        </td>
        <td className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className="admin-action-btn"
              disabled={inviteMutation.isPending || !active}
              onClick={() => inviteMutation.mutate()}
              title="Generate set-password link"
            >
              <KeyIcon className="h-3.5 w-3.5" />
              Set-password
            </button>
            <button
              type="button"
              className="admin-action-btn"
              disabled={loginMutation.isPending || !active}
              onClick={() => loginMutation.mutate()}
              title="Generate magic login link"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              Login link
            </button>
            <select
              className="admin-action-btn cursor-pointer"
              value={user.role}
              disabled={updateMutation.isPending}
              onChange={(e) => updateMutation.mutate({ role: e.target.value as Role })}
              title="Change role"
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
            <select
              className="admin-action-btn cursor-pointer"
              value={user.team}
              disabled={updateMutation.isPending}
              onChange={(e) => changeTeam(e.target.value as Team)}
              title="Change team"
            >
              {TEAM_ORDER.map((team) => (
                <option key={team} value={team}>
                  {TEAM_LABELS[team]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`admin-action-btn ${active ? 'text-red-600 hover:border-red-200 hover:bg-red-50 hover:text-red-700' : ''}`}
              disabled={updateMutation.isPending}
              onClick={toggleActive}
            >
              {active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </td>
      </tr>
      {linkUrl && (
        <tr className="bg-[#2fc6f6]/[0.03]">
          <td colSpan={5} className="border-t border-[#2fc6f6]/10 px-5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a8fb8]">
                {linkType === 'invite' ? 'Set-password link' : 'Magic login link'}
              </span>
              <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 ring-1 ring-slate-200/80">
                {linkUrl}
              </code>
              <CopyButton text={linkUrl} label="Copy" />
              <button
                type="button"
                className="text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => {
                  setLinkUrl(null);
                  setLinkType(null);
                }}
              >
                Dismiss
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function AdminUsers() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: api.listUsers,
  });

  const stats = useMemo(() => {
    const active = users.filter((u) => u.isActive !== false).length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const managers = users.filter((u) => u.role === 'manager').length;
    const tech = users.filter((u) => u.team === 'tech').length;
    const digital = users.filter((u) => u.team === 'digital').length;
    return {
      total: users.length,
      active,
      inactive: users.length - active,
      admins,
      members: users.length - admins,
      managers,
      tech,
      digital,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (filter === 'active' && user.isActive === false) return false;
      if (filter === 'inactive' && user.isActive !== false) return false;
      if (!q) return true;
      return (
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.role.toLowerCase().includes(q) ||
        TEAM_LABELS[user.team].toLowerCase().includes(q)
      );
    });
  }, [users, search, filter]);

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: users.length },
    { id: 'active', label: 'Active', count: stats.active },
    { id: 'inactive', label: 'Inactive', count: stats.inactive },
  ];

  return (
    <div className="page-shell overflow-y-auto">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2fc6f6]">
              Owner dashboard
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Team & staff
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
              Create accounts for your team, generate set-password and magic login links, and manage
              roles from one place.
            </p>
          </div>
          <button
            type="button"
            className="btn-primary inline-flex shrink-0 items-center gap-2 shadow-md shadow-[#2fc6f6]/20"
            onClick={() => setShowModal(true)}
          >
            <PlusIcon className="h-4 w-4" />
            Add user
          </button>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total team" value={stats.total} icon={UserGroupIcon} tone="cyan" />
          <StatCard label="Active" value={stats.active} icon={CheckCircleIcon} tone="green" />
          <StatCard label="Tech Team" value={stats.tech} icon={ShieldCheckIcon} tone="indigo" />
          <StatCard label="Digital Team" value={stats.digital} icon={UserPlusIcon} />
        </div>

        {newInviteUrl && (
          <LinkBanner
            title="New team member created"
            url={newInviteUrl}
            onDismiss={() => setNewInviteUrl(null)}
          />
        )}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input pl-9"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl bg-white/70 p-1 ring-1 ring-slate-200/80">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
                <span className="ml-1.5 tabular-nums text-slate-400">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2fc6f6] border-t-transparent" />
              Loading team…
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <UserGroupIcon className="h-7 w-7 text-slate-400" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-800">
                {search || filter !== 'all' ? 'No matching team members' : 'No team members yet'}
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {search || filter !== 'all'
                  ? 'Try a different search or filter.'
                  : 'Add your first staff account to get started.'}
              </p>
              {!search && filter === 'all' && (
                <button
                  type="button"
                  className="btn-primary mt-5 inline-flex items-center gap-2"
                  onClick={() => setShowModal(true)}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add user
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
                    <th className="px-5 py-3.5">User</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Team</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => (
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

      <AddUserModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={setNewInviteUrl}
      />
    </div>
  );
}

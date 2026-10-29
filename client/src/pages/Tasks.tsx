import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExclamationTriangleIcon,
  FunnelIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PlusIcon,
  RectangleGroupIcon,
  TrophyIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { api } from '../api/client';
import type { Task, TaskCategory, TaskPriority, TaskStatus, Team } from '../types';
import {
  CATEGORY_LABELS,
  KANBAN_COLUMN_COLORS,
  KANBAN_COLUMN_LABELS,
  KANBAN_COLUMN_ORDER,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  TEAM_LABELS,
  TEAM_ORDER,
  formatDueDateTime,
  type KanbanColumnId,
  getAvatarColor,
  getInitials,
  getKanbanColumn,
  isOverdue,
} from '../lib/format';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { DueDateEditor } from '../components/DueDateEditor';
import { DomainLink } from '../components/DomainLink';
import { useAuth } from '../context/AuthContext';

type ViewMode = 'board' | 'list';
type DueFilter = '' | 'overdue' | 'today' | 'week' | 'none';

function isToday(value: string | null): boolean {
  if (!value) return false;
  const due = new Date(value);
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function isThisWeek(value: string | null): boolean {
  if (!value) return false;
  const due = new Date(value).getTime();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return due >= start.getTime() && due <= end.getTime();
}

function TaskMeta({ task }: { task: Task }) {
  const comments = task._count?.comments ?? task.comments?.length ?? 0;
  const attachments = task._count?.attachments ?? task.attachments?.length ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-400">
      <span className="inline-flex items-center gap-1">
        <CalendarDaysIcon className="h-3.5 w-3.5" />
        {task.dueDate ? formatDueDateTime(task.dueDate) : 'No due date'}
      </span>
      <span className="inline-flex items-center gap-1">
        <TrophyIcon className="h-3.5 w-3.5" />
        {task.effortPoints} pts
      </span>
      {attachments > 0 && (
        <span className="inline-flex items-center gap-1">
          <PaperClipIcon className="h-3.5 w-3.5" />
          {attachments}
        </span>
      )}
      {comments > 0 && <span>{comments} comment{comments !== 1 ? 's' : ''}</span>}
    </div>
  );
}

function PerformanceSummary({
  leaderboard,
  loading,
}: {
  leaderboard: {
    rank: number;
    user: { id: string; name: string; email: string; team: string; avatarUrl?: string | null };
    points: number;
    completedTasks: number;
  }[];
  loading: boolean;
}) {
  const leader = leaderboard[0];

  return (
    <div className="header-summary-chip">
      <TrophyIcon className="h-3.5 w-3.5 text-[#137fa8]" />
      <span className="font-semibold text-slate-700">Performance</span>
      <span className="text-slate-300">•</span>
      <span className="truncate text-slate-500">
        {loading
          ? 'Loading points'
          : leader
            ? `${leader.user.name} leads · ${leader.points} pts`
            : 'Complete tasks to start scoring'}
      </span>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const people = task.assignees?.length
    ? task.assignees
    : task.assignee
      ? [task.assignee]
      : [];
  const overdue = isOverdue(task);

  return (
    <Link to={`/tasks/${task.id}`} className="task-card group">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#1a6fa0]">
          {task.title}
        </h3>
        <PriorityBadge priority={task.priority} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-[#2fc6f6]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#137fa8]">
          {TEAM_LABELS[task.team]}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {CATEGORY_LABELS[task.category]}
        </span>
        {overdue && (
          <span className="rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600">
            Overdue
          </span>
        )}
      </div>

      {task.domainName && (
        <div className="relative z-10 mt-1.5">
          <DomainLink
            domain={task.domainName}
            embedded
            className="truncate text-xs font-medium"
          />
        </div>
      )}
      {task.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{task.description}</p>
      )}

      <div className="mt-3">
        <TaskMeta task={task} />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
        <div className="flex items-center gap-1">
          {people.length === 0 ? (
            <span className="text-xs text-slate-400">Unassigned</span>
          ) : (
            <>
              {people.slice(0, 3).map((person) => (
                <div
                  key={person.id}
                  className={`avatar h-6 w-6 text-[9px] ring-2 ring-white ${getAvatarColor(person.name)}`}
                  title={person.name}
                >
                  {getInitials(person.name)}
                </div>
              ))}
              {people.length > 3 && (
                <span className="ml-1 text-[10px] font-medium text-slate-400">+{people.length - 3}</span>
              )}
            </>
          )}
        </div>
        <DueDateEditor taskId={task.id} dueDate={task.dueDate} status={task.status} compact />
      </div>
    </Link>
  );
}

function KanbanColumn({ columnId, tasks }: { columnId: KanbanColumnId; tasks: Task[] }) {
  return (
    <div className="kanban-column">
      <div className={`kanban-column-header ${KANBAN_COLUMN_COLORS[columnId]}`}>
        <span>{KANBAN_COLUMN_LABELS[columnId]}</span>
        <span className="rounded-md bg-white/25 px-1.5 py-0.5 text-[11px] font-bold">
          {tasks.length}
        </span>
      </div>
      <div className="kanban-column-body">
        {tasks.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
            No tasks
          </div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
        <Link
          to="/tasks/new"
          className="flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-slate-400 transition hover:bg-white hover:text-[#2fc6f6]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Quick task
        </Link>
      </div>
    </div>
  );
}

function CompactStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'danger' | 'success' | 'brand';
}) {
  const tones = {
    default: 'text-slate-950',
    danger: 'text-red-600',
    success: 'text-emerald-600',
    brand: 'text-[#137fa8]',
  };

  return (
    <div className="header-stat-chip">
      <span className={`text-sm font-bold leading-none ${tones[tone]}`}>{value}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`min-w-0 ${className}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <select
        className="input h-10 cursor-pointer rounded-lg border-slate-200 bg-white px-3 py-2 text-xs shadow-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <div className="card min-h-0 overflow-hidden">
      <div className="hidden border-b border-slate-100 bg-slate-50/80 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 md:grid md:grid-cols-[minmax(240px,1fr)_150px_130px_140px_180px]">
        <span>Ticket</span>
        <span>Status</span>
        <span>Priority</span>
        <span>Assignees</span>
        <span>Due</span>
      </div>
      <div className="divide-y divide-slate-100 overflow-y-auto">
        {tasks.map((task) => {
          const people = task.assignees?.length
            ? task.assignees
            : task.assignee
              ? [task.assignee]
              : [];

          return (
            <Link key={task.id} to={`/tasks/${task.id}`} className="ticket-row group">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900 group-hover:text-[#1a6fa0]">
                    {task.title}
                  </span>
                  {isOverdue(task) && (
                    <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600">
                      Late
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-[#137fa8]">{TEAM_LABELS[task.team]}</span>
                  <span>{CATEGORY_LABELS[task.category]}</span>
                  <span>{task.effortPoints} pts</span>
                  {task.domainName && <DomainLink domain={task.domainName} embedded className="max-w-[220px] truncate text-xs" />}
                </div>
              </div>
              <div><StatusBadge status={task.status} /></div>
              <div><PriorityBadge priority={task.priority} /></div>
              <div className="flex items-center gap-1">
                {people.length === 0 ? (
                  <span className="text-xs text-slate-400">Unassigned</span>
                ) : (
                  people.slice(0, 3).map((person) => (
                    <div
                      key={person.id}
                      className={`avatar h-6 w-6 text-[9px] ${getAvatarColor(person.name)}`}
                      title={person.name}
                    >
                      {getInitials(person.name)}
                    </div>
                  ))
                )}
              </div>
              <div className="text-xs font-medium text-slate-500">{formatDueDateTime(task.dueDate)}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { user } = useAuth();
  const q = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') as TaskStatus | '') || '';
  const priority = (searchParams.get('priority') as TaskPriority | '') || '';
  const category = (searchParams.get('category') as TaskCategory | '') || '';
  const team = (searchParams.get('team') as Team | '') || '';
  const assignee = searchParams.get('assignee') ?? '';
  const due = (searchParams.get('due') as DueFilter) || '';
  const view = ((searchParams.get('view') as ViewMode | null) ?? 'board') as ViewMode;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set(key, value.trim());
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', { q, status, team }],
    queryFn: () =>
      api.listTasks({
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
        ...(team ? { team } : {}),
      }),
  });

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.listAssignableUsers });
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery({
    queryKey: ['task-leaderboard', { team }],
    queryFn: () => api.getTaskLeaderboard(team ? { team } : {}),
  });

  const filteredTasks = tasks.filter((task) => {
    if (priority && task.priority !== priority) return false;
    if (category && task.category !== category) return false;
    if (team && task.team !== team) return false;
    if (assignee === 'me' && !task.assignees?.some((u) => u.id === user?.id) && task.assigneeId !== user?.id) return false;
    if (assignee && assignee !== 'me' && !task.assignees?.some((u) => u.id === assignee) && task.assigneeId !== assignee) return false;
    if (due === 'overdue' && !isOverdue(task)) return false;
    if (due === 'today' && !isToday(task.dueDate)) return false;
    if (due === 'week' && !isThisWeek(task.dueDate)) return false;
    if (due === 'none' && task.dueDate) return false;
    return true;
  });

  const grouped = KANBAN_COLUMN_ORDER.map((columnId) => ({
    columnId,
    tasks: filteredTasks
      .filter((t) => getKanbanColumn(t) === columnId)
      .sort((a, b) => {
        if (columnId !== 'due') return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }),
  }));

  const totalCount = filteredTasks.length;
  const allCount = tasks.length;
  const activeCount = filteredTasks.filter((t) => !['done', 'closed'].includes(t.status)).length;
  const overdueCount = filteredTasks.filter(isOverdue).length;
  const doneCount = filteredTasks.filter((t) => t.status === 'done' || t.status === 'closed').length;
  const techCount = filteredTasks.filter((t) => t.team === 'tech').length;
  const digitalCount = filteredTasks.filter((t) => t.team === 'digital').length;
  const assignedToMeCount = filteredTasks.filter(
    (t) => t.assigneeId === user?.id || t.assignees?.some((u) => u.id === user?.id)
  ).length;
  const hasFilters = Boolean(q || status || priority || category || team || assignee || due);
  const activeFilterCount = [status, priority, category, team, assignee, due].filter(Boolean).length;

  const clearFilters = () => setSearchParams(view === 'list' ? new URLSearchParams({ view }) : new URLSearchParams(), { replace: true });

  return (
    <div className="page-shell">
      <section className="workspace-hero-compact mb-3 shrink-0">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2fc6f6]/20 bg-[#2fc6f6]/10 text-[#137fa8]">
                <RectangleGroupIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-slate-950">Tickets</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                    <UsersIcon className="h-3.5 w-3.5" />
                    {user?.role === 'admin' ? 'All teams' : 'My tasks'}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{totalCount} visible</span>
                  {user?.role === 'admin' && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span>Tech {techCount} · Digital {digitalCount}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <CompactStat label="Active" value={activeCount} tone="brand" />
              <CompactStat label="Mine" value={assignedToMeCount} />
              <CompactStat label="Risk" value={overdueCount} tone="danger" />
              <CompactStat label="Done" value={doneCount} tone="success" />
            </div>
            <PerformanceSummary leaderboard={leaderboard} loading={leaderboardLoading} />
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 2xl:justify-end">
            <label className="relative min-w-[220px] flex-1 sm:max-w-sm xl:max-w-md">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input h-10 rounded-lg border-slate-200 bg-white pl-10 shadow-none"
                placeholder="Search tickets..."
                value={q}
                onChange={(e) => setParam('q', e.target.value)}
              />
            </label>
            <button
              type="button"
              className={`quick-filter-btn ${assignee === 'me' ? 'quick-filter-btn-active' : ''}`}
              onClick={() => setParam('assignee', assignee === 'me' ? '' : 'me')}
            >
              <UserCircleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">My work</span>
            </button>
            <button
              type="button"
              className={`quick-filter-btn ${due === 'overdue' ? 'quick-filter-btn-active' : ''}`}
              onClick={() => setParam('due', due === 'overdue' ? '' : 'overdue')}
            >
              <ExclamationTriangleIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Overdue</span>
            </button>
            <button
              type="button"
              className={`filter-trigger ${filtersOpen || activeFilterCount > 0 ? 'filter-trigger-active' : ''}`}
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              title="Filters"
            >
              <FunnelIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-md bg-[#137fa8] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
              {filtersOpen ? (
                <ChevronUpIcon className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
            </button>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className={`view-toggle ${view === 'board' ? 'view-toggle-active' : ''}`}
                onClick={() => setParam('view', 'board')}
                title="Board view"
              >
                <RectangleGroupIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Board</span>
              </button>
              <button
                type="button"
                className={`view-toggle ${view === 'list' ? 'view-toggle-active' : ''}`}
                onClick={() => setParam('view', 'list')}
                title="List view"
              >
                <ListBulletIcon className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
            <span className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-500 md:inline-flex">
              {totalCount} of {allCount}
            </span>
            {hasFilters && (
              <button type="button" className="hidden text-xs font-semibold text-[#1595c0] hover:underline md:inline-flex" onClick={clearFilters}>
                Clear
              </button>
            )}
            <Link to="/tasks/new" className="btn-create h-10 shrink-0 text-xs sm:text-sm">
              <PlusIcon className="h-4 w-4" />
              New task
              <ChevronDownIcon className="h-3.5 w-3.5 opacity-70" />
            </Link>
          </div>
        </div>
      </section>

      {filtersOpen && (
        <div className="workspace-toolbar-compact mb-3 shrink-0">
          <div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {user?.role === 'admin' && (
              <FilterSelect
                label="Team"
                value={team}
                onChange={(value) => setParam('team', value)}
              >
                <option value="">All teams</option>
                {TEAM_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TEAM_LABELS[t]}
                  </option>
                ))}
              </FilterSelect>
            )}
            <FilterSelect
              label="Status"
              value={status}
              onChange={(value) => setParam('status', value)}
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Priority"
              value={priority}
              onChange={(value) => setParam('priority', value)}
            >
              <option value="">All priority</option>
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Type"
              value={category}
              onChange={(value) => setParam('category', value)}
            >
              <option value="">All categories</option>
              {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Owner"
              value={assignee}
              onChange={(value) => setParam('assignee', value)}
            >
              <option value="">Anyone</option>
              <option value="me">Assigned to me</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Due"
              value={due}
              onChange={(value) => setParam('due', value)}
            >
              <option value="">Any due date</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">Due this week</option>
              <option value="none">No due date</option>
            </FilterSelect>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 md:hidden">
              <span>{totalCount} of {allCount} tickets visible</span>
              {hasFilters && (
                <button type="button" className="font-semibold text-[#1595c0] hover:underline" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2fc6f6] border-t-transparent" />
            Loading tasks…
          </div>
        </div>
      ) : filteredTasks.length === 0 && !hasFilters ? (
        <div className="glass-panel flex flex-1 flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2fc6f6]/10">
            <PlusIcon className="h-8 w-8 text-[#2fc6f6]" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">No tickets yet</h2>
          <p className="mt-1 text-sm text-slate-500">Raise the first ticket and start tracking work cleanly.</p>
          <Link to="/tasks/new" className="btn-create mt-5">
            <PlusIcon className="h-4 w-4" />
            Raise ticket
          </Link>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="card flex flex-1 flex-col items-center justify-center p-12 text-center">
          <UserCircleIcon className="mb-3 h-12 w-12 text-slate-300" />
          <h2 className="text-base font-semibold text-slate-800">No tickets match these filters</h2>
          <p className="mt-1 text-sm text-slate-500">Adjust the filters or clear them to return to the full workspace.</p>
          <button type="button" className="btn-secondary mt-5" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : view === 'list' ? (
        <TaskTable tasks={filteredTasks} />
      ) : (
        <div className="workspace-board">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-950">Board</h2>
            </div>
            <div className="hidden items-center gap-2 text-xs font-medium text-slate-400 sm:flex">
              <RectangleGroupIcon className="h-4 w-4" />
              {grouped.length} stages
            </div>
          </div>
          <div className="board-scroll">
            {grouped.map((group) => (
              <KanbanColumn key={group.columnId} columnId={group.columnId} tasks={group.tasks} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

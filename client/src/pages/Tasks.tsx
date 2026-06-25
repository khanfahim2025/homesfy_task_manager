import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDownIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { api } from '../api/client';
import type { Task, TaskStatus } from '../types';
import {
  KANBAN_COLUMN_COLORS,
  KANBAN_COLUMN_LABELS,
  KANBAN_COLUMN_ORDER,
  type KanbanColumnId,
  getAvatarColor,
  getInitials,
  getKanbanColumn,
  STATUS_LABELS,
  STATUS_ORDER,
} from '../lib/format';
import { PriorityBadge } from '../components/Badges';
import { DueDateEditor } from '../components/DueDateEditor';

function TaskCard({ task }: { task: Task }) {
  const people = task.assignees?.length
    ? task.assignees
    : task.assignee
      ? [task.assignee]
      : [];

  return (
    <Link to={`/tasks/${task.id}`} className="task-card group">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-snug text-slate-800 group-hover:text-[#1a6fa0]">
          {task.title}
        </h3>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.domainName && (
        <p className="mt-1.5 truncate text-xs font-medium text-[#2fc6f6]">{task.domainName}</p>
      )}
      {task.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">{task.description}</p>
      )}

      {(task._count?.attachments ?? 0) > 0 && (
        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          {task._count?.attachments} attachment{task._count?.attachments !== 1 ? 's' : ''}
        </p>
      )}

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

export function Tasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const status = (searchParams.get('status') as TaskStatus | '') || '';

  const setQ = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('q', value.trim());
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };

  const setStatus = (value: TaskStatus | '') => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('status', value);
    else next.delete('status');
    setSearchParams(next, { replace: true });
  };

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', { q, status }],
    queryFn: () =>
      api.listTasks({
        ...(q ? { q } : {}),
        ...(status ? { status } : {}),
      }),
  });

  const grouped = KANBAN_COLUMN_ORDER.map((columnId) => ({
    columnId,
    tasks: tasks
      .filter((t) => getKanbanColumn(t) === columnId)
      .sort((a, b) => {
        if (columnId !== 'due') return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }),
  }));

  const totalCount = tasks.length;

  return (
    <div className="page-shell">
      {/* Page header */}
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Tasks</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {totalCount} task{totalCount !== 1 ? 's' : ''} across all stages
          </p>
        </div>
        <Link to="/tasks/new" className="btn-create shrink-0 text-xs sm:text-sm">
          <PlusIcon className="h-4 w-4" />
          Create
          <ChevronDownIcon className="h-3.5 w-3.5 opacity-70" />
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Search title or project id…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          className="input w-full cursor-pointer sm:w-auto sm:min-w-[160px]"
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus | '')}
        >
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2fc6f6] border-t-transparent" />
            Loading tasks…
          </div>
        </div>
      ) : tasks.length === 0 && !q && !status ? (
        <div className="glass-panel flex flex-1 flex-col items-center justify-center p-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2fc6f6]/10">
            <PlusIcon className="h-8 w-8 text-[#2fc6f6]" />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">No tasks yet</h2>
          <p className="mt-1 text-sm text-slate-500">Create your first task to get started</p>
          <Link to="/tasks/new" className="btn-create mt-5">
            <PlusIcon className="h-4 w-4" />
            Create task
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {grouped.map((group) => (
            <KanbanColumn key={group.columnId} columnId={group.columnId} tasks={group.tasks} />
          ))}
        </div>
      )}
    </div>
  );
}

import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { api } from '../api/client';
import { TaskCreateForm } from '../components/TaskCreateForm';
import { useAuth } from '../context/AuthContext';
import type { Task, TaskInput } from '../types';

function toInitial(task: Task): Partial<TaskInput> {
  return {
    title: task.title,
    description: task.description ?? '',
    status: task.status,
    priority: task.priority,
    category: task.category,
    team: task.team,
    effortPoints: task.effortPoints,
    dueDate: task.dueDate ?? '',
    assigneeIds: task.assignees?.map((u) => u.id) ?? (task.assignee ? [task.assignee.id] : []),
    observerIds: task.observers?.map((u) => u.id) ?? [],
    participantIds: task.participants?.map((u) => u.id) ?? [],
    domainName: task.domainName ?? '',
    templateUrl: task.templateUrl ?? '',
    docFileLink: task.docFileLink ?? '',
    locationIframe: task.locationIframe ?? '',
    gtmHead: task.gtmHead ?? '',
    gtmBody: task.gtmBody ?? '',
    contentText: task.contentText ?? '',
    contentUrls: task.contentUrls ?? '',
  };
}

export function TaskEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.getTask(id),
  });

  if (isLoading) return <div className="page-shell text-slate-500">Loading…</div>;
  if (error || !task) return <Navigate to="/tasks" replace />;
  // Only the admin or the person who created the task can edit it.
  if (user?.role !== 'admin' && user?.id !== task.creatorId) {
    return <Navigate to={`/tasks/${id}`} replace />;
  }

  return (
    <div className="page-shell overflow-y-auto">
      <div className="mx-auto mb-5 w-full max-w-7xl">
        <Link to={`/tasks/${id}`} className="link-back inline-flex shrink-0">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to task
        </Link>
      </div>
      <TaskCreateForm
        initial={toInitial(task)}
        submitLabel="Save changes"
        onCancel={() => navigate(`/tasks/${id}`)}
        onSubmit={(data) => api.updateTask(id, data)}
        onSuccess={() => {
          void qc.invalidateQueries({ queryKey: ['task', id] });
          void qc.invalidateQueries({ queryKey: ['tasks'] });
          navigate(`/tasks/${id}`);
        }}
      />
    </div>
  );
}

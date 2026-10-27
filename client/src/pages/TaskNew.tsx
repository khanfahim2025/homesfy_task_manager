import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon, BoltIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { api } from '../api/client';
import { TaskCreateForm } from '../components/TaskCreateForm';

export function TaskNew() {
  const navigate = useNavigate();

  return (
    <div className="page-shell overflow-y-auto">
      <div className="mx-auto mb-5 flex w-full max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link to="/tasks" className="link-back mb-3 inline-flex shrink-0">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to tickets
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#2fc6f6]/10 text-[#137fa8]">
              <BoltIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">New task</h1>
              <p className="mt-1 text-sm text-slate-500">
                Create one clean request and route it to the right team.
              </p>
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm sm:flex">
          <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
          Universal workflow
        </div>
      </div>
      <TaskCreateForm
        onCancel={() => navigate('/tasks')}
        onSuccess={(id) => navigate(`/tasks/${id}`)}
        onSubmit={(data) => api.createTask(data)}
      />
    </div>
  );
}

import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { api } from '../api/client';
import { TaskCreateForm } from '../components/TaskCreateForm';

export function TaskNew() {
  const navigate = useNavigate();

  return (
    <div className="page-shell overflow-y-auto">
      <Link to="/tasks" className="link-back mb-6 inline-flex shrink-0">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to tasks
      </Link>
      <TaskCreateForm
        onCancel={() => navigate('/tasks')}
        onSuccess={(id) => navigate(`/tasks/${id}`)}
        onSubmit={(data) => api.createTask(data)}
      />
    </div>
  );
}

import { useAuth } from '../context/AuthContext';
import { useTaskNotifications } from '../hooks/useTaskNotifications';

/** Polls tasks and plays sounds for create, assign, done, closed, and content changes. */
export function TaskNotificationWatcher() {
  const { user } = useAuth();
  useTaskNotifications(user?.id);
  return null;
}

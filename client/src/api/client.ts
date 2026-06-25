import type {
  AppConfig,
  Attachment,
  Comment,
  Project,
  Task,
  TaskInput,
  User,
} from '../types';
import { suppressTaskNotifications } from '../lib/notificationSuppress';

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function maybeSuppressTaskNotification(path: string, method: string | undefined): void {
  if (!method || method === 'GET') return;
  if (path.startsWith('/tasks')) suppressTaskNotifications();
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method?.toUpperCase();
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers:
      options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json', ...options.headers }
        : options.headers,
    ...options,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'Request failed', data?.code);
  }
  maybeSuppressTaskNotification(path, method);
  return data as T;
}

export const api = {
  // auth
  getConfig: () => request<AppConfig>('/auth/config'),
  me: () => request<{ user: User }>('/auth/me').then((r) => r.user),
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then((r) => r.user),
  signup: (email: string, name: string, password: string) =>
    request<{ user: User }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    }).then((r) => r.user),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  verifyMagicLink: (token: string) =>
    request<{ user: User }>(`/auth/verify?token=${encodeURIComponent(token)}`, {
      headers: { Accept: 'application/json' },
    }).then((r) => r.user),
  verifySetPasswordToken: (token: string) =>
    request<{ email: string; valid: boolean }>(
      `/auth/set-password/verify?token=${encodeURIComponent(token)}`
    ),
  setPassword: (token: string, password: string) =>
    request<{ user: User }>('/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }).then((r) => r.user),

  // users
  listUsers: () => request<{ users: User[] }>('/users').then((r) => r.users),
  listAssignableUsers: () =>
    request<{ users: User[] }>('/users/assignable').then((r) => r.users),
  createUser: (input: { email: string; name: string; role?: string }) =>
    request<{ user: User; inviteUrl: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateUser: (id: string, input: { name?: string; role?: string; isActive?: boolean }) =>
    request<{ user: User }>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((r) => r.user),
  createInviteLink: (id: string) =>
    request<{ url: string }>(`/users/${id}/invite-link`, { method: 'POST' }),
  createLoginLink: (id: string) =>
    request<{ url: string }>(`/users/${id}/login-link`, { method: 'POST' }),

  // projects
  listProjects: () => request<{ projects: Project[] }>('/projects').then((r) => r.projects),
  createProject: (input: { name: string; primaryDomain?: string; projectCode?: string }) =>
    request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.project),

  // tasks
  listTasks: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ tasks: Task[] }>(`/tasks${qs ? `?${qs}` : ''}`).then((r) => r.tasks);
  },
  getTask: (id: string) => request<{ task: Task }>(`/tasks/${id}`).then((r) => r.task),
  createTask: (input: TaskInput) =>
    request<{ task: Task }>('/tasks', { method: 'POST', body: JSON.stringify(input) }).then(
      (r) => r.task
    ),
  updateTask: (id: string, input: Partial<TaskInput>) =>
    request<{ task: Task }>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((r) => r.task),
  updateTaskStatus: (id: string, status: string) =>
    request<{ task: Task }>(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).then((r) => r.task),
  deleteTask: (id: string) => request<{ ok: true }>(`/tasks/${id}`, { method: 'DELETE' }),

  // comments
  addComment: (taskId: string, body: string) =>
    request<{ comment: Comment }>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }).then((r) => r.comment),
  deleteComment: (taskId: string, commentId: string) =>
    request<{ ok: true }>(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' }),

  // attachments
  uploadAttachment: (taskId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<{ attachment: Attachment; attachments?: Attachment[] }>(
      `/tasks/${taskId}/attachments`,
      { method: 'POST', body: form }
    ).then((r) => r.attachment);
  },
  uploadAttachments: async (taskId: string, files: File[]) => {
    if (files.length === 0) return [];
    const form = new FormData();
    for (const file of files) form.append('files', file);
    const res = await request<{ attachments: Attachment[]; attachment?: Attachment }>(
      `/tasks/${taskId}/attachments`,
      { method: 'POST', body: form }
    );
    return res.attachments ?? (res.attachment ? [res.attachment] : []);
  },
  deleteAttachment: (taskId: string, attachmentId: string) =>
    request<{ ok: true }>(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' }),
};

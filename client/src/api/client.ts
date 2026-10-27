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

const UPLOAD_CONCURRENCY = 4;

async function runLimited<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
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
    const err = data?.error;
    const message = typeof err === 'string' ? err : err?.message ?? 'Request failed';
    throw new ApiError(res.status, message, data?.code ?? err?.code);
  }
  maybeSuppressTaskNotification(path, method);
  return data as T;
}

export const api = {
  // auth
  getConfig: () => request<AppConfig>('/auth/config'),
  me: () => request<{ user: User | null }>('/auth/me').then((r) => r.user),
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
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
  createUser: (input: { email: string; name: string; role?: string; team?: string }) =>
    request<{ user: User; inviteUrl: string }>('/users', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateUser: (id: string, input: { name?: string; role?: string; team?: string; isActive?: boolean }) =>
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
  getTasksVersion: () =>
    request<{ version: string }>('/tasks/version').then((r) => r.version),
  listTasks: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ tasks: Task[] }>(`/tasks${qs ? `?${qs}` : ''}`).then((r) => r.tasks);
  },
  getTaskLeaderboard: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{
      leaderboard: {
        rank: number;
        user: { id: string; name: string; email: string; team: string; avatarUrl?: string | null };
        points: number;
        completedTasks: number;
      }[];
    }>(`/tasks/points/leaderboard${qs ? `?${qs}` : ''}`).then((r) => r.leaderboard);
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

  // attachments: files go straight to S3 via presigned URLs, then get recorded.
  uploadAttachments: async (taskId: string, files: File[]) => {
    if (files.length === 0) return [];
    const meta = files.map((f) => ({
      name: f.name,
      type: f.type || 'application/octet-stream',
      size: f.size,
    }));
    const { uploads } = await request<{ uploads: { storedName: string; uploadUrl: string }[] }>(
      `/tasks/${taskId}/attachments/uploads`,
      { method: 'POST', body: JSON.stringify({ files: meta }) }
    );
    await runLimited(files, UPLOAD_CONCURRENCY, async (file, i) => {
      const res = await fetch(uploads[i].uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': meta[i].type },
        body: file,
      });
      if (!res.ok) throw new ApiError(res.status, `Upload failed for "${file.name}"`);
    });
    const { attachments } = await request<{ attachments: Attachment[] }>(
      `/tasks/${taskId}/attachments`,
      {
        method: 'POST',
        body: JSON.stringify({
          files: meta.map((m, i) => ({ storedName: uploads[i].storedName, name: m.name, type: m.type })),
        }),
      }
    );
    return attachments;
  },
  deleteAttachment: (taskId: string, attachmentId: string) =>
    request<{ ok: true }>(`/tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' }),
};

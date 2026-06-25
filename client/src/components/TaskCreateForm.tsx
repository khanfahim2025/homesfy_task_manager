import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { Task, TaskCategory, TaskInput, TaskPriority, TaskStatus } from '../types';
import {
  CATEGORY_LABELS,
  isWebsiteCategory,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '../lib/format';
import { UserMultiSelect } from './UserMultiSelect';
import { PendingAttachmentPicker } from './AttachmentPicker';

interface Props {
  initial?: Partial<TaskInput>;
  submitLabel?: string;
  onSubmit: (data: TaskInput) => Promise<Task>;
  onSuccess: (id: string) => void;
  onCancel: () => void;
}

const WEBSITE_FIELDS = [
  'domainName',
  'templateUrl',
  'docFileLink',
  'locationIframe',
  'gtmHead',
  'gtmBody',
] as const;

export function TaskCreateForm({
  initial,
  submitLabel = 'Create task',
  onSubmit,
  onSuccess,
  onCancel,
}: Props) {
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.listAssignableUsers });

  const [form, setForm] = useState<TaskInput>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'new',
    priority: initial?.priority ?? 'medium',
    category: initial?.category ?? 'website_development',
    dueDate: initial?.dueDate ?? '',
    assigneeIds: initial?.assigneeIds ?? (initial?.assigneeId ? [initial.assigneeId] : []),
    observerIds: initial?.observerIds ?? [],
    participantIds: initial?.participantIds ?? [],
    domainName: initial?.domainName ?? '',
    templateUrl: initial?.templateUrl ?? '',
    docFileLink: initial?.docFileLink ?? '',
    locationIframe: initial?.locationIframe ?? '',
    gtmHead: initial?.gtmHead ?? '',
    gtmBody: initial?.gtmBody ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const showWebsiteDetails = isWebsiteCategory(form.category ?? 'website_development');

  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setCategory = (category: TaskCategory) => {
    setForm((f) => {
      const next = { ...f, category };
      if (!isWebsiteCategory(category)) {
        for (const key of WEBSITE_FIELDS) next[key] = '';
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: TaskInput = {
        ...form,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        assigneeIds: form.assigneeIds ?? [],
        observerIds: form.observerIds ?? [],
        participantIds: form.participantIds ?? [],
      };

      if (!isWebsiteCategory(form.category ?? 'website_development')) {
        for (const key of WEBSITE_FIELDS) payload[key] = undefined;
      }

      const task = await onSubmit(payload);
      if (pendingFiles.length > 0) {
        await api.uploadAttachments(task.id, pendingFiles);
      }
      onSuccess(task.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  const isNew = submitLabel === 'Create task';

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-6">
        <div className="card space-y-6 p-4 sm:p-6">
          <h1 className="text-xl font-semibold text-slate-900">
            {isNew ? 'New task' : 'Edit task'}
          </h1>

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="label">Category</label>
            <select
              className="input"
              value={form.category}
              onChange={(e) => setCategory(e.target.value as TaskCategory)}
            >
              {(Object.keys(CATEGORY_LABELS) as TaskCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Title *</label>
            <input
              className="input"
              required
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Build landing page"
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className={`input ${showWebsiteDetails ? 'min-h-[90px]' : 'min-h-[180px]'}`}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>

        <div className="card space-y-3 p-4 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Attachments</h2>
            <p className="mt-0.5 text-xs text-slate-500">Optional — add now or upload later on the task page</p>
          </div>
          <PendingAttachmentPicker
            files={pendingFiles}
            onChange={setPendingFiles}
            disabled={saving}
          />
        </div>

        {showWebsiteDetails && (
          <fieldset className="card space-y-4 p-4 sm:p-6">
            <legend className="text-sm font-semibold text-slate-700">Website details</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Domain</label>
                <input
                  className="input"
                  value={form.domainName}
                  onChange={(e) => set('domainName', e.target.value)}
                  placeholder="example.com (auto-creates a project)"
                />
              </div>
              <div>
                <label className="label">Template URL</label>
                <input
                  className="input"
                  value={form.templateUrl}
                  onChange={(e) => set('templateUrl', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label">Doc / file link</label>
              <input
                className="input"
                value={form.docFileLink}
                onChange={(e) => set('docFileLink', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Location embed (iframe or Maps URL)</label>
              <textarea
                className="input min-h-[60px] font-mono text-xs"
                value={form.locationIframe}
                onChange={(e) => set('locationIframe', e.target.value)}
                placeholder='<iframe src="https://www.google.com/maps/embed?..."></iframe>'
              />
            </div>
            <div className="grid min-w-0 gap-4">
              <div className="min-w-0">
                <label className="label">GTM head snippet</label>
                <textarea
                  className="input min-h-[60px] font-mono text-xs"
                  value={form.gtmHead}
                  onChange={(e) => set('gtmHead', e.target.value)}
                />
              </div>
              <div className="min-w-0">
                <label className="label">GTM body snippet</label>
                <textarea
                  className="input min-h-[60px] font-mono text-xs"
                  value={form.gtmBody}
                  onChange={(e) => set('gtmBody', e.target.value)}
                />
              </div>
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap justify-end gap-3 pb-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving
              ? pendingFiles.length > 0
                ? 'Creating & uploading…'
                : 'Saving…'
              : submitLabel}
          </button>
        </div>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-0 lg:w-[360px] xl:w-[400px]">
        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">Details</h2>
          <div>
            <label className="label">Status</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => set('status', e.target.value as TaskStatus)}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priority</label>
            <select
              className="input"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value as TaskPriority)}
            >
              {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Due date</label>
            <input
              type="date"
              className="input"
              value={form.dueDate ? String(form.dueDate).slice(0, 10) : ''}
              onChange={(e) => set('dueDate', e.target.value)}
            />
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="text-sm font-semibold text-slate-900">People</h2>
          <UserMultiSelect
            label="Assignees"
            hint="People responsible for completing this task"
            users={users}
            value={form.assigneeIds ?? []}
            onChange={(ids) => set('assigneeIds', ids)}
          />
          <UserMultiSelect
            label="Observers"
            hint="People who follow updates on this task"
            users={users}
            value={form.observerIds ?? []}
            onChange={(ids) => set('observerIds', ids)}
          />
          <UserMultiSelect
            label="Participants"
            hint="People involved in working on this task"
            users={users}
            value={form.participantIds ?? []}
            onChange={(ids) => set('participantIds', ids)}
          />
        </div>
      </aside>
    </form>
  );
}

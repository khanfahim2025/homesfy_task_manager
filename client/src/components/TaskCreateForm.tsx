import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AdjustmentsHorizontalIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  PaperClipIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { api, ApiError } from '../api/client';
import type { Task, TaskCategory, TaskInput, TaskPriority, TaskStatus, Team } from '../types';
import {
  CATEGORY_LABELS,
  isWebsiteCategory,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  TEAM_LABELS,
  TEAM_ORDER,
} from '../lib/format';
import { UserMultiSelect } from './UserMultiSelect';
import { PendingAttachmentPicker } from './AttachmentPicker';
import { DueDateTimeInput } from './DueDateTimeInput';
import { useAuth } from '../context/AuthContext';

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

function PanelTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ClipboardDocumentListIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2fc6f6]/10 text-[#137fa8]">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

export function TaskCreateForm({
  initial,
  submitLabel = 'Create task',
  onSubmit,
  onSuccess,
  onCancel,
}: Props) {
  const { user } = useAuth();
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.listAssignableUsers });

  const [form, setForm] = useState<TaskInput>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    status: initial?.status ?? 'new',
    priority: initial?.priority ?? 'medium',
    category: initial?.category ?? 'general',
    team: initial?.team ?? user?.team ?? 'tech',
    effortPoints: initial?.effortPoints ?? 5,
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
    contentText: initial?.contentText ?? '',
    contentUrls: initial?.contentUrls ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set once the task exists, so retrying after a failed upload never creates a duplicate.
  const savedTaskId = useRef<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const showWebsiteDetails = isWebsiteCategory(form.category ?? 'website_development');
  const showBriefDetails = form.category === 'creative' || form.category === 'content_creation';
  const selectedTeam = (form.team ?? user?.team ?? 'tech') as Team;
  const isNew = submitLabel === 'Create task';
  const submitText = isNew ? 'Create ticket' : submitLabel;
  const canManagePoints = user?.role === 'admin' || user?.role === 'manager';

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

  const setTeam = (team: Team) => set('team', team);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: TaskInput = {
        ...form,
        category: form.category ?? 'general',
        team: selectedTeam,
        dueDate: form.dueDate || null,
        assigneeIds: form.assigneeIds ?? [],
        observerIds: form.observerIds ?? [],
        participantIds: form.participantIds ?? [],
      };

      // Fields that don't apply to the task type: left out on create, cleared on edit.
      const unused = isNew ? undefined : '';
      if (!isWebsiteCategory(form.category ?? 'website_development')) {
        for (const key of WEBSITE_FIELDS) payload[key] = unused;
      } else {
        payload.contentText = unused;
        payload.contentUrls = unused;
      }

      const taskId = savedTaskId.current ?? (await onSubmit(payload)).id;
      savedTaskId.current = taskId;
      if (pendingFiles.length > 0) {
        try {
          await api.uploadAttachments(taskId, pendingFiles);
        } catch (err) {
          const reason = err instanceof ApiError ? err.message : 'Upload failed';
          throw new ApiError(0, `Task saved, but files were not attached: ${reason}. Submit again to retry the upload.`);
        }
      }
      onSuccess(taskId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-5">
        <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#137fa8]">
                  Ticket composer
                </p>
                <h1 className="mt-1 text-xl font-semibold text-slate-950">
                  {isNew ? 'Create a universal task' : 'Edit task'}
                </h1>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
                <Squares2X2Icon className="h-4 w-4 text-[#137fa8]" />
                {TEAM_LABELS[selectedTeam]}
              </div>
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-6">
            <PanelTitle
              icon={ClipboardDocumentListIcon}
              title="What needs to get done?"
              description="Keep the request simple: title, outcome, context, and any blockers."
            />

          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <label className="label">Title *</label>
              <input
                className="input h-12 text-base font-medium"
                required
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Update pricing page, prepare campaign creatives"
              />
            </div>
            <div>
              <label className="label">Task type</label>
              <select
                className="input h-12"
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
          </div>

          <div>
            <label className="label">Details</label>
            <textarea
              className="input min-h-[210px] resize-y text-sm leading-relaxed"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Describe the expected output, context, requirements, links, and what done should look like."
            />
          </div>

          <div>
            <label className="label">Team</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEAM_ORDER.map((team) => (
                <button
                  key={team}
                  type="button"
                  disabled={user?.role !== 'admin' && team !== user?.team}
                  className={`category-tile ${selectedTeam === team ? 'category-tile-active' : ''}`}
                  onClick={() => setTeam(team)}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold uppercase text-slate-500">
                    {team.slice(0, 2)}
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block truncate text-sm font-semibold">{TEAM_LABELS[team]}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {team === 'tech' ? 'Product, website, QA, development' : 'Creative, content, campaigns'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          </div>
        </div>

        {showWebsiteDetails && (
          <fieldset className="card space-y-4 p-4 sm:p-6">
            <PanelTitle
              icon={AdjustmentsHorizontalIcon}
              title="Website details"
              description="Only needed for website tasks. Leave blank for ordinary work requests."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Domain</label>
                <input
                  className="input"
                  value={form.domainName}
                  onChange={(e) => set('domainName', e.target.value)}
                  placeholder="www.example.com (auto-creates a project)"
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

        {showBriefDetails && (
          <fieldset className="card space-y-4 p-4 sm:p-6">
            <PanelTitle
              icon={ClipboardDocumentListIcon}
              title="Specialized brief"
              description="Use this for campaign-specific creative or content instructions."
            />
            <div>
              <label className="label">
                {form.category === 'creative' ? 'Creative brief' : 'Content brief'}
              </label>
              <textarea
                className="input min-h-[130px]"
                value={form.contentText}
                onChange={(e) => set('contentText', e.target.value)}
                placeholder={
                  form.category === 'creative'
                    ? 'Mention sizes, formats, theme, copy, references, and revision notes.'
                    : 'Add target audience, tone, keywords, CTA, structure, and draft copy.'
                }
              />
            </div>
            <div>
              <label className="label">Reference URLs</label>
              <textarea
                className="input min-h-[80px]"
                value={form.contentUrls}
                onChange={(e) => set('contentUrls', e.target.value)}
                placeholder="Paste one or more links for references, assets, pages, or examples."
              />
            </div>
          </fieldset>
        )}

        <div className="card space-y-3 p-4 sm:p-6">
          <PanelTitle
            icon={PaperClipIcon}
            title="Attachments"
            description={
              isNew
                ? 'Optional files, screenshots, videos, documents, or references.'
                : 'Add more files. Existing files can be managed on the task page.'
            }
          />
          <PendingAttachmentPicker
            files={pendingFiles}
            onChange={setPendingFiles}
            disabled={saving}
          />
        </div>
      </div>

      <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-0">
        <div className="card space-y-4 p-5">
          <PanelTitle
            icon={CalendarDaysIcon}
            title="Schedule and priority"
            description="Set how the team should triage this work."
          />
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
            <label className="label">Effort points</label>
            <input
              type="number"
              min={1}
              max={100}
              className="input"
              value={form.effortPoints ?? 5}
              disabled={!canManagePoints}
              onChange={(e) => set('effortPoints', Number(e.target.value))}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Managers/admins control points. Due-date performance adjusts the final score.
            </p>
          </div>
          <div>
            <label className="label">Due date & time</label>
            <DueDateTimeInput
              value={form.dueDate || null}
              onChange={(iso) => set('dueDate', iso ?? '')}
            />
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <PanelTitle
            icon={UsersIcon}
            title="People"
            description="Anyone in the company can be added, from any team."
          />
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

        <div className="card p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-950">
              {isNew ? 'Ready to create?' : 'Save your changes?'}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {isNew
                ? `The task will appear in the ${TEAM_LABELS[selectedTeam]} queue immediately.`
                : 'Everyone on the task is notified that you updated it.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (isNew && pendingFiles.length > 0 ? 'Creating…' : 'Saving…') : submitText}
            </button>
          </div>
        </div>
      </aside>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { api, ApiError } from '../api/client';
import type { TaskStatus } from '../types';
import { STATUS_LABELS, STATUS_ORDER, formatDateTime } from '../lib/format';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { AttachmentThumbnailGrid } from '../components/AttachmentThumbnailGrid';
import { AttachmentUploadZone } from '../components/AttachmentPicker';
import { DueDateEditor } from '../components/DueDateEditor';
import { DomainLink } from '../components/DomainLink';
import { CodeSnippet } from '../components/CodeSnippet';
import { CopyButton } from '../components/CopyButton';
import { UserChipList, UserMultiSelect } from '../components/UserMultiSelect';
import { useAuth } from '../context/AuthContext';
import { embedPreviewSrc } from '../lib/embedPreview';

function statusButtonClass(status: TaskStatus, isActive: boolean, centered = false): string {
  const base = `w-full rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
    centered ? 'text-center' : 'text-left'
  }`;

  if (isActive && status === 'closed') {
    return `${base} bg-slate-900 py-2.5 text-sm font-bold text-white shadow-md ring-2 ring-slate-400 ring-offset-1`;
  }
  if (isActive) {
    return `${base} bg-[#2fc6f6] text-white`;
  }
  if (status === 'closed') {
    return `${base} border border-slate-300 bg-slate-100 font-bold text-slate-800 hover:border-slate-400 hover:bg-slate-200`;
  }
  return `${base} bg-slate-100 text-slate-600 hover:bg-slate-200`;
}

function Field({
  label,
  children,
  copyText,
}: {
  label: string;
  children: React.ReactNode;
  copyText?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
        {copyText ? <CopyButton text={copyText} /> : null}
      </div>
      <dd className="mt-1 min-w-0 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export function TaskDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [observerIds, setObserverIds] = useState<string[]>([]);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [peopleDirty, setPeopleDirty] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.getTask(id),
  });

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: api.listAssignableUsers });

  useEffect(() => {
    if (!task) return;
    setAssigneeIds(task.assignees?.map((u) => u.id) ?? (task.assignee ? [task.assignee.id] : []));
    setObserverIds(task.observers?.map((u) => u.id) ?? []);
    setParticipantIds(task.participants?.map((u) => u.id) ?? []);
    setPeopleDirty(false);
  }, [task]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['task', id] });
    qc.invalidateQueries({ queryKey: ['tasks'] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => api.updateTaskStatus(id, status),
    onSuccess: invalidate,
  });
  const commentMutation = useMutation({
    mutationFn: (body: string) => api.addComment(id, body),
    onSuccess: () => {
      setComment('');
      invalidate();
    },
  });
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => api.uploadAttachments(id, files),
    onSuccess: () => {
      setUploadError(null);
      invalidate();
    },
    onError: (err) => {
      setUploadError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
    },
  });
  const deleteAttachmentMutation = useMutation({
    mutationFn: (attachmentId: string) => api.deleteAttachment(id, attachmentId),
    onSuccess: invalidate,
  });
  const peopleMutation = useMutation({
    mutationFn: () =>
      api.updateTask(id, { assigneeIds, observerIds, participantIds }),
    onSuccess: () => {
      setPeopleDirty(false);
      invalidate();
    },
  });
  const deleteTaskMutation = useMutation({
    mutationFn: () => api.deleteTask(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/tasks');
    },
  });

  if (isLoading) return <div className="page-shell overflow-y-auto text-slate-500">Loading…</div>;
  if (!task) return <div className="page-shell overflow-y-auto text-slate-500">Task not found.</div>;

  const canDelete = user?.role === 'admin' || user?.id === task.creatorId;
  const assignees = task.assignees ?? (task.assignee ? [task.assignee] : []);

  return (
    <div className="page-shell overflow-y-auto">
      <Link to="/tasks" className="link-back mb-6 inline-flex shrink-0">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to tasks
      </Link>

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <div className="card min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{task.title}</h1>
                <div className="mt-2 flex items-center gap-2">
                  <StatusBadge status={task.status} />
                  <PriorityBadge priority={task.priority} />
                </div>
              </div>
              {canDelete && (
                <button
                  className="btn-danger"
                  onClick={() => {
                    if (confirm('Delete this task?')) deleteTaskMutation.mutate();
                  }}
                >
                  <TrashIcon className="h-5 w-5" />
                  Delete
                </button>
              )}
            </div>

            {task.description && (
              <p className="mt-4 whitespace-pre-wrap text-slate-700">{task.description}</p>
            )}
          </div>

          {(task.domainName ||
            task.templateUrl ||
            task.docFileLink ||
            task.locationIframe ||
            task.gtmHead ||
            task.gtmBody) && (
            <div className="card min-w-0 p-4 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Website details</h2>
              <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                {task.domainName && (
                  <Field label="Domain">
                    <DomainLink domain={task.domainName} />
                  </Field>
                )}
                {task.templateUrl && (
                  <Field label="Template URL">
                    <a className="break-all text-[#2fc6f6] hover:underline" href={task.templateUrl} target="_blank" rel="noreferrer">
                      {task.templateUrl}
                    </a>
                  </Field>
                )}
                {task.docFileLink && (
                  <Field label="Doc / file link">
                    <a className="break-all text-[#2fc6f6] hover:underline" href={task.docFileLink} target="_blank" rel="noreferrer">
                      {task.docFileLink}
                    </a>
                  </Field>
                )}
              </dl>
              {task.locationIframe && (() => {
                const previewSrc = embedPreviewSrc(task.locationIframe);
                return (
                  <div className="mt-4 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Location embed
                      </span>
                      <CopyButton text={task.locationIframe} />
                    </div>
                    <div className="mt-1">
                      <CodeSnippet>{task.locationIframe}</CodeSnippet>
                    </div>
                    {previewSrc && (
                      <div className="mt-3 min-w-0 overflow-hidden rounded-lg border border-slate-200">
                        <iframe
                          title="Location"
                          src={previewSrc}
                          className="h-64 w-full max-w-full"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                );
              })()}
              {(task.gtmHead || task.gtmBody) && (
                <div className="mt-4 grid min-w-0 gap-4">
                  {task.gtmHead && (
                    <Field label="GTM head" copyText={task.gtmHead}>
                      <CodeSnippet>{task.gtmHead}</CodeSnippet>
                    </Field>
                  )}
                  {task.gtmBody && (
                    <Field label="GTM body" copyText={task.gtmBody}>
                      <CodeSnippet>{task.gtmBody}</CodeSnippet>
                    </Field>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card p-4 sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Attachments</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Upload images, videos, or documents — add anytime if you forgot
              </p>
            </div>
            {task.attachments && task.attachments.length > 0 && (
              <div className="mb-4">
                <AttachmentThumbnailGrid
                  attachments={task.attachments}
                  onDelete={(attachmentId) => deleteAttachmentMutation.mutate(attachmentId)}
                  deletingId={deleteAttachmentMutation.isPending ? deleteAttachmentMutation.variables : null}
                />
              </div>
            )}
            <AttachmentUploadZone
              compact={Boolean(task.attachments?.length)}
              uploading={uploadMutation.isPending}
              onUpload={(files) => uploadMutation.mutate(files)}
            />
            {uploadError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {uploadError}
              </p>
            )}
          </div>

          <div className="card p-4 sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Comments</h2>
            <div className="space-y-4">
              {task.comments && task.comments.length > 0 ? (
                task.comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{c.author.name}</span>
                      <span className="text-xs text-slate-400">{formatDateTime(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No comments yet.</p>
              )}
            </div>

            <form
              className="mt-4 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (comment.trim()) commentMutation.mutate(comment.trim());
              }}
            >
              <input
                className="input"
                placeholder="Add a comment…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button type="submit" className="btn-primary" disabled={commentMutation.isPending}>
                Post
              </button>
            </form>
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-0 lg:w-[360px] xl:w-[400px]">
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Status</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {STATUS_ORDER.filter((s) => s !== 'closed').map((s) => {
                const isActive = s === task.status;
                return (
                  <button
                    key={s}
                    onClick={() => statusMutation.mutate(s)}
                    disabled={isActive}
                    className={statusButtonClass(s, isActive)}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-center">
              {(() => {
                const s = 'closed' as const;
                const isActive = task.status === s;
                return (
                  <button
                    onClick={() => statusMutation.mutate(s)}
                    disabled={isActive}
                    className={`${statusButtonClass(s, isActive, true)} w-[calc(50%-0.1875rem)]`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {isActive && <CheckCircleIcon className="h-4 w-4 shrink-0" aria-hidden />}
                      {STATUS_LABELS[s]}
                    </span>
                  </button>
                );
              })()}
            </div>

            {task.status === 'closed' && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-center text-xs text-slate-500">
                  This task is closed. Reopen it or pick a status above.
                </p>
                <button
                  type="button"
                  className="btn-secondary w-full"
                  onClick={() => statusMutation.mutate('in_progress')}
                  disabled={statusMutation.isPending}
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  {statusMutation.isPending ? 'Reopening…' : 'Reopen task'}
                </button>
              </div>
            )}

            <dl className="mt-5 space-y-4 border-t border-slate-100 pt-5">
              <Field label="Assignees">
                <UserChipList users={assignees} emptyLabel="Unassigned" />
              </Field>
              <Field label="Created by">{task.creator ? task.creator.name : '—'}</Field>
              <Field label="Due date">
                <DueDateEditor taskId={task.id} dueDate={task.dueDate} status={task.status} />
              </Field>
              <Field label="Completed">{formatDateTime(task.completedAt)}</Field>
              <Field label="Created">{formatDateTime(task.createdAt)}</Field>
            </dl>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">People</h2>
              {peopleDirty && (
                <button
                  className="btn-primary px-3 py-1.5 text-xs"
                  onClick={() => peopleMutation.mutate()}
                  disabled={peopleMutation.isPending}
                >
                  {peopleMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
            <div className="space-y-4">
              <UserMultiSelect
                label="Assignees"
                users={users}
                value={assigneeIds}
                onChange={(ids) => {
                  setAssigneeIds(ids);
                  setPeopleDirty(true);
                }}
              />
              <UserMultiSelect
                label="Observers"
                users={users}
                value={observerIds}
                onChange={(ids) => {
                  setObserverIds(ids);
                  setPeopleDirty(true);
                }}
              />
              <UserMultiSelect
                label="Participants"
                users={users}
                value={participantIds}
                onChange={(ids) => {
                  setParticipantIds(ids);
                  setPeopleDirty(true);
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

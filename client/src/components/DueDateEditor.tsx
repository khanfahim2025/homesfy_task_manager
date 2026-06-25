import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TaskStatus } from '../types';
import { formatDueDateTime, isOverdue } from '../lib/format';
import { DueDateTimeInput } from './DueDateTimeInput';

interface Props {
  taskId: string;
  dueDate: string | null;
  status: TaskStatus;
  compact?: boolean;
  className?: string;
}

export function DueDateEditor({ taskId, dueDate, status, compact = false, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();
  const overdue = isOverdue({ dueDate, status });

  const mutation = useMutation({
    mutationFn: (value: string | null) => api.updateTask(taskId, { dueDate: value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: Event) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const label = dueDate ? formatDueDateTime(dueDate) : compact ? 'Due date' : 'Set due date';

  return (
    <div
      ref={panelRef}
      className={`relative inline-flex ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        title={dueDate ? 'Change due date & time' : 'Set due date & time'}
        disabled={mutation.isPending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`inline-flex items-center gap-1 rounded-md transition hover:bg-slate-100 ${
          compact ? 'px-1 py-0.5' : 'px-2 py-1'
        } ${
          overdue
            ? 'font-semibold text-red-500 hover:bg-red-50'
            : dueDate
              ? 'text-slate-700 hover:text-[#1a6fa0]'
              : 'text-slate-400 hover:text-[#1a6fa0]'
        } ${mutation.isPending ? 'opacity-60' : ''}`}
      >
        <CalendarIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        <span className={compact ? 'text-xs' : 'text-sm'}>{mutation.isPending ? 'Saving…' : label}</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Due date & time</span>
            {dueDate && (
              <button
                type="button"
                className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Clear due date"
                onClick={() => {
                  mutation.mutate(null);
                  setOpen(false);
                }}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <DueDateTimeInput
            value={dueDate}
            disabled={mutation.isPending}
            onChange={(iso) => {
              mutation.mutate(iso);
            }}
          />
        </div>
      )}
    </div>
  );
}

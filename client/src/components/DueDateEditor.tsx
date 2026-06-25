import { useRef, type MouseEvent } from 'react';
import { CalendarIcon } from '@heroicons/react/24/outline';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TaskStatus } from '../types';
import { dateInputToIso, formatDate, isOverdue, toDateInputValue } from '../lib/format';

interface Props {
  taskId: string;
  dueDate: string | null;
  status: TaskStatus;
  compact?: boolean;
  className?: string;
}

export function DueDateEditor({ taskId, dueDate, status, compact = false, className = '' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const overdue = isOverdue({ dueDate, status });

  const mutation = useMutation({
    mutationFn: (value: string) =>
      api.updateTask(taskId, {
        dueDate: value ? dateInputToIso(value) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const openPicker = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      input.showPicker();
    } else {
      input.click();
    }
  };

  const label = dueDate ? formatDate(dueDate) : compact ? 'Due date' : 'Set due date';

  return (
    <div
      className={`relative inline-flex ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        title={dueDate ? 'Change due date' : 'Set due date'}
        disabled={mutation.isPending}
        onClick={openPicker}
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
      <input
        ref={inputRef}
        type="date"
        className="pointer-events-none absolute h-0 w-0 opacity-0"
        value={toDateInputValue(dueDate)}
        onChange={(e) => {
          e.stopPropagation();
          mutation.mutate(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

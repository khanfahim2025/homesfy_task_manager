import { useRef, useState } from 'react';
import {
  DocumentIcon,
  FilmIcon,
  PaperClipIcon,
  PhotoIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const ACCEPT = 'image/*,video/*,.pdf,.doc,.docx,.zip,.rar,.txt';

function fileIcon(file: File) {
  if (file.type.startsWith('image/')) return PhotoIcon;
  if (file.type.startsWith('video/')) return FilmIcon;
  return DocumentIcon;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PendingProps {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/** Pick files before a task exists; uploads happen after create. */
export function PendingAttachmentPicker({ files, onChange, disabled }: PendingProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const key = (f: File) => `${f.name}-${f.size}-${f.lastModified}`;
    const existing = new Set(files.map(key));
    const merged = [...files];
    for (const file of incoming) {
      if (!existing.has(key(file))) merged.push(file);
    }
    onChange(merged);
  };

  const remove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          addFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragOver
            ? 'border-[#2fc6f6] bg-[#2fc6f6]/5'
            : 'border-slate-200 bg-slate-50/50 hover:border-[#2fc6f6]/50 hover:bg-white'
        } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
      >
        <PaperClipIcon className="mx-auto h-7 w-7 text-slate-400" />
        <p className="mt-2 text-sm font-medium text-slate-700">
          Add images, videos, or documents
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Click or drag files here — optional now, add more anytime on the task page
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />

      {files.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
          {files.map((file, index) => {
            const Icon = fileIcon(file);
            return (
              <li
                key={`${file.name}-${file.lastModified}-${index}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-slate-700">{file.name}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatSize(file.size)}</span>
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(index);
                  }}
                  aria-label={`Remove ${file.name}`}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface UploadProps {
  onUpload: (files: File[]) => void;
  uploading?: boolean;
  compact?: boolean;
}

/** Upload more files to an existing task. */
export function AttachmentUploadZone({ onUpload, uploading, compact }: UploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (incoming: File[]) => {
    if (incoming.length > 0) onUpload(incoming);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!uploading) handleFiles(Array.from(e.dataTransfer.files ?? []));
      }}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`cursor-pointer rounded-xl border border-dashed text-center transition ${
        compact ? 'px-3 py-4' : 'px-4 py-5'
      } ${
        dragOver
          ? 'border-[#2fc6f6] bg-[#2fc6f6]/5'
          : 'border-slate-200 bg-slate-50/50 hover:border-[#2fc6f6]/40 hover:bg-white'
      } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <PaperClipIcon className={`mx-auto text-slate-400 ${compact ? 'h-5 w-5' : 'h-6 w-6'}`} />
      <p className={`mt-1.5 font-medium text-slate-700 ${compact ? 'text-xs' : 'text-sm'}`}>
        {uploading ? 'Uploading…' : 'Add more files'}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">Images, videos, PDFs, docs — click or drag</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function AttachmentListItem({
  name,
  onRemove,
}: {
  name: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pl-2 pr-1 text-xs text-slate-700">
      {name}
      <button type="button" onClick={onRemove} className="rounded p-0.5 hover:bg-slate-200">
        <TrashIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

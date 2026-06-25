import { useState } from 'react';
import {
  ArchiveBoxIcon,
  ArrowDownTrayIcon,
  CheckIcon,
  DocumentIcon,
  FilmIcon,
  PhotoIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Attachment } from '../types';
import { downloadAttachment, downloadAttachments, isMediaAttachment } from '../lib/downloadAttachments';

interface Props {
  attachments: Attachment[];
  onDelete: (id: string) => void;
  deletingId?: string | null;
}

function FileIcon({ type }: { type: Attachment['type'] }) {
  const cls = 'h-8 w-8 text-slate-400';
  if (type === 'video') return <FilmIcon className={cls} />;
  if (type === 'archive') return <ArchiveBoxIcon className={cls} />;
  if (type === 'image') return <PhotoIcon className={cls} />;
  return <DocumentIcon className={cls} />;
}

export function AttachmentThumbnailGrid({ attachments, onDelete, deletingId }: Props) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const mediaAttachments = attachments.filter(isMediaAttachment);
  const hasMedia = mediaAttachments.length > 0;
  const selectedAttachments = attachments.filter((a) => selectedIds.has(a.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const runBulkDownload = async (items: Attachment[], zipName: string) => {
    if (items.length === 0) return;
    setBulkDownloading(true);
    try {
      await downloadAttachments(items, zipName);
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleSingleDownload = async (attachment: Attachment) => {
    setDownloadingId(attachment.id);
    try {
      await downloadAttachment(attachment);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {!selectMode ? (
            <>
              {attachments.length > 1 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-[#2fc6f6]/40 hover:text-[#2fc6f6] disabled:opacity-50"
                  disabled={bulkDownloading}
                  onClick={() => runBulkDownload(attachments, 'attachments.zip')}
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  {bulkDownloading ? 'Preparing zip…' : 'Download all (zip)'}
                </button>
              )}
              {hasMedia && mediaAttachments.length < attachments.length && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-[#2fc6f6]/40 hover:text-[#2fc6f6] disabled:opacity-50"
                  disabled={bulkDownloading}
                  onClick={() => runBulkDownload(mediaAttachments, 'media.zip')}
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  {bulkDownloading ? 'Preparing zip…' : 'Download media (zip)'}
                </button>
              )}
              {attachments.length > 1 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-[#2fc6f6]/40 hover:text-[#2fc6f6]"
                  onClick={() => setSelectMode(true)}
                >
                  Select to download
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                onClick={() => setSelectedIds(new Set(attachments.map((a) => a.id)))}
              >
                Select all
              </button>
              {hasMedia && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={() => setSelectedIds(new Set(mediaAttachments.map((a) => a.id)))}
                >
                  Select all media
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2fc6f6] px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-[#2fc6f6]/90 disabled:opacity-50"
                disabled={selectedIds.size === 0 || bulkDownloading}
                onClick={() => runBulkDownload(selectedAttachments, 'selected-attachments.zip')}
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                {bulkDownloading
                  ? 'Preparing zip…'
                  : selectedAttachments.length === 1
                    ? 'Download selected'
                    : `Download selected (${selectedIds.size}) zip`}
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:text-slate-700"
                onClick={exitSelectMode}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {attachments.map((a) => {
          const isSelected = selectedIds.has(a.id);
          const isDownloading = downloadingId === a.id;

          return (
            <div
              key={a.id}
              className={`group relative aspect-square overflow-hidden rounded-xl border bg-slate-50 shadow-sm transition ${
                selectMode && isSelected
                  ? 'border-[#2fc6f6] ring-2 ring-[#2fc6f6]/30'
                  : 'border-slate-200'
              }`}
            >
              {selectMode && (
                <button
                  type="button"
                  className={`absolute left-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-md border shadow-sm transition ${
                    isSelected
                      ? 'border-[#2fc6f6] bg-[#2fc6f6] text-white'
                      : 'border-white/80 bg-black/40 text-transparent hover:bg-black/55'
                  }`}
                  onClick={() => toggleSelected(a.id)}
                  aria-label={isSelected ? 'Deselect' : 'Select'}
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                </button>
              )}

              {a.type === 'image' ? (
                <a href={a.fileUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
                  <img
                    src={a.fileUrl}
                    alt={a.fileName ?? 'Image'}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                </a>
              ) : a.type === 'video' ? (
                <a href={a.fileUrl} target="_blank" rel="noreferrer" className="block h-full w-full">
                  <video
                    src={a.fileUrl}
                    className="h-full w-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                    <FilmIcon className="h-10 w-10 text-white drop-shadow" />
                  </div>
                </a>
              ) : (
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center transition hover:bg-slate-100"
                >
                  <FileIcon type={a.type} />
                  <span className="line-clamp-2 text-xs font-medium text-slate-600">
                    {a.fileName ?? 'File'}
                  </span>
                </a>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-6 opacity-0 transition group-hover:opacity-100">
                <p className="truncate text-[10px] font-medium text-white">{a.fileName ?? a.type}</p>
              </div>

              {!selectMode && (
                <button
                  type="button"
                  className="absolute left-1.5 top-1.5 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition hover:bg-[#2fc6f6] group-hover:opacity-100 disabled:opacity-60"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleSingleDownload(a);
                  }}
                  disabled={isDownloading}
                  title="Download"
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                className="absolute right-1.5 top-1.5 rounded-lg bg-black/50 p-1.5 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100 disabled:opacity-60"
                onClick={() => onDelete(a.id)}
                disabled={deletingId === a.id}
                title="Remove"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

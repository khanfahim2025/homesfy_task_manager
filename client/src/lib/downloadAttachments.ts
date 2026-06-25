import JSZip from 'jszip';
import type { Attachment } from '../types';

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function uniqueFileName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let index = 2;
  let candidate = `${base} (${index})${ext}`;

  while (used.has(candidate)) {
    index += 1;
    candidate = `${base} (${index})${ext}`;
  }

  used.add(candidate);
  return candidate;
}

async function fetchAttachmentBlob(attachment: Attachment): Promise<{ name: string; blob: Blob }> {
  const res = await fetch(attachment.fileUrl, { credentials: 'include' });
  if (!res.ok) {
    throw new Error(`Download failed: ${attachment.fileName ?? attachment.id}`);
  }

  return {
    name: attachment.fileName ?? 'download',
    blob: await res.blob(),
  };
}

export async function downloadAttachment(attachment: Attachment): Promise<void> {
  const { blob, name } = await fetchAttachmentBlob(attachment);
  triggerBlobDownload(blob, name);
}

export async function downloadAttachmentsAsZip(
  attachments: Attachment[],
  zipName = 'attachments.zip',
): Promise<void> {
  if (attachments.length === 0) return;

  if (attachments.length === 1) {
    await downloadAttachment(attachments[0]!);
    return;
  }

  const zip = new JSZip();
  const used = new Set<string>();

  for (const attachment of attachments) {
    const { blob, name } = await fetchAttachmentBlob(attachment);
    zip.file(uniqueFileName(name, used), blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBlobDownload(zipBlob, zipName);
}

/** Multi-file downloads are bundled into a zip; single files download directly. */
export async function downloadAttachments(
  attachments: Attachment[],
  zipName = 'attachments.zip',
): Promise<void> {
  await downloadAttachmentsAsZip(attachments, zipName);
}

export function isMediaAttachment(attachment: Attachment): boolean {
  return attachment.type === 'image' || attachment.type === 'video';
}

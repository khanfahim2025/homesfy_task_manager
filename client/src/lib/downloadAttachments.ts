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

/** Our API redirects this to S3 with "save as" headers. */
function downloadUrl(attachment: Attachment): string {
  return `${attachment.fileUrl}${attachment.fileUrl.includes('?') ? '&' : '?'}download=1`;
}

async function fetchAttachmentBlob(attachment: Attachment): Promise<{ name: string; blob: Blob }> {
  // no-store: never reuse a cached copy from an <img> load, which lacks CORS headers.
  const res = await fetch(downloadUrl(attachment), { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Download failed: ${attachment.fileName ?? attachment.id}`);
  }

  return {
    name: attachment.fileName ?? 'download',
    blob: await res.blob(),
  };
}

/** A single file is saved by the browser straight from S3, no CORS or memory needed. */
export async function downloadAttachment(attachment: Attachment): Promise<void> {
  const anchor = document.createElement('a');
  anchor.href = downloadUrl(attachment);
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
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

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const used = new Set<string>();

  // Fetch a few at a time; names are assigned in order so duplicates stay stable.
  const names = attachments.map((a) => uniqueFileName(a.fileName ?? 'download', used));
  let next = 0;
  const worker = async () => {
    while (next < attachments.length) {
      const i = next++;
      const { blob } = await fetchAttachmentBlob(attachments[i]!);
      zip.file(names[i]!, blob);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, attachments.length) }, worker));

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

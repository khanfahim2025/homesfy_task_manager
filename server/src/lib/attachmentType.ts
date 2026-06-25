import type { AttachmentType } from '@prisma/client';

const IMAGE = /^image\//;
const VIDEO = /^video\//;
const ARCHIVE_EXT = /\.(zip|rar|7z|tar|gz|tgz|bz2)$/i;
const ARCHIVE_MIME = /(zip|x-rar|x-7z|x-tar|gzip|x-bzip2|x-compressed)/i;

export function classifyAttachment(filename: string, contentType?: string | null): AttachmentType {
  const ct = contentType ?? '';
  if (IMAGE.test(ct)) return 'image';
  if (VIDEO.test(ct)) return 'video';
  if (ARCHIVE_MIME.test(ct) || ARCHIVE_EXT.test(filename)) return 'archive';
  return 'document';
}

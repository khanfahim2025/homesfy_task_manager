import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env, s3Enabled } from './env.js';

/**
 * Attachments are stored in S3 (when configured) or on the local filesystem under
 * env.uploadDir. All files are served via GET /api/attachments/files/:name so that
 * pre-existing database rows and the client keep working unchanged.
 */

const PUBLIC_PREFIX = '/api/attachments/files';
const S3_KEY_PREFIX = 'attachments/';

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: env.aws.region,
      followRegionRedirects: true,
      credentials: {
        accessKeyId: env.aws.accessKeyId!,
        secretAccessKey: env.aws.secretAccessKey!,
      },
    });
  }
  return s3Client;
}

function extOf(filename: string): string {
  const ext = path.extname(filename);
  return ext && ext.length <= 12 ? ext : '';
}

function mimeFromName(name: string): string {
  return MIME_BY_EXT[extOf(name).toLowerCase()] ?? 'application/octet-stream';
}

function s3Key(storedName: string): string {
  return `${S3_KEY_PREFIX}${storedName}`;
}

export interface StoredObject {
  fileUrl: string;
  storedName: string;
}

export async function storeObject(buffer: Buffer, originalName: string): Promise<StoredObject> {
  const storedName = `${randomUUID()}${extOf(originalName)}`;
  const contentType = mimeFromName(storedName);

  if (s3Enabled()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: env.aws.bucket!,
        Key: s3Key(storedName),
        Body: buffer,
        ContentType: contentType,
      })
    );
  } else {
    const dest = path.join(env.uploadDir, storedName);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
  }

  return { fileUrl: `${PUBLIC_PREFIX}/${storedName}`, storedName };
}

function storedNameFromUrl(fileUrl: string): string | null {
  if (!fileUrl.startsWith(PUBLIC_PREFIX)) return null;
  return path.basename(fileUrl);
}

function isNoSuchKey(err: unknown): boolean {
  return (err as { name?: string }).name === 'NoSuchKey';
}

export async function streamStoredFile(name: string, res: Response): Promise<void> {
  const safe = path.basename(name);
  const contentType = mimeFromName(safe);
  res.setHeader('Content-Type', contentType);

  if (s3Enabled()) {
    try {
      const result = await getS3Client().send(
        new GetObjectCommand({
          Bucket: env.aws.bucket!,
          Key: s3Key(safe),
        })
      );
      if (result.Body) {
        await pipeline(result.Body as Readable, res);
        return;
      }
    } catch (err) {
      if (!isNoSuchKey(err)) throw err;
    }
  }

  const dest = path.join(env.uploadDir, safe);
  try {
    await pipeline(createReadStream(dest), res);
  } catch {
    if (!res.headersSent) res.status(404).json({ error: 'File not found' });
  }
}

export async function deleteObject(fileUrl: string): Promise<void> {
  const name = storedNameFromUrl(fileUrl);
  if (!name) return;

  if (s3Enabled()) {
    try {
      await getS3Client().send(
        new DeleteObjectCommand({
          Bucket: env.aws.bucket!,
          Key: s3Key(name),
        })
      );
    } catch {
      // ignore missing objects
    }
  }

  try {
    await unlink(path.join(env.uploadDir, name));
  } catch {
    // ignore missing files
  }
}

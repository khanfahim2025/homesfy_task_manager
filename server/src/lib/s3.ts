import { AwsClient } from 'aws4fetch';
import type { Bindings } from '../types';

/**
 * Attachments live in S3 under `attachments/<folder>/<uuid><ext>`, where the
 * folder is the task's website domain (e.g. `the-world-worli.com`), so every
 * task for a site shares one folder (older files sit directly under
 * `attachments/`). Browsers upload and download directly with short-lived
 * presigned URLs, so file bytes never pass through the Worker. The app refers
 * to files as `/api/attachments/files/<name>`, which redirects to a presigned GET.
 */

export const FILE_URL_PREFIX = '/api/attachments/files/';
const KEY_PREFIX = 'attachments/';
const UPLOAD_TTL_S = 15 * 60;
export const DOWNLOAD_TTL_S = 60 * 60;

let cached: { key: string; client: AwsClient } | undefined;

function client(env: Bindings): AwsClient {
  const key = `${env.AWS_ACCESS_KEY_ID}:${env.AWS_REGION}`;
  if (cached?.key !== key) {
    cached = {
      key,
      client: new AwsClient({
        // Trim: a stray space pasted into a secret silently breaks every signature.
        accessKeyId: env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY.trim(),
        region: env.AWS_REGION,
        service: 's3',
      }),
    };
  }
  return cached.client;
}

function objectUrl(env: Bindings, name: string): URL {
  const key = name.split('/').map(encodeURIComponent).join('/');
  return new URL(`https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${KEY_PREFIX}${key}`);
}

export function newStoredName(folder: string, originalName: string): string {
  const ext = originalName.match(/\.[A-Za-z0-9]{1,10}$/)?.[0]?.toLowerCase() ?? '';
  return `${folder}/${crypto.randomUUID()}${ext}`;
}

/**
 * Only names we generated are valid: an optional folder (a domain like
 * `the-world-worli.com`, `general`, or a legacy project id), then a uuid with
 * an optional short extension.
 */
export function isStoredName(name: string): boolean {
  return /^([A-Za-z0-9][A-Za-z0-9._-]{0,252}\/)?[0-9a-f-]{36}(\.[a-z0-9]{1,10})?$/.test(name);
}

function storedNameFromUrl(fileUrl: string): string | null {
  if (!fileUrl.startsWith(FILE_URL_PREFIX)) return null;
  const name = fileUrl.slice(FILE_URL_PREFIX.length);
  return isStoredName(name) ? name : null;
}

async function presign(
  env: Bindings,
  name: string,
  method: 'GET' | 'PUT' | 'DELETE',
  ttl: number,
  headers?: Record<string, string>,
  query?: Record<string, string>
): Promise<string> {
  const url = objectUrl(env, name);
  url.searchParams.set('X-Amz-Expires', String(ttl));
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  // allHeaders: aws4fetch otherwise leaves content-type/length out of the signature.
  const signed = await client(env).sign(url.toString(), {
    method,
    headers,
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

/** Content-Type and Content-Length are signed, so S3 rejects any other upload. */
export function presignUpload(env: Bindings, name: string, contentType: string, size: number) {
  return presign(env, name, 'PUT', UPLOAD_TTL_S, {
    'content-type': contentType,
    'content-length': String(size),
  });
}

export function presignDownload(
  env: Bindings,
  name: string,
  fileName?: string | null,
  disposition: 'inline' | 'attachment' = 'inline'
) {
  const query: Record<string, string> = {};
  if (fileName) {
    query['response-content-disposition'] =
      `${disposition}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  } else if (disposition === 'attachment') {
    query['response-content-disposition'] = 'attachment';
  }
  return presign(env, name, 'GET', DOWNLOAD_TTL_S, undefined, query);
}

// Server-side calls use query-signed URLs. Existence is checked with a 1-byte
// GET, not HEAD: Cloudflare sends a Worker's HEAD upstream as GET, which breaks
// a signature made for HEAD (S3 answers 403).
const SERVER_TTL_S = 60;

export async function objectExists(env: Bindings, name: string): Promise<boolean> {
  const res = await fetch(await presign(env, name, 'GET', SERVER_TTL_S), {
    headers: { range: 'bytes=0-0' },
  });
  await res.body?.cancel();
  if (!res.ok) console.error(`[s3] GET ${name} → ${res.status}`);
  return res.ok;
}

export async function deleteObject(env: Bindings, fileUrl: string): Promise<void> {
  const name = storedNameFromUrl(fileUrl);
  if (!name) return;
  const res = await fetch(await presign(env, name, 'DELETE', SERVER_TTL_S), { method: 'DELETE' });
  if (!res.ok) console.error(`[s3] DELETE ${name} → ${res.status}`);
}

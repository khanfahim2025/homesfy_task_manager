/** True for an absolute https:// URL (blocks javascript:, data:, http: and relative links). */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Keep a pasted iframe tag as-is (so it can be copied back intact), or accept a raw
 * embed URL. Only https:// sources are kept: the task page previews this URL in
 * an iframe, so anything else could run script inside the app.
 */
export function parseLocationEmbed(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();

  const iframeTag = trimmed.match(/<iframe[\s\S]*?\ssrc=["']([^"']+)["'][\s\S]*?(?:<\/iframe>|\/?>)/i);
  if (iframeTag) {
    if (!isHttpsUrl(iframeTag[1].trim())) return null;
    const tag = iframeTag[0];
    return /<\/iframe>$/i.test(tag) ? tag : `${tag}</iframe>`;
  }

  if (isHttpsUrl(trimmed)) return trimmed;

  return null;
}

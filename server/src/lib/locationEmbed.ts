/** Keep a pasted iframe tag as-is (so it can be copied back intact), or accept a raw embed URL. */
export function parseLocationEmbed(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();

  const iframeTag = trimmed.match(/<iframe[\s\S]*?\ssrc=["'][^"']+["'][\s\S]*?(?:<\/iframe>|\/?>)/i);
  if (iframeTag) {
    const tag = iframeTag[0];
    return /<\/iframe>$/i.test(tag) ? tag : `${tag}</iframe>`;
  }

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return null;
}

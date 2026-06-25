/** Extract Google Maps (or any) embed URL from a full iframe tag or raw URL. */
export function parseLocationEmbed(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const trimmed = input.trim();

  const iframeSrc = trimmed.match(/<iframe[\s\S]*?\ssrc=["']([^"']+)["']/i);
  if (iframeSrc?.[1]) return iframeSrc[1];

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return null;
}

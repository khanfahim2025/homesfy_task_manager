/** URL for iframe preview — plain URL or src extracted from embed HTML. */
export function embedPreviewSrc(value: string): string | null {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('<')) return trimmed;
  const match = trimmed.match(/src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

/** URL for iframe preview — plain URL or src extracted from embed HTML. */
export function embedPreviewSrc(value: string): string | null {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('<')) return trimmed;
  const match = trimmed.match(/src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

/** Full iframe HTML for copying — older tasks stored only the embed URL. */
export function embedIframeHtml(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('<')) {
    return `<iframe src="${trimmed}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }
  return trimmed;
}

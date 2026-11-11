/** Only absolute https:// URLs may be previewed (never javascript:, data: or relative). */
function safeHttpsUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** URL for iframe preview — plain URL or src extracted from embed HTML. */
export function embedPreviewSrc(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.includes('<')) return safeHttpsUrl(trimmed);
  return safeHttpsUrl(trimmed.match(/src=["']([^"']+)["']/i)?.[1]);
}

/** Full iframe HTML for copying — older tasks stored only the embed URL. */
export function embedIframeHtml(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) && !trimmed.includes('<')) {
    return `<iframe src="${trimmed}" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
  }
  return trimmed;
}

import type { ReactNode } from 'react';

const URL_RE = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
// Punctuation that usually ends a sentence rather than the URL itself.
const TRAILING_RE = /[.,;:!?)\]}'"]+$/;

/** Turns plain-text URLs into clickable links; leaves the rest as text. */
export function linkify(text: string, keyPrefix = 'l'): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    const trailing = url.match(TRAILING_RE)?.[0] ?? '';
    if (trailing) url = url.slice(0, -trailing.length);
    if (!url) continue;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a
        key={`${keyPrefix}-${start}`}
        href={url.startsWith('www.') ? `https://${url}` : url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-[#2fc6f6] hover:underline"
      >
        {url}
      </a>
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Linkify({ text }: { text: string }) {
  return <>{linkify(text)}</>;
}

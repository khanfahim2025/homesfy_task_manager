// A tag is stored as @[Name](userId); the comment box shows it as plain @Name.
export const MENTION_RE = /@\[([^\]\n]{1,100})\]\(([A-Za-z0-9_-]{1,64})\)/g;

export function mentionsUser(body: string, userId: string): boolean {
  return [...body.matchAll(MENTION_RE)].some((m) => m[2] === userId);
}

/** Turns the @Name tags picked in the comment box into stored @[Name](id) tags. */
export function encodeMentions(text: string, picked: { id: string; name: string }[]): string {
  // Longest names first so "@Fahim Khan" wins over "@Fahim".
  const sorted = [...picked].sort((a, b) => b.name.length - a.name.length);
  let out = text;
  for (const u of sorted) {
    const escaped = u.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(^|[^\\w\\[])@${escaped}(?![\\w])`, 'g'), `$1@[${u.name}](${u.id})`);
  }
  return out;
}

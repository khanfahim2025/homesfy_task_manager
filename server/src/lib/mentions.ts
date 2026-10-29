// Comments store a tag as @[Name](userId); the client turns "@Name" into this on send.
const MENTION_RE = /@\[([^\]\n]{1,100})\]\(([A-Za-z0-9_-]{1,64})\)/g;

export function mentionedUserIds(body: string): string[] {
  return [...new Set([...body.matchAll(MENTION_RE)].map((m) => m[2]))];
}

/** The comment as people read it: tags become plain @Name. */
export function plainCommentText(body: string): string {
  return body.replace(MENTION_RE, '@$1');
}

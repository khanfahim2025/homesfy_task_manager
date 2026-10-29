import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { User } from '../types';
import { getAvatarColor, getInitials } from '../lib/format';
import { MENTION_RE } from '../lib/mentions';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Called with the picked user whenever someone is tagged. */
  onMention: (user: Pick<User, 'id' | 'name'>) => void;
  onSubmit: () => void;
  users: User[];
  placeholder?: string;
  disabled?: boolean;
}

const MAX_SUGGESTIONS = 6;

/** Text before the caret ends in "@query" → the query, else null. */
function activeQuery(text: string, caret: number): { query: string; start: number } | null {
  const match = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret));
  if (!match) return null;
  return { query: match[2], start: caret - match[2].length - 1 };
}

/** A comment box where typing @ suggests people to tag. Enter sends, Shift+Enter adds a line. */
export function MentionInput({ value, onChange, onMention, onSubmit, users, placeholder, disabled }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const active = dismissed ? null : activeQuery(value, caret);
  const suggestions = useMemo(() => {
    if (!active) return [];
    const q = active.query.toLowerCase();
    return users
      .filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [active, users]);
  const open = suggestions.length > 0;

  const pick = (user: User) => {
    if (!active) return;
    const before = value.slice(0, active.start);
    const after = value.slice(caret);
    const inserted = `@${user.name} `;
    onChange(before + inserted + after);
    onMention(user);
    const next = before.length + inserted.length;
    setCaret(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(next, next);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const step = e.key === 'ArrowDown' ? 1 : -1;
        setHighlight((h) => (h + step + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(suggestions[Math.min(highlight, suggestions.length - 1)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setDismissed(true);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <textarea
        ref={ref}
        rows={2}
        className="input min-h-[2.75rem] resize-y"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setHighlight(0);
          setDismissed(false);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setDismissed(true), 150)}
        onFocus={() => setDismissed(false)}
      />
      {open && (
        <ul className="absolute bottom-full left-0 z-20 mb-1 w-full max-w-xs overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#161616]">
          {suggestions.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(u)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                  i === highlight ? 'bg-sky-50 dark:bg-white/10' : 'hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${getAvatarColor(u.name)}`}
                >
                  {getInitials(u.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{u.name}</span>
                  <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{u.email}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Renders a stored comment with @tags highlighted. */
export function CommentBody({ body, currentUserId }: { body: string; currentUserId?: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const index = m.index ?? 0;
    if (index > last) parts.push(body.slice(last, index));
    const isMe = m[2] === currentUserId;
    parts.push(
      <span
        key={index}
        className={`rounded px-1 font-medium ${
          isMe
            ? 'bg-amber-100 text-amber-900 dark:bg-amber-400/20 dark:text-amber-200'
            : 'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-200'
        }`}
      >
        @{m[1]}
      </span>
    );
    last = index + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{parts}</p>;
}

import { useState } from 'react';
import { ClipboardDocumentIcon } from '@heroicons/react/24/outline';

interface Props {
  text: string;
  label?: string;
}

export function CopyButton({ text, label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
      title={label}
    >
      <ClipboardDocumentIcon className="h-3.5 w-3.5" />
      {copied ? 'Copied' : label}
    </button>
  );
}

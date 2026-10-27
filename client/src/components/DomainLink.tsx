import { domainToUrl } from '../lib/format';

interface Props {
  domain: string;
  className?: string;
  /** Use inside another link (e.g. task card) to avoid nested <a> tags. */
  embedded?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export function DomainLink({
  domain,
  className = '',
  embedded = false,
  onClick,
  onMouseDown,
}: Props) {
  const href = domainToUrl(domain);
  const linkClass = `break-all text-[#2fc6f6] hover:underline ${className}`;

  const openLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(e);
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  if (embedded) {
    return (
      <span
        role="link"
        tabIndex={0}
        className={`cursor-pointer ${linkClass}`}
        onClick={openLink}
        onMouseDown={(e) => {
          e.stopPropagation();
          onMouseDown?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openLink(e as unknown as React.MouseEvent);
          }
        }}
      >
        {domain}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={linkClass}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {domain}
    </a>
  );
}

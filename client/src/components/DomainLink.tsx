import { domainToUrl } from '../lib/format';

interface Props {
  domain: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

export function DomainLink({ domain, className = '', onClick, onMouseDown }: Props) {
  const href = domainToUrl(domain);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`break-all text-[#2fc6f6] hover:underline ${className}`}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      {domain}
    </a>
  );
}

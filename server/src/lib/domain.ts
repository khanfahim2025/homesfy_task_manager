export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.split('/')[0] ?? d;
  d = d.split('?')[0] ?? d;
  return d.replace(/\.$/, '');
}

export function domainToProjectName(domain: string): string {
  const host = normalizeDomain(domain);
  const base = host.split('.')[0] ?? host;
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface Props {
  children: string;
}

/** Read-only code/HTML snippet — wraps on small screens instead of breaking layout. */
export function CodeSnippet({ children }: Props) {
  return <pre className="code-snippet">{children}</pre>;
}

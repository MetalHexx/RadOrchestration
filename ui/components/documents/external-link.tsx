"use client";

import { ExternalLink as ExternalLinkIcon, Github } from "lucide-react";

interface ExternalLinkProps {
  /** Full URL to navigate to; component renders null when href is null */
  href: string | null;
  /** Visible and/or accessible label text */
  label: string;
  /** Icon variant; defaults to "external-link" */
  icon?: 'github' | 'external-link';
}

export function ExternalLink({
  href,
  label,
  icon = 'external-link',
}: ExternalLinkProps): JSX.Element | null {
  if (href === null) {
    return null;
  }

  const Icon = icon === 'github' ? Github : ExternalLinkIcon;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm text-sm"
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </a>
  );
}

"use client";

import { ExternalLink as ExternalLinkIcon, Github } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExternalLinkProps {
  /** Full URL to navigate to. When null, renders a visible disabled state
   *  (greyed-out span with tooltip) instead of removing the element from the DOM. */
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
}: ExternalLinkProps): JSX.Element {
  const Icon = icon === 'github' ? Github : ExternalLinkIcon;

  if (href === null) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="inline-flex items-center gap-1.5 text-muted-foreground cursor-not-allowed"
                aria-disabled="true"
              />
            }
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </TooltipTrigger>
          <TooltipContent>Not available</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

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

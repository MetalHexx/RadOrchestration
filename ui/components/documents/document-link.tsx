"use client";

import { FileText } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentLinkProps {
  /** Document path relative to project dir, or null if document doesn't exist */
  path: string | null;
  /** Display label for the link (e.g., "PRD", "Task Report", "Code Review") */
  label: string;
  /** Callback when the link is clicked (only fires when path is non-null) */
  onDocClick: (path: string) => void;
}

export function DocumentLink({ path, label, onDocClick }: DocumentLinkProps) {
  if (path !== null) {
    return (
      <button
        type="button"
        tabIndex={-1}
        className="inline-flex items-center gap-1.5 text-primary hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        aria-label={label}
        onClick={() => onDocClick(path)}
      >
        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

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
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{label}</span>
        </TooltipTrigger>
        <TooltipContent>Not available</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

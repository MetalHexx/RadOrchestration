"use client";

import { Github, Clock, ExternalLink, XCircle } from "lucide-react";
import { SpinnerBadge } from "@/components/badges";
import type { V5SourceControlState } from "@/types/state";

interface SourceControlRowProps {
  sourceControl: V5SourceControlState;
}

export function SourceControlRow({ sourceControl }: SourceControlRowProps) {
  if (!sourceControl) return null;

  const { branch, compare_url, auto_commit, auto_pr, pr_url } = sourceControl;

  return (
    <div
      className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
      aria-label="Source Control"
    >
      {/* Branch region */}
      {compare_url !== null ? (
        <a
          href={compare_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          aria-label={`View ${branch} branch diff on GitHub`}
        >
          <Github size={12} aria-hidden="true" />
          {branch}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
          <Github size={12} aria-hidden="true" />
          {branch}
        </span>
      )}

      {/* PR status region — only when auto_pr === 'always' */}
      {auto_pr === 'always' && (
        pr_url !== null && /^https?:\/\//i.test(pr_url) ? (
          <a
            href={pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
            aria-label="View pull request on GitHub"
          >
            <ExternalLink size={12} aria-hidden="true" />
            Pull Request
          </a>
        ) : pr_url === null ? (
          <span
            className="inline-flex items-center gap-1 text-muted-foreground italic"
            aria-label="Pull request not yet created"
          >
            <Clock
              size={12}
              style={{ color: 'var(--status-not-started)' }}
              aria-hidden="true"
            />
            PR not yet created
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-destructive italic"
            aria-label="Pull request creation failed"
          >
            <XCircle
              size={12}
              className="text-destructive"
              aria-hidden="true"
            />
            PR creation failed
          </span>
        )
      )}

      {/* Configuration badges */}
      <SpinnerBadge
        label="Auto-Commit"
        cssVar={auto_commit === 'always' ? '--status-complete' : '--status-failed'}
        isSpinning={false}
        isComplete={auto_commit === 'always'}
        isRejected={auto_commit !== 'always'}
        ariaLabel={`Auto-Commit: ${auto_commit}`}
      />
      <SpinnerBadge
        label="Auto-PR"
        cssVar={auto_pr === 'always' ? '--status-complete' : '--status-failed'}
        isSpinning={false}
        isComplete={auto_pr === 'always'}
        isRejected={auto_pr !== 'always'}
        ariaLabel={`Auto-PR: ${auto_pr}`}
      />
    </div>
  );
}

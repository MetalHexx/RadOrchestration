"use client";

import { Github, Clock, ExternalLink, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SpinnerBadge } from "@/components/badges";
import type { SourceControl } from "@/types/state";

interface SourceControlSectionProps {
  /** Source control metadata from pipeline.source_control */
  sourceControl: SourceControl;
}

export function SourceControlSection({ sourceControl }: SourceControlSectionProps) {
  const { branch, auto_commit, auto_pr } = sourceControl;
  const compare_url = sourceControl.compare_url ?? null;
  const pr_url = sourceControl.pr_url; // preserve undefined (not yet attempted) vs null (creation failed)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Branch + badges row */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Branch Name:</span>
          {compare_url !== null ? (
            <a
              href={compare_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
              aria-label={`View ${branch} branch diff on GitHub`}
            >
              <Github size={12} aria-hidden="true" />
              {branch}
            </a>
          ) : (
            <span className="text-muted-foreground font-mono text-sm">{branch}</span>
          )}

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

        {/* PR placeholder row — rendered only when auto_pr === "always" */}
        {auto_pr === 'always' && (
          pr_url != null && /^https?:\/\//i.test(pr_url) ? (
            <div>
              <a
                href={pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                aria-label="View pull request on GitHub"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Pull Request
              </a>
            </div>
          ) : pr_url === null ? (
            <div aria-label="Pull request creation failed">
              <XCircle
                size={12}
                className="inline mr-1 text-destructive"
                aria-hidden="true"
              />
              <span className="text-xs text-destructive italic">PR creation failed</span>
            </div>
          ) : (
            <div aria-label="Pull request not yet created">
              <Clock
                size={12}
                className="inline mr-1"
                style={{ color: 'var(--status-not-started)' }}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground italic">PR not yet created</span>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

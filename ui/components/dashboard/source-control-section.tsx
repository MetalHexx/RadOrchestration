"use client";

import { Github, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SpinnerBadge } from "@/components/badges";
import type { SourceControl } from "@/types/state";

interface SourceControlSectionProps {
  /** Source control metadata from pipeline.source_control */
  sourceControl: SourceControl;
}

export function SourceControlSection({ sourceControl }: SourceControlSectionProps) {
  const { branch, auto_commit, auto_pr } = sourceControl;
  const compare_url = sourceControl.compare_url ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Control</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Branch row */}
        <div>
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
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-2">
          {auto_commit === 'always' ? (
            <SpinnerBadge
              label="auto-commit: always"
              cssVar="--tier-execution"
              isSpinning={false}
              ariaLabel="Auto-commit: always"
            />
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              auto-commit: never
            </Badge>
          )}
          {auto_pr === 'always' ? (
            <SpinnerBadge
              label="auto-pr: always"
              cssVar="--tier-review"
              isSpinning={false}
              ariaLabel="Auto-PR: always"
            />
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              auto-pr: never
            </Badge>
          )}
        </div>

        {/* PR placeholder row — rendered only when auto_pr === "always" */}
        {auto_pr === 'always' && (
          <div aria-label="Pull request not yet created">
            <Clock
              size={12}
              className="inline mr-1"
              style={{ color: 'var(--status-not-started)' }}
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground italic">PR not yet created</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

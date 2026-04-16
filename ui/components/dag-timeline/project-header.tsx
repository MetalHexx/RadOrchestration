"use client";

import { Github, Clock, ExternalLink, XCircle } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
import { SpinnerBadge } from "@/components/badges";
import type { GraphStatus, GateMode, V5SourceControlState } from '@/types/state';
import { NodeStatusBadge } from './node-status-badge';
import { GateModeBadge } from '@/components/badges/gate-mode-badge';

interface ProjectHeaderProps {
  projectName: string;
  schemaVersion: 'v4' | 'v5';
  graphStatus?: GraphStatus;
  gateMode?: GateMode | null;
  currentPhaseName?: string | null;
  progress?: { completed: number; total: number } | null;
  sourceControl: V5SourceControlState | null;
  followMode: boolean;
  onToggleFollowMode: () => void;
}

export function ProjectHeader({ projectName, schemaVersion, graphStatus, gateMode, currentPhaseName, progress, sourceControl, followMode, onToggleFollowMode }: ProjectHeaderProps) {
  return (
    <header className="border-b border-border px-6 py-4" aria-label={`Project ${projectName}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold">{projectName}</span>
        <Badge variant="secondary" className="text-xs">{schemaVersion}</Badge>
        {graphStatus && <NodeStatusBadge status={graphStatus} />}
        {gateMode !== undefined && <GateModeBadge mode={gateMode} />}
        {sourceControl !== null && (() => {
          const { branch, compare_url, auto_commit, auto_pr, pr_url } = sourceControl;
          return (
            <>
              {/* Branch region */}
              {compare_url !== null && /^https?:\/\//i.test(compare_url) ? (
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
            </>
          );
        })()}
        <div className="ml-auto inline-flex items-center gap-2">
          <label htmlFor="follow-mode-switch">Follow Mode</label>
          <Switch
            id="follow-mode-switch"
            checked={followMode}
            onCheckedChange={() => onToggleFollowMode()}
            className="cursor-pointer"
          />
        </div>
      </div>
      {graphStatus === 'in_progress' && currentPhaseName && (
        <div className="flex items-center gap-3 mt-1">
          <span className="text-sm text-muted-foreground">{currentPhaseName}</span>
          {progress && (
            <span className="text-sm text-muted-foreground">
              {progress.completed} of {progress.total} phases
            </span>
          )}
        </div>
      )}
    </header>
  );
}

"use client";

import { Github, Clock, ExternalLink, XCircle } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SpinnerBadge } from "@/components/badges";
import type { GraphStatus, GateMode, V5SourceControlState, V5AutoCommit, V5AutoPR } from '@/types/state';
import { NodeStatusBadge } from './node-status-badge';
import { GateModeBadge } from '@/components/badges/gate-mode-badge';

const SCHEMA_VERSION_TOOLTIP = "Pipeline state schema version 5 (v5).";

function statusTooltip(status: GraphStatus): string {
  switch (status) {
    case 'not_started':
      return 'Pipeline has not yet started.';
    case 'in_progress':
      return 'Pipeline is currently running.';
    case 'completed':
      return 'All phases completed successfully.';
    case 'halted':
      return 'Pipeline halted and needs attention.';
  }
}

function gateModeTooltip(mode: GateMode | null): string {
  if (mode === null) {
    return 'Global default: project-wide gate mode applies (no per-pipeline override).';
  }
  switch (mode) {
    case 'task':
      return 'Task gate: approval requested after each task.';
    case 'phase':
      return 'Phase gate: approval requested after each phase.';
    case 'autonomous':
      return 'Autonomous: pipeline proceeds without manual approval.';
  }
}

function autoCommitTooltip(v: V5AutoCommit): string {
  switch (v) {
    case 'always':
      return 'Auto-Commit is on: commits are created after each iteration.';
    case 'ask':
      return 'Auto-Commit prompts before each iteration.';
    case 'never':
      return 'Auto-Commit is off: commits must be made manually.';
  }
}

function autoPrTooltip(v: V5AutoPR): string {
  switch (v) {
    case 'always':
      return 'Auto-PR is on: a pull request is created when phases complete.';
    case 'ask':
      return 'Auto-PR prompts before creating a pull request.';
    case 'never':
      return 'Auto-PR is off: no pull request will be created automatically.';
  }
}

function branchTooltip(branch: string, hasCompareUrl: boolean): string {
  if (hasCompareUrl) {
    return `Open branch comparison on GitHub: ${branch}`;
  }
  return `Branch: ${branch} (no compare link available)`;
}

function prStateTooltip(prUrl: string | null): string {
  if (prUrl === null) {
    return 'Pull request has not yet been created; it will be created when phases complete.';
  }
  if (/^https?:\/\//i.test(prUrl)) {
    return 'Open the existing pull request.';
  }
  return 'Pull request creation failed; check project logs for details.';
}

function followModeTooltip(on: boolean): string {
  if (on) {
    return 'Follow mode is on: the active iteration auto-expands and completed iterations collapse.';
  }
  return 'Follow mode is off. Click to re-engage and apply smart defaults.';
}

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
      <TooltipProvider>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-lg font-semibold">{projectName}</span>
          <Tooltip>
            <TooltipTrigger render={<Badge variant="secondary" className="text-xs">{schemaVersion}</Badge>} />
            <TooltipContent>{SCHEMA_VERSION_TOOLTIP}</TooltipContent>
          </Tooltip>
          {graphStatus && (
            <Tooltip>
              <TooltipTrigger render={<NodeStatusBadge status={graphStatus} />} />
              <TooltipContent>{statusTooltip(graphStatus)}</TooltipContent>
            </Tooltip>
          )}
          {gateMode !== undefined && (
            <Tooltip>
              <TooltipTrigger render={<GateModeBadge mode={gateMode} />} />
              <TooltipContent>{gateModeTooltip(gateMode ?? null)}</TooltipContent>
            </Tooltip>
          )}
          {sourceControl !== null && (() => {
            const { branch, compare_url, auto_commit, auto_pr, pr_url } = sourceControl;
            const hasCompareUrl = compare_url !== null && /^https?:\/\//i.test(compare_url);
            return (
              <>
                {/* Branch region */}
                {hasCompareUrl ? (
                  <Tooltip>
                    <TooltipTrigger render={
                      <a
                        href={compare_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
                        aria-label={`View ${branch} branch diff on GitHub`}
                      >
                        <Github size={12} aria-hidden="true" />
                        {branch}
                      </a>
                    } />
                    <TooltipContent>{branchTooltip(branch, hasCompareUrl)}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger render={
                      <span className="inline-flex items-center gap-1 text-muted-foreground font-mono">
                        <Github size={12} aria-hidden="true" />
                        {branch}
                      </span>
                    } />
                    <TooltipContent>{branchTooltip(branch, hasCompareUrl)}</TooltipContent>
                  </Tooltip>
                )}

                {/* PR status region — only when auto_pr === 'always' */}
                {auto_pr === 'always' && (
                  pr_url !== null && /^https?:\/\//i.test(pr_url) ? (
                    <Tooltip>
                      <TooltipTrigger render={
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
                      } />
                      <TooltipContent>{prStateTooltip(pr_url)}</TooltipContent>
                    </Tooltip>
                  ) : pr_url === null ? (
                    <Tooltip>
                      <TooltipTrigger render={
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
                      } />
                      <TooltipContent>{prStateTooltip(pr_url)}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger render={
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
                      } />
                      <TooltipContent>{prStateTooltip(pr_url)}</TooltipContent>
                    </Tooltip>
                  )
                )}

                {/* Configuration badges */}
                <Tooltip>
                  <TooltipTrigger render={
                    <SpinnerBadge
                      label="Auto-Commit"
                      cssVar={auto_commit === 'always' ? '--status-complete' : '--status-failed'}
                      isSpinning={false}
                      isComplete={auto_commit === 'always'}
                      isRejected={auto_commit !== 'always'}
                      ariaLabel={`Auto-Commit: ${auto_commit}`}
                    />
                  } />
                  <TooltipContent>{autoCommitTooltip(auto_commit)}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger render={
                    <SpinnerBadge
                      label="Auto-PR"
                      cssVar={auto_pr === 'always' ? '--status-complete' : '--status-failed'}
                      isSpinning={false}
                      isComplete={auto_pr === 'always'}
                      isRejected={auto_pr !== 'always'}
                      ariaLabel={`Auto-PR: ${auto_pr}`}
                    />
                  } />
                  <TooltipContent>{autoPrTooltip(auto_pr)}</TooltipContent>
                </Tooltip>
              </>
            );
          })()}
          <div className="ml-auto inline-flex items-center gap-2">
            <label htmlFor="follow-mode-switch">Follow Mode</label>
            <Tooltip>
              <TooltipTrigger render={
                <Switch
                  id="follow-mode-switch"
                  checked={followMode}
                  onCheckedChange={() => onToggleFollowMode()}
                  className="cursor-pointer"
                />
              } />
              <TooltipContent>{followModeTooltip(followMode)}</TooltipContent>
            </Tooltip>
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
      </TooltipProvider>
    </header>
  );
}

"use client";

import { Radio, Circle } from "lucide-react";

export interface TimelineToolbarProps {
  followMode: boolean;
  onToggleFollowMode: () => void;
}

export function TimelineToolbar({ followMode, onToggleFollowMode }: TimelineToolbarProps) {
  const colorClass = followMode ? "text-primary" : "text-muted-foreground";
  const ariaLabel = followMode ? "Follow mode: on" : "Follow mode: off";

  return (
    <div
      role="toolbar"
      aria-label="Timeline toolbar"
      className="flex items-center gap-2 border-b border-border bg-muted/30 px-6 py-2"
    >
      <button
        type="button"
        onClick={onToggleFollowMode}
        aria-pressed={followMode}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${colorClass}`}
      >
        {followMode ? (
          <Radio size={14} aria-hidden="true" />
        ) : (
          <Circle size={14} aria-hidden="true" />
        )}
        <span>Follow</span>
      </button>
    </div>
  );
}

"use client";

import type { ConfigEditorMode } from "@/types/config";
import { cn } from "@/lib/utils";

interface ConfigModeToggleProps {
  /** Current active mode */
  mode: ConfigEditorMode;
  /** Callback when mode changes */
  onModeChange: (mode: ConfigEditorMode) => void;
}

const MODES: { value: ConfigEditorMode; label: string }[] = [
  { value: "form", label: "Form" },
  { value: "raw", label: "Raw YAML" },
];

export function ConfigModeToggle({ mode, onModeChange }: ConfigModeToggleProps) {
  return (
    <div
      data-slot="config-mode-toggle"
      role="tablist"
      aria-label="Editor mode"
      className="bg-muted rounded-lg p-1 flex"
    >
      {MODES.map(({ value, label }) => (
        <button
          key={value}
          role="tab"
          aria-selected={mode === value}
          onClick={() => onModeChange(value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            mode === value
              ? "bg-background shadow-sm text-foreground font-medium"
              : "bg-transparent text-muted-foreground hover:bg-accent/50"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useRef } from "react";
import type { ConfigEditorMode } from "@/types/config";
import { cn } from "@/lib/utils";

interface ConfigModeToggleProps {
  mode: ConfigEditorMode;
  onModeChange: (mode: ConfigEditorMode) => void;
}

const MODES: { value: ConfigEditorMode; label: string }[] = [
  { value: "form", label: "Form" },
  { value: "raw", label: "Raw YAML" },
];

export function ConfigModeToggle({ mode, onModeChange }: ConfigModeToggleProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex: number | null = null;

    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % MODES.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + MODES.length) % MODES.length;
    }

    if (nextIndex !== null) {
      e.preventDefault();
      onModeChange(MODES[nextIndex].value);
      const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      tabs?.[nextIndex]?.focus();
    }
  };

  return (
    <div
      ref={tabListRef}
      data-slot="config-mode-toggle"
      role="tablist"
      aria-label="Editor mode"
      className="bg-muted rounded-lg p-1 flex"
    >
      {MODES.map(({ value, label }, index) => (
        <button
          key={value}
          role="tab"
          aria-selected={mode === value}
          tabIndex={mode === value ? 0 : -1}
          onClick={() => onModeChange(value)}
          onKeyDown={(e) => handleKeyDown(e, index)}
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

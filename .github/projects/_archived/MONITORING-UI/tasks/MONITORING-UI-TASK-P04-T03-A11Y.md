---
project: "MONITORING-UI"
phase: 4
task: 3
title: "Keyboard Navigation + ARIA Attributes"
status: "pending"
skills_required: ["accessibility", "react"]
skills_optional: ["typescript"]
estimated_files: 12
---

# Keyboard Navigation + ARIA Attributes

## Objective

Add comprehensive keyboard navigation and ARIA attributes across all existing components — sidebar listbox navigation, phase card keyboard expansion, drawer focus management, skip-to-content link, `aria-live` regions, progressbar roles, and CF-D accessibility polish items (decorative `aria-hidden`, contextual `aria-label`, empty states).

## Context

The dashboard is a Next.js App Router application using shadcn/ui (base-ui) components and Tailwind CSS. Drawers use shadcn `Sheet` (built on Radix Dialog) which provides native focus trapping and `Escape`-to-close. The sidebar uses shadcn `Sidebar` with a project `listbox`. Two drawers exist: `DocumentDrawer` (640px, right) and `ConfigDrawer` (560px, right). A `ThemeToggle` already has full ARIA (`aria-label` on group and each item, keyboard nav via base-ui `ToggleGroup`). The `ConnectionIndicator` already has `aria-live="polite"`. `StatusIcon` already has `role="img"` and `aria-label`. `PipelineTierBadge` already has `aria-label`. `ProgressBar` already has `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-label`. This task adds the remaining accessibility gaps.

## File Targets

| Action | Path | Notes |
|--------|------|-------|
| MODIFY | `ui/app/layout.tsx` | Add skip-to-content link |
| MODIFY | `ui/components/sidebar/project-sidebar.tsx` | Add `aria-label` on sidebar nav, keyboard arrow navigation on listbox |
| MODIFY | `ui/components/sidebar/project-list-item.tsx` | Add `aria-current` for active item, keyboard handler for arrow keys |
| MODIFY | `ui/components/sidebar/sidebar-search.tsx` | Add `aria-hidden` on decorative search icon |
| MODIFY | `ui/components/dashboard/project-header.tsx` | Add `aria-label` on metadata region, `aria-hidden` on decorative elements |
| MODIFY | `ui/components/execution/phase-card.tsx` | Add `aria-label` on phase card region, `aria-hidden` on decorative border |
| MODIFY | `ui/components/execution/task-card.tsx` | Add `aria-label` on task row, `role="list"` context |
| MODIFY | `ui/components/documents/document-drawer.tsx` | Add `aria-modal="true"`, verify `role="dialog"` |
| MODIFY | `ui/components/documents/document-link.tsx` | Add `aria-hidden="true"` on decorative `FileText` icons |
| MODIFY | `ui/components/config/config-drawer.tsx` | Add `aria-label="Pipeline configuration"` on `SheetContent`, `aria-modal="true"` |
| MODIFY | `ui/components/layout/app-header.tsx` | Add landmark `role="banner"`, `aria-label` on nav group, `aria-live` wrapper for connection status |
| MODIFY | `ui/components/planning/planning-checklist.tsx` | Add `aria-label` on `<ol>`, accessible empty/status text |

## Implementation Steps

1. **Skip-to-content link in `layout.tsx`**: Add a visually-hidden-until-focused anchor `<a href="#main-content" ...>Skip to main content</a>` as the first child of `<body>`. Style it with `sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring focus:rounded-md`. Add `id="main-content"` to the target element — this will be added in `page.tsx` (the `SidebarInset` wrapper or its immediate child).

2. **Sidebar keyboard navigation (`project-sidebar.tsx`)**: The `SidebarMenu` already has `role="listbox"` and `aria-label="Project list"`. Add an `onKeyDown` handler on the `SidebarMenu` element that implements `ArrowUp`/`ArrowDown` navigation by moving focus between `[role="option"]` children. Use `document.querySelectorAll('[role="option"]')` within the listbox ref to find focusable items. Prevent default scroll on arrow keys.

3. **Active item marking (`project-list-item.tsx`)**: The button already has `role="option"` and `aria-selected`. Add `aria-current="true"` when `selected` is true. Add an `onKeyDown` handler: `Enter` triggers `onClick`, `ArrowUp` / `ArrowDown` moves focus to sibling `[role="option"]` elements within the parent `[role="listbox"]`.

4. **Decorative icon cleanup (`sidebar-search.tsx`)**: Add `aria-hidden="true"` to the `<Search>` icon since the `<Input>` already has `aria-label="Filter projects"`.

5. **Project header a11y (`project-header.tsx`)**: Wrap the timestamp/metadata row in a `<div role="group" aria-label="Project metadata">`. The component is already semantic (`<h1>` for name). No further changes needed.

6. **Phase card a11y (`phase-card.tsx`)**: The shadcn `Accordion` + `AccordionTrigger` already handles `aria-expanded` and `Enter`/`Space` toggle. Add `aria-label={`Phase ${phase.phase_number}: ${phase.title}`}` on the outer `<div>`. Add `aria-hidden="true"` on the decorative left border `<div>` (it's visual-only — the status is already communicated via `StatusIcon`).

7. **Task card a11y (`task-card.tsx`)**: Add `role="listitem"` on the task row container. Add `aria-label={`Task ${task.task_number}: ${task.title}, status: ${task.status}`}` on the row.

8. **Document drawer a11y (`document-drawer.tsx`)**: shadcn `Sheet` (Radix Dialog) already provides `role="dialog"` and `aria-modal="true"` natively. Verify the existing `aria-label` on `SheetContent` is present (it is: `aria-label={`Document viewer: ${title}`}`). Add `role="alert"` to the error state container.

9. **Document link a11y (`document-link.tsx`)**: Add `aria-hidden="true"` on the decorative `<FileText>` icon in both the active link and disabled states. The `<button>` already has `aria-label={label}` and the disabled `<span>` already has `aria-disabled="true"`.

10. **Config drawer a11y (`config-drawer.tsx`)**: Add `aria-label="Pipeline configuration"` to the `<SheetContent>` element (fixing the issue identified in the T01 code review). The `Sheet` natively provides `role="dialog"` and `aria-modal="true"`.

## Contracts & Interfaces

No new TypeScript interfaces are introduced. All modifications add HTML attributes to existing JSX elements.

Existing relevant types (no changes):

```typescript
// ui/types/state.ts
type PipelineTier = "planning" | "execution" | "review" | "complete" | "halted";
type PhaseStatus = "not_started" | "in_progress" | "complete" | "failed" | "halted";
type TaskStatus = "not_started" | "in_progress" | "complete" | "failed";
type PlanningStepStatus = "not_started" | "in_progress" | "complete" | "skipped";
```

## Styles & Design Tokens

Skip-to-content link styling (Tailwind utilities only — no new CSS custom properties):

- **Hidden state**: `sr-only` (Tailwind's screen-reader-only class)
- **Focused state**: `focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:ring-2 focus:ring-ring`
- Focus ring: `ring-2 ring-ring ring-offset-2` (Tailwind's shadcn focus convention, 2px solid, 2px offset)

No new design tokens or CSS custom properties are introduced. All existing tokens remain unchanged.

## Current Source Files

### `ui/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Orchestration Dashboard",
  description: "Real-time monitoring dashboard for the orchestration pipeline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('monitoring-ui-theme');
                  if (theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

### `ui/components/sidebar/project-sidebar.tsx`

```tsx
"use client";

import { useState } from "react";
import type { ProjectSummary } from "@/types/components";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { SidebarSearch } from "./sidebar-search";
import { ProjectListItem } from "./project-list-item";

interface ProjectSidebarProps {
  projects: ProjectSummary[];
  selectedProject: string | null;
  onSelectProject: (name: string) => void;
  isLoading: boolean;
}

export function ProjectSidebar({
  projects,
  selectedProject,
  onSelectProject,
  isLoading,
}: ProjectSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarGroupLabel className="text-base">Projects</SidebarGroupLabel>
      </SidebarHeader>

      <SidebarSearch value={searchQuery} onChange={setSearchQuery} />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu role="listbox" aria-label="Project list">
              {isLoading && projects.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton />
                  </SidebarMenuItem>
                ))
              ) : filteredProjects.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  No matching projects
                </li>
              ) : (
                filteredProjects.map((project) => (
                  <SidebarMenuItem key={project.name}>
                    <ProjectListItem
                      project={project}
                      selected={selectedProject === project.name}
                      onClick={() => onSelectProject(project.name)}
                    />
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className="px-4 py-2 text-xs text-muted-foreground">
          {projects.length} {projects.length === 1 ? "project" : "projects"}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
```

### `ui/components/sidebar/project-list-item.tsx`

```tsx
"use client";

import type { ProjectSummary } from "@/types/components";
import { PipelineTierBadge, WarningBadge } from "@/components/badges";

interface ProjectListItemProps {
  project: ProjectSummary;
  selected: boolean;
  onClick: () => void;
}

export function ProjectListItem({
  project,
  selected,
  onClick,
}: ProjectListItemProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-1 rounded-md px-2 py-3 text-left text-sm transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none ${
        selected
          ? "bg-accent text-accent-foreground border-l-2 border-l-[var(--color-link)]"
          : "text-muted-foreground hover:bg-accent/50"
      }`}
    >
      <span className="truncate">{project.name}</span>
      {project.hasMalformedState ? (
        <WarningBadge message="Malformed state" />
      ) : (
        <PipelineTierBadge tier={project.tier} />
      )}
    </button>
  );
}
```

### `ui/components/sidebar/sidebar-search.tsx`

```tsx
"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function SidebarSearch({ value, onChange }: SidebarSearchProps) {
  return (
    <div className="relative px-4 py-2">
      <Search
        size={16}
        className="pointer-events-none absolute left-6.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter projects…"
        aria-label="Filter projects"
        className="pl-8 text-sm"
      />
    </div>
  );
}
```

### `ui/components/dashboard/project-header.tsx`

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { PipelineTierBadge } from "@/components/badges";
import type { PipelineTier, HumanGateMode } from "@/types/state";

interface ProjectHeaderProps {
  project: {
    name: string;
    description: string | null;
    created: string;
    updated: string;
  };
  tier: PipelineTier;
  gateMode: HumanGateMode;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function ProjectHeader({ project, tier, gateMode }: ProjectHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <PipelineTierBadge tier={tier} />
        <Badge variant="outline" className="text-xs">
          {gateMode}
        </Badge>
      </div>

      {project.description && (
        <p className="text-sm text-muted-foreground">{project.description}</p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground font-mono">
          Created: {formatTimestamp(project.created)}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          Updated: {formatTimestamp(project.updated)}
        </span>
        <span className="text-xs text-muted-foreground">
          Read-only monitoring
        </span>
      </div>
    </div>
  );
}
```

### `ui/components/execution/phase-card.tsx`

```tsx
"use client";

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { StatusIcon, ReviewVerdictBadge } from "@/components/badges";
import { DocumentLink } from "@/components/documents";
import { ProgressBar } from "./progress-bar";
import { TaskCard } from "./task-card";
import type { NormalizedPhase } from "@/types/state";

interface PhaseCardProps {
  phase: NormalizedPhase;
  isActive: boolean;
  maxRetries: number;
  onDocClick: (path: string) => void;
}

export function PhaseCard({
  phase,
  isActive,
  maxRetries,
  onDocClick,
}: PhaseCardProps) {
  const completedTasks = phase.tasks.filter(
    (t) => t.status === "complete"
  ).length;

  const borderColor =
    phase.status === "failed" || phase.status === "halted"
      ? "var(--status-failed)"
      : isActive
        ? "var(--status-in-progress)"
        : "transparent";

  return (
    <div
      className="border-l-2 rounded-md"
      style={{ borderLeftColor: borderColor }}
    >
      <Accordion>
        <AccordionItem>
          <AccordionTrigger>
            <div className="flex items-center gap-2 flex-1 mr-2">
              <StatusIcon status={phase.status} />
              <span className="font-medium whitespace-nowrap">
                Phase {phase.phase_number}: {phase.title}
              </span>
              <div className="flex-1 min-w-24">
                <ProgressBar
                  completed={completedTasks}
                  total={phase.total_tasks}
                  status={phase.status}
                />
              </div>
              {phase.phase_doc && (
                <div
                  role="presentation"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <DocumentLink
                    path={phase.phase_doc}
                    label="Phase Plan"
                    onDocClick={onDocClick}
                  />
                </div>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-1 pl-2">
              {phase.tasks.map((task) => (
                <TaskCard
                  key={task.task_number}
                  task={task}
                  maxRetries={maxRetries}
                  onDocClick={onDocClick}
                />
              ))}
            </div>
            {(phase.phase_review_verdict || phase.phase_report || phase.phase_review) && (
              <div className="flex items-center gap-2 mt-3 pt-2 border-t pl-2">
                {phase.phase_review_verdict && (
                  <ReviewVerdictBadge verdict={phase.phase_review_verdict} />
                )}
                {phase.phase_report && (
                  <DocumentLink
                    path={phase.phase_report}
                    label="Phase Report"
                    onDocClick={onDocClick}
                  />
                )}
                {phase.phase_review && (
                  <DocumentLink
                    path={phase.phase_review}
                    label="Phase Review"
                    onDocClick={onDocClick}
                  />
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
```

### `ui/components/execution/task-card.tsx`

```tsx
"use client";

import {
  StatusIcon,
  RetryBadge,
  SeverityBadge,
  ReviewVerdictBadge,
} from "@/components/badges";
import { DocumentLink } from "@/components/documents";
import type { NormalizedTask } from "@/types/state";

interface TaskCardProps {
  task: NormalizedTask;
  maxRetries: number;
  onDocClick: (path: string) => void;
}

export function TaskCard({ task, maxRetries, onDocClick }: TaskCardProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/30">
        <StatusIcon status={task.status} />
        <span className="flex-1 text-sm font-medium truncate">
          T{task.task_number}: {task.title}
        </span>
        <div className="flex items-center gap-1">
          {task.review_verdict !== null && (
            <ReviewVerdictBadge verdict={task.review_verdict} />
          )}
          {task.retries > 0 && (
            <RetryBadge retries={task.retries} max={maxRetries} />
          )}
          <DocumentLink path={task.handoff_doc} label="Handoff" onDocClick={onDocClick} />
          <DocumentLink path={task.report_doc} label="Report" onDocClick={onDocClick} />
          <DocumentLink path={task.review_doc} label="Review" onDocClick={onDocClick} />
        </div>
      </div>
      {task.last_error && (
        <div className="flex items-center gap-2 px-2 pl-8">
          <span className="text-xs text-destructive truncate">
            {task.last_error}
          </span>
          <SeverityBadge severity={task.severity} />
        </div>
      )}
    </div>
  );
}
```

### `ui/components/documents/document-drawer.tsx`

```tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentResponse } from "@/types/components";

import { DocumentMetadata } from "./document-metadata";
import { MarkdownRenderer } from "./markdown-renderer";

interface DocumentDrawerProps {
  open: boolean;
  docPath: string | null;
  loading: boolean;
  error: string | null;
  data: DocumentResponse | null;
  onClose: () => void;
}

function extractFilename(docPath: string): string {
  const segments = docPath.split("/");
  return segments[segments.length - 1] || docPath;
}

export function DocumentDrawer({
  open,
  docPath,
  loading,
  error,
  data,
  onClose,
}: DocumentDrawerProps) {
  const title = data?.frontmatter?.title || (docPath ? extractFilename(docPath) : "Document");

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[640px]"
        aria-label={`Document viewer: ${title}`}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {docPath ? extractFilename(docPath) : "No document selected"}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          {loading && <LoadingSkeleton />}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">Failed to load document</p>
              <p className="mt-1 text-destructive/80">{error}</p>
            </div>
          )}

          {data && !loading && !error && (
            <div className="space-y-4">
              <DocumentMetadata frontmatter={data.frontmatter} />
              <MarkdownRenderer content={data.content} />
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg bg-muted p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
```

### `ui/components/documents/document-link.tsx`

```tsx
"use client";

import { FileText } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DocumentLinkProps {
  path: string | null;
  label: string;
  onDocClick: (path: string) => void;
}

export function DocumentLink({ path, label, onDocClick }: DocumentLinkProps) {
  if (path !== null) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
        aria-label={label}
        onClick={() => onDocClick(path)}
      >
        <FileText className="h-3.5 w-3.5" />
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
          <FileText className="h-3.5 w-3.5" />
          <span>{label}</span>
        </TooltipTrigger>
        <TooltipContent>Not available</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

### `ui/components/config/config-drawer.tsx`

```tsx
"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";
import { LockBadge } from "@/components/badges";
import { ConfigSection } from "./config-section";
import type { ParsedConfig } from "@/types/config";

interface ConfigDrawerProps {
  open: boolean;
  config: ParsedConfig | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

const SECTION_KEYS = [
  "project-storage",
  "pipeline-limits",
  "error-handling",
  "git-strategy",
  "human-gates",
];

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  );
}

function ArrayValue({ items }: { items: string[] }) {
  return (
    <span className="text-sm text-foreground">{items.join(", ")}</span>
  );
}

function GateRow({
  label,
  value,
  locked,
}: {
  label: string;
  value: boolean;
  locked: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5 text-sm text-foreground">
        {String(value)}
        {locked && <LockBadge />}
      </span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-muted/50 p-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ConfigDrawer({
  open,
  config,
  loading,
  error,
  onClose,
}: ConfigDrawerProps) {
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>Pipeline Configuration</SheetTitle>
          <SheetDescription>
            Current orchestration pipeline settings
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 pb-4">
          {loading && <LoadingSkeleton />}

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              <p className="font-medium">Failed to load configuration</p>
              <p className="mt-1 text-destructive/80">{error}</p>
            </div>
          )}

          {config && !loading && !error && (
            <Accordion multiple defaultValue={SECTION_KEYS}>
              <ConfigSection value="project-storage" title="Project Storage">
                <ConfigRow label="Base Path" value={config.projectStorage.basePath} />
                <ConfigRow label="Naming" value={config.projectStorage.naming} />
              </ConfigSection>

              <ConfigSection value="pipeline-limits" title="Pipeline Limits">
                <ConfigRow label="Max Phases" value={config.pipelineLimits.maxPhases} />
                <ConfigRow
                  label="Max Tasks per Phase"
                  value={config.pipelineLimits.maxTasksPerPhase}
                />
                <ConfigRow
                  label="Max Retries per Task"
                  value={config.pipelineLimits.maxRetriesPerTask}
                />
                <ConfigRow
                  label="Max Consecutive Review Rejections"
                  value={config.pipelineLimits.maxConsecutiveReviewRejections}
                />
              </ConfigSection>

              <ConfigSection value="error-handling" title="Error Handling">
                <ConfigRow
                  label="Critical"
                  value={<ArrayValue items={config.errorHandling.critical} />}
                />
                <ConfigRow
                  label="Minor"
                  value={<ArrayValue items={config.errorHandling.minor} />}
                />
                <ConfigRow label="On Critical" value={config.errorHandling.onCritical} />
                <ConfigRow label="On Minor" value={config.errorHandling.onMinor} />
              </ConfigSection>

              <ConfigSection value="git-strategy" title="Git Strategy">
                <ConfigRow label="Strategy" value={config.gitStrategy.strategy} />
                <ConfigRow label="Branch Prefix" value={config.gitStrategy.branchPrefix} />
                <ConfigRow label="Commit Prefix" value={config.gitStrategy.commitPrefix} />
                <ConfigRow
                  label="Auto Commit"
                  value={String(config.gitStrategy.autoCommit)}
                />
              </ConfigSection>

              <ConfigSection value="human-gates" title="Human Gates">
                <GateRow
                  label="After Planning"
                  value={config.humanGates.afterPlanning.value}
                  locked={config.humanGates.afterPlanning.locked}
                />
                <ConfigRow
                  label="Execution Mode"
                  value={config.humanGates.executionMode}
                />
                <GateRow
                  label="After Final Review"
                  value={config.humanGates.afterFinalReview.value}
                  locked={config.humanGates.afterFinalReview.locked}
                />
              </ConfigSection>
            </Accordion>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
```

### `ui/components/layout/app-header.tsx`

```tsx
"use client";

import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConnectionIndicator } from "@/components/badges";
import { ThemeToggle } from "@/components/theme";

interface AppHeaderProps {
  sseStatus: "connected" | "reconnecting" | "disconnected";
  onReconnect: () => void;
  onConfigClick?: () => void;
}

export function AppHeader({ sseStatus, onReconnect, onConfigClick }: AppHeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b px-4"
      style={{
        backgroundColor: "var(--header-bg)",
        borderColor: "var(--header-border)",
      }}
    >
      <h1 className="text-sm font-semibold tracking-tight">
        Orchestration Monitor
      </h1>

      <div className="flex items-center gap-3">
        <ConnectionIndicator status={sseStatus} />
        {sseStatus === "disconnected" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={onReconnect}
          >
            Retry
          </Button>
        )}

        <Button variant="ghost" size="icon" aria-label="Configuration" onClick={onConfigClick}>
          <Settings size={16} />
        </Button>

        <ThemeToggle />
      </div>
    </header>
  );
}
```

### `ui/components/planning/planning-checklist.tsx`

```tsx
"use client";

import { StatusIcon } from "@/components/badges";
import { DocumentLink } from "@/components/documents";
import { PLANNING_STEP_ORDER } from "@/types/state";
import type { PlanningStepName, PlanningStepStatus } from "@/types/state";

interface PlanningChecklistProps {
  steps: Record<PlanningStepName, {
    status: PlanningStepStatus;
    output: string | null;
  }>;
  humanApproved: boolean;
  onDocClick: (path: string) => void;
}

const STEP_DISPLAY_NAMES: Record<PlanningStepName, string> = {
  research: "Research",
  prd: "PRD",
  design: "Design",
  architecture: "Architecture",
  master_plan: "Master Plan",
};

export function PlanningChecklist({
  steps,
  humanApproved,
  onDocClick,
}: PlanningChecklistProps) {
  return (
    <div>
      <ol className="list-none m-0 p-0">
        {PLANNING_STEP_ORDER.map((stepName) => {
          const step = steps[stepName];
          return (
            <li
              key={stepName}
              className="flex items-center gap-2 py-2"
            >
              <StatusIcon status={step.status} />
              <span className="text-sm">{STEP_DISPLAY_NAMES[stepName]}</span>
              <span className="ml-auto">
                <DocumentLink
                  path={step.output}
                  label={step.output ?? STEP_DISPLAY_NAMES[stepName]}
                  onDocClick={onDocClick}
                />
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-t border-border my-2" />

      <div className="flex items-center gap-2 py-2">
        <StatusIcon status={humanApproved ? "complete" : "not_started"} />
        <span className="text-sm">Human Approval</span>
        <span className="text-sm ml-auto text-muted-foreground">
          {humanApproved ? "Approved" : "Pending"}
        </span>
      </div>
    </div>
  );
}
```

## Test Requirements

- [ ] `Tab` key can reach the skip-to-content link; pressing `Enter` scrolls to main content area
- [ ] `ArrowDown` from a project list item moves focus to the next item; `ArrowUp` moves to previous
- [ ] `Enter` on a focused project list item selects it (updates dashboard)
- [ ] All `<FileText>` icons in `DocumentLink` have `aria-hidden="true"`
- [ ] `ConfigDrawer`'s `SheetContent` has `aria-label="Pipeline configuration"`
- [ ] `DocumentDrawer`'s error container has `role="alert"`
- [ ] `Escape` key closes both drawers (native Sheet behavior — verify not broken)
- [ ] Focus returns to the trigger element after closing a drawer (native Sheet behavior — verify not broken)
- [ ] `project-list-item` has `aria-current="true"` when selected
- [ ] `planning-checklist`'s `<ol>` has `aria-label="Planning steps"`
- [ ] All decorative icons (Search in sidebar-search) have `aria-hidden="true"`
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Acceptance Criteria

- [ ] A "Skip to main content" link is visually hidden but appears on keyboard focus, and pressing Enter navigates focus past the sidebar to the main content area
- [ ] Arrow Up/Down keys navigate between project list items within the sidebar listbox
- [ ] Selected project list item has `aria-current="true"` attribute
- [ ] All decorative icons (`Search`, `FileText`) include `aria-hidden="true"`
- [ ] `ConfigDrawer`'s `SheetContent` has `aria-label="Pipeline configuration"`
- [ ] `DocumentDrawer`'s error message container has `role="alert"`
- [ ] `AppHeader` has `role="banner"` on the `<header>` element
- [ ] `PlanningChecklist`'s `<ol>` has `aria-label="Planning steps"`
- [ ] Phase card outer container has an accessible `aria-label` identifying the phase
- [ ] Task card row has `aria-label` describing the task name and status
- [ ] Project header metadata row is wrapped in `role="group"` with `aria-label="Project metadata"`
- [ ] `Escape` closes drawers and focus returns to the trigger element (no regression)
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run lint` passes with zero ESLint warnings

## Constraints

- Do NOT install new npm dependencies — use only existing packages
- Do NOT restructure component files or rename exports — changes are additive ARIA attributes and keyboard handlers only
- Do NOT modify the `ThemeToggle`, `ConnectionIndicator`, `StatusIcon`, `PipelineTierBadge`, or `ProgressBar` components — they already have complete accessibility attributes
- Do NOT re-implement focus trapping in drawers — shadcn `Sheet` (Radix Dialog) provides native focus trap and `Escape`-to-close
- Do NOT modify component prop interfaces — all changes are internal to render output
- Do NOT change any visual styling — this task adds only behavioral and semantic attributes

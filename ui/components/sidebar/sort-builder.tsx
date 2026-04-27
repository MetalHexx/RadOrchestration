"use client"

import { useState } from "react"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Button } from "@/components/ui/button"
import { ArrowUpDown, ChevronDown } from "lucide-react"
import type { SortConfig, SortField, SortDirection } from "@/hooks/use-sort-config"

// ─── Constants ────────────────────────────────────────────────────────────────

const DIRECTION_LABELS: Record<SortField, { asc: string; desc: string }> = {
  status:  { asc: "Urgent first", desc: "Done first" },
  name:    { asc: "A → Z",        desc: "Z → A" },
  updated: { asc: "Oldest first", desc: "Newest first" },
}

const FIELD_LABELS: Record<SortField, string> = {
  status:  "Status",
  name:    "Name",
  updated: "Updated",
}

const SORT_FIELDS: SortField[] = ["status", "name", "updated"]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildSortSummary(config: SortConfig): string {
  const arrow = config.primaryDir === "asc" ? "↑" : "↓"
  return `${FIELD_LABELS[config.primary]} ${arrow}`
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SortBuilderProps {
  config: SortConfig
  onChange: (config: SortConfig) => void
}

function SortBuilder({ config, onChange }: SortBuilderProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  function handlePrimaryDirChange(newValues: string[]) {
    if (newValues.length === 0) return
    const dir = (newValues.find((v) => v !== config.primaryDir) ?? newValues[0]) as SortDirection
    onChange({ ...config, primaryDir: dir })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="h-9 w-full flex items-center px-3 gap-2 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium">Sort</span>
        {!isOpen && (
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {buildSortSummary(config)}
          </span>
        )}
        <ChevronDown
          className={`ml-auto size-3.5 text-muted-foreground shrink-0 transition-transform duration-150${isOpen ? " rotate-180" : ""}`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="p-3 flex flex-col gap-3 border-t border-border">

          {/* Primary section */}
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Primary</span>
            <div role="group" aria-label="Primary sort field" className="flex flex-wrap gap-1">
              {SORT_FIELDS.map((field) => (
                <Button
                  key={field}
                  variant={config.primary === field ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => {
                    const newSecondary = config.secondary === field ? "none" : config.secondary
                    onChange({ ...config, primary: field, secondary: newSecondary })
                  }}
                >
                  {FIELD_LABELS[field]}
                </Button>
              ))}
            </div>
            <ToggleGroup
              aria-label="Primary sort direction"
              value={[config.primaryDir]}
              onValueChange={handlePrimaryDirChange}
              size="sm"
            >
              <ToggleGroupItem value="asc">
                {"↑ " + DIRECTION_LABELS[config.primary].asc}
              </ToggleGroupItem>
              <ToggleGroupItem value="desc">
                {"↓ " + DIRECTION_LABELS[config.primary].desc}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export { SortBuilder }

import type { OrderedDoc } from "@/types/components";
import { getAdjacentDocs } from "@/lib/document-ordering";

interface DocumentNavFooterProps {
  /** Full ordered document list */
  docs: OrderedDoc[];
  /** Current document path */
  currentPath: string;
  /** Callback when user navigates to a different document */
  onNavigate: (path: string) => void;
}

export function DocumentNavFooter({
  docs,
  currentPath,
  onNavigate,
}: DocumentNavFooterProps) {
  const { prev, next, currentIndex, total } = getAdjacentDocs(docs, currentPath);

  if (docs.length === 0) {
    return null;
  }

  const prevDisabled = prev === null;
  const nextDisabled = next === null;

  const activeClasses =
    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
  const disabledClasses =
    "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground opacity-50 cursor-not-allowed";

  return (
    <div className="border-t border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className={prevDisabled ? disabledClasses : activeClasses}
          aria-label={prev ? `Previous document: ${prev.title}` : "No previous document"}
          aria-disabled={prevDisabled ? "true" : undefined}
          tabIndex={prevDisabled ? -1 : undefined}
          onClick={() => {
            if (!prevDisabled && prev) {
              onNavigate(prev.path);
            }
          }}
        >
          <span aria-hidden="true">←</span>
          <span className="max-w-[150px] truncate">
            {prev ? prev.title : "Previous"}
          </span>
        </button>

        {currentIndex >= 0 && total > 0 && (
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {total}
          </span>
        )}

        <button
          type="button"
          className={nextDisabled ? disabledClasses : activeClasses}
          aria-label={next ? `Next document: ${next.title}` : "No next document"}
          aria-disabled={nextDisabled ? "true" : undefined}
          tabIndex={nextDisabled ? -1 : undefined}
          onClick={() => {
            if (!nextDisabled && next) {
              onNavigate(next.path);
            }
          }}
        >
          <span className="max-w-[150px] truncate">
            {next ? next.title : "Next"}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

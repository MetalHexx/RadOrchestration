"use client";

import type React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { DocumentResponse, OrderedDoc } from "@/types/components";

import { DocumentMetadata } from "./document-metadata";
import { DocumentNavFooter } from "./document-nav-footer";
import { MarkdownRenderer } from "./markdown-renderer";

interface DocumentDrawerProps {
  /** Whether the drawer is open */
  open: boolean;
  /** Relative document path, or null */
  docPath: string | null;
  /** Whether document content is currently loading */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Fetched document response, or null */
  data: DocumentResponse | null;
  /** Callback to close the drawer */
  onClose: () => void;
  /** Ref to the scroll container — used to reset scroll position on document change */
  scrollAreaRef: React.RefObject<HTMLDivElement>;
  /** Ordered document list for Prev/Next navigation */
  docs?: OrderedDoc[];
  /** Callback when user navigates via Prev/Next */
  onNavigate?: (path: string) => void;
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
  scrollAreaRef,
  docs,
  onNavigate,
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
        className="!w-full md:!w-[80vw] md:!max-w-[80vw] overflow-hidden"
        aria-label={`Document viewer: ${title}`}
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {docPath ? extractFilename(docPath) : "No document selected"}
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollAreaRef} className="flex-1 min-h-0">
          <ScrollArea className="h-full">
            <div className="px-6 py-4">
              {loading && <LoadingSkeleton />}

              {error && (
                <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
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
            </div>
          </ScrollArea>
        </div>

        {data && !loading && !error && docPath && docs && docs.length > 0 && onNavigate && (
          <DocumentNavFooter
            docs={docs}
            currentPath={docPath}
            onNavigate={onNavigate}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Metadata skeleton */}
      <div className="space-y-2 rounded-lg bg-muted p-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-36" />
      </div>
      {/* Content skeleton */}
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

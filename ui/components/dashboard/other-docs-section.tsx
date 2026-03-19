"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DocumentLink } from "@/components/documents";

interface OtherDocsSectionProps {
  /** List of non-pipeline markdown file paths */
  files: string[];
  /** Callback when a file is clicked to open in the document viewer */
  onDocClick: (path: string) => void;
}

export function OtherDocsSection({ files, onDocClick }: OtherDocsSectionProps) {
  const sorted = [...files].sort((a, b) => a.localeCompare(b));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Other Documents</CardTitle>
      </CardHeader>
      <CardContent>
        <nav aria-label="Other project documents">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No additional documents</p>
          ) : (
            <div className="space-y-1">
              {sorted.map((file) => (
                <div key={file}>
                  <DocumentLink
                    path={file}
                    label={(file.split(/[\/\\]/).pop() ?? file).replace(/\.md$/i, "")}
                    onDocClick={onDocClick}
                  />
                </div>
              ))}
            </div>
          )}
        </nav>
      </CardContent>
    </Card>
  );
}

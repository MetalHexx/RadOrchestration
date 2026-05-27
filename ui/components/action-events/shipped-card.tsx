"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "@/components/documents/markdown-renderer";

interface ActionShipped {
  kind: "action";
  name: string;
  title: string;
  body: string;
  category?: string;
  completion_event?: string | null;
}
interface EventShipped {
  kind: "event";
  name: string;
  title: string;
  body: string;
  signal_line?: string;
}

interface Props {
  slotLabel: string;          // e.g. "2. Action — shipped · read-only"
  data: ActionShipped | EventShipped;
  onJumpToCompletionEvent?: () => void; // wired by parent to scroll to card 4
}

export function ShippedCard({ slotLabel, data, onJumpToCompletionEvent }: Props) {
  return (
    <Card className="bg-muted/40 border-dashed">
      <CardHeader>
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">{slotLabel}</CardTitle>
          <Badge variant="outline">shipped · read-only</Badge>
        </div>
        <CardDescription className="flex items-center gap-2">
          <span>{data.title}</span>
          {data.kind === "action" && data.category && <Badge variant="secondary">[{data.category}]</Badge>}
          {data.kind === "action" && data.completion_event && (
            <button type="button" onClick={onJumpToCompletionEvent} className="text-xs underline text-muted-foreground hover:text-foreground">
              → {data.completion_event}
            </button>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MarkdownRenderer content={data.body} />
        {data.kind === "event" && data.signal_line && (
          <div className="mt-4 rounded bg-muted px-3 py-2 font-mono text-xs">
            <span className="mr-2 text-muted-foreground">Composed Signal:</span>{data.signal_line}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

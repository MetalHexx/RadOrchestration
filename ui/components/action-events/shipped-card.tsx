"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  slotLabel: string;
  data: ActionShipped | EventShipped;
}

export function ShippedCard({ slotLabel, data }: Props) {
  return (
    <Card className="bg-muted/40 border-dashed">
      <CardHeader data-testid="slot-card-header">
        <CardTitle className="text-sm">{slotLabel}</CardTitle>
        <CardDescription>
          <span className="italic text-muted-foreground">{data.title}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MarkdownRenderer content={data.body} />
      </CardContent>
    </Card>
  );
}

import { Network } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProjectsPlaceholderView() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <Network size={32} className="mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            DAG pipeline timeline — coming in DAG-VIEW-2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

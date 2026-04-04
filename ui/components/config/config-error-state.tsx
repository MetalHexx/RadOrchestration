"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfigErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ConfigErrorState({ message, onRetry }: ConfigErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      <AlertCircle className="size-10 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

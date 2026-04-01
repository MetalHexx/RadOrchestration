"use client";

import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ConfigInfoBannerProps {
  message: string;
}

export function ConfigInfoBanner({ message }: ConfigInfoBannerProps) {
  return (
    <Alert>
      <Info className="size-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

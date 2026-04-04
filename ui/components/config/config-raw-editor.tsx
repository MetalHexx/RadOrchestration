"use client";

import { Textarea } from "@/components/ui/textarea";
import { ConfigInfoBanner } from "./config-info-banner";

interface ConfigRawEditorProps {
  value: string;
  onChange: (value: string) => void;
  bannerMessage: string;
}

export function ConfigRawEditor({ value, onChange, bannerMessage }: ConfigRawEditorProps) {
  return (
    <div className="flex h-full flex-col gap-3 px-4 pb-4">
      <ConfigInfoBanner message={bannerMessage} />
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-h-0 resize-none font-mono bg-muted/30"
        placeholder="# orchestration.yml"
      />
    </div>
  );
}

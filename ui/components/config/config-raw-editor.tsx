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
    <div className="flex flex-col gap-3">
      <ConfigInfoBanner message={bannerMessage} />
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono bg-muted/30 min-h-[300px] flex-1"
        placeholder="# orchestration.yml"
      />
    </div>
  );
}

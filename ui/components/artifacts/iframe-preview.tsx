"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface IframePreviewProps {
  projectName: string;
  fileName: string;
  /** CSS scale factor for thumbnails/filmstrip; omit for full-size stage. */
  scale?: number;
  /** When false, sets pointer-events:none (thumbnails). Defaults to true. */
  interactive?: boolean;
  /** Optional title for a11y. */
  title?: string;
  className?: string;
}

export function IframePreview({
  projectName,
  fileName,
  scale,
  interactive = true,
  title,
  className,
}: IframePreviewProps) {
  const src = `/api/projects/${encodeURIComponent(projectName)}/raw?path=${encodeURIComponent(fileName)}`;
  const style: React.CSSProperties = {};
  if (scale !== undefined) {
    style.transform = `scale(${scale})`;
    style.transformOrigin = "top left";
    style.width = `${100 / scale}%`;
    style.height = `${100 / scale}%`;
  }
  if (!interactive) {
    style.pointerEvents = "none";
  }
  return (
    <iframe
      src={src}
      title={title ?? fileName}
      sandbox=""
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("border-0 bg-white", className)}
      style={style}
    />
  );
}

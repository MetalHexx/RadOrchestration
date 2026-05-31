"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { SpinnerBadge } from "./spinner-badge";

/** Persistent, icon-only "unseen change" badge — a lavender additive variant
 *  of SpinnerBadge. One symbol covers a brand-new doc and an update alike. */
export function ChangeBadge() {
  return (
    <span className="animate-pulse">
      <SpinnerBadge
        label="Change"
        ariaLabel="Unseen change"
        cssVar="--live"
        isSpinning={false}
        hideLabel
        icon={<Sparkles size={12} style={{ color: "var(--live)" }} aria-hidden="true" />}
      />
    </span>
  );
}

"use client";

import React from 'react';

interface DAGSectionGroupProps {
  label: string;
  children: React.ReactNode;
}

export const SECTION_LABEL_CLASSES = 'text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1';

export function computeAriaLabel(label: string): string {
  return `${label} section`;
}

export function shouldRender(childCount: number): boolean {
  return childCount > 0;
}

export function DAGSectionGroup({ label, children }: DAGSectionGroupProps) {
  if (React.Children.count(children) === 0) return null;

  return (
    <div role="group" aria-label={computeAriaLabel(label)}>
      <div aria-hidden="true" className={SECTION_LABEL_CLASSES}>
        {label}
      </div>
      {children}
    </div>
  );
}

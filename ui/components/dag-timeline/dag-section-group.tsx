"use client";

import React from 'react';

interface DAGSectionGroupProps {
  label: string;
  children: React.ReactNode;
}

export const SECTION_LABEL_CLASSES = 'text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1';
export const CARD_SHELL_CLASSES = 'border border-border rounded-md bg-card mb-3';
export const CARD_HEADER_CLASSES = 'text-xs font-medium uppercase tracking-wide text-muted-foreground px-3 pt-3 pb-2';

export function isCardSection(label: string): boolean {
  return label === 'Planning' || label === 'Completion';
}

export function computeAriaLabel(label: string): string {
  return `${label} section`;
}

export function shouldRender(childCount: number): boolean {
  return childCount > 0;
}

export function DAGSectionGroup({ label, children }: DAGSectionGroupProps) {
  if (!shouldRender(React.Children.count(children))) return null;

  if (isCardSection(label)) {
    return (
      <div role="group" aria-label={computeAriaLabel(label)} className={CARD_SHELL_CLASSES}>
        <div aria-hidden="true" className={CARD_HEADER_CLASSES}>{label}</div>
        <div className="px-2 pb-2">{children}</div>
      </div>
    );
  }

  return (
    <div role="group" aria-label={computeAriaLabel(label)}>
      <div aria-hidden="true" className={SECTION_LABEL_CLASSES}>{label}</div>
      {children}
    </div>
  );
}

"use client";

import { SSEProvider, useSSEContext } from "@/hooks/use-sse-context";
import { ConfigClickProvider, useConfigClickContext } from "@/hooks/use-config-click-context";
import { AppHeader } from "./app-header";
import type { NavLink } from "./app-header";

// ─── Nav Links ───────────────────────────────────────────────────────────────

const NAV_LINKS: NavLink[] = [
  { label: "Projects", href: "/projects" },
  { label: "Projects (v4)", href: "/projects-v4" },
  { label: "Process Editor", href: "/process-editor" },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface AppHeaderShellProps {
  children: React.ReactNode;
}

// ─── Inner Component ─────────────────────────────────────────────────────────

function AppHeaderShellInner({ children }: AppHeaderShellProps) {
  const { sseStatus, reconnect } = useSSEContext();
  const { onConfigClick } = useConfigClickContext();

  return (
    <>
      <AppHeader
        sseStatus={sseStatus}
        onReconnect={reconnect}
        onConfigClick={onConfigClick}
        navLinks={NAV_LINKS}
      />
      {children}
    </>
  );
}

// ─── Shell Component ──────────────────────────────────────────────────────────

export function AppHeaderShell({ children }: AppHeaderShellProps) {
  return (
    <SSEProvider>
      <ConfigClickProvider>
        <AppHeaderShellInner>{children}</AppHeaderShellInner>
      </ConfigClickProvider>
    </SSEProvider>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConnectionIndicator } from "@/components/badges";
import { ThemeToggle } from "@/components/theme";

export interface NavLink {
  label: string;
  href: string;
}

interface AppHeaderProps {
  sseStatus: "connected" | "reconnecting" | "disconnected";
  onReconnect: () => void;
  onConfigClick?: () => void;
  navLinks?: NavLink[];
}

export function AppHeader({ sseStatus, onReconnect, onConfigClick, navLinks = [] }: AppHeaderProps) {
  const pathname = usePathname();
  return (
    <header
      role="banner"
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b px-4"
      style={{
        backgroundColor: "var(--header-bg)",
        borderColor: "var(--header-border)",
      }}
    >
      <div className="flex items-center gap-6">
        <h1 className="text-sm font-semibold tracking-tight">
          Orchestration Monitor
        </h1>

        <nav aria-label="Main navigation" className="flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "rounded-md bg-accent px-3 py-1.5 text-sm text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                    : "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                }
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <nav aria-label="Dashboard controls" className="flex items-center gap-3">
        <ConnectionIndicator status={sseStatus} />
        {sseStatus === "disconnected" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={onReconnect}
          >
            Retry
          </Button>
        )}

        {onConfigClick !== undefined && (
          <Button variant="ghost" size="icon" aria-label="Configuration" onClick={onConfigClick}>
            <Settings size={16} />
          </Button>
        )}

        <ThemeToggle />
      </nav>
    </header>
  );
}

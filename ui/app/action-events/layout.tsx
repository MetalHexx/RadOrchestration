import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CatalogProvider } from "@/hooks/use-catalog";

export const metadata: Metadata = {
  title: "Instruction Editor — Rad Orchestration",
};

export default function ActionEventsLayout({ children }: { children: ReactNode }): JSX.Element {
  return <CatalogProvider>{children}</CatalogProvider>;
}

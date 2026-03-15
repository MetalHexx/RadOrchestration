"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/hooks/use-theme";
import { initMermaid, renderDiagram } from "@/lib/mermaid-adapter";

interface MermaidBlockProps {
  /** Raw mermaid diagram source code */
  code: string;
}

let idCounter = 0;

export function MermaidBlock({ code }: MermaidBlockProps) {
  const [svgOutput, setSvgOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const idRef = useRef(`mermaid-diagram-${idCounter++}`);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    const theme = resolvedTheme === "dark" ? "dark" : "light";

    async function render() {
      try {
        setIsLoading(true);
        await initMermaid(theme);
        const svg = await renderDiagram(idRef.current, code);
        if (!cancelled) {
          setSvgOutput(svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setSvgOutput(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [code, resolvedTheme]);

  if (isLoading) {
    return (
      <div
        className="bg-muted animate-pulse rounded-md h-48"
        role="img"
        aria-label="Loading diagram..."
      />
    );
  }

  if (error) {
    return (
      <div>
        <p className="text-yellow-600 dark:text-yellow-500 text-sm font-medium">
          ⚠ Diagram render failed
        </p>
        <pre className="bg-muted rounded-md p-3 overflow-x-auto text-sm">
          <code className="font-mono">{code}</code>
        </pre>
      </div>
    );
  }

  const ariaLabel = "Diagram: " + code.split("\n")[0].trim();

  return (
    <div
      className="overflow-x-auto"
      role="img"
      aria-label={ariaLabel}
    >
      <div dangerouslySetInnerHTML={{ __html: svgOutput! }} />
    </div>
  );
}

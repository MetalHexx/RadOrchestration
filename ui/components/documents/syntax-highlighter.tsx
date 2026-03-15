"use client";
import { useState, useEffect } from "react";
import { highlightCode } from "@/lib/shiki-adapter";
import { CopyButton } from "./copy-button";

interface SyntaxHighlighterProps {
  code: string;
  lang: string;
}

export function SyntaxHighlighter({ code, lang }: SyntaxHighlighterProps) {
  const [html, setHtml] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, lang).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => { cancelled = true; };
  }, [code, lang]);

  return (
    <div className="relative group">
      {html ? (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <pre className="bg-muted rounded-md p-3 overflow-x-auto text-sm">
          <code>{code}</code>
        </pre>
      )}
      <CopyButton text={code} />
    </div>
  );
}

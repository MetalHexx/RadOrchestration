"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getRehypePlugins } from "@/lib/rehype-config";
import { Hash } from "lucide-react";
import { MermaidBlock } from "./mermaid-block";
import { SyntaxHighlighter } from "./syntax-highlighter";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  /** Markdown content string (frontmatter already stripped) */
  content: string;
}

/**
 * Recursively extract all text content from a React element tree.
 */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    return extractText(children);
  }
  return "";
}

interface HeadingAnchorProps {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  id?: string;
  children?: React.ReactNode;
}

function HeadingAnchor({ level, id, children, ...props }: HeadingAnchorProps & Record<string, unknown>) {
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <Tag className="group" id={id} {...props}>
      {children}
      {id && (
        <a
          href={`#${id}`}
          aria-label={`Link to section: ${extractText(children)}`}
          className="inline-flex items-center ml-1 text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
          onClick={(event) => {
            event.preventDefault();
            const target = document.getElementById(id);
            if (!target) return;
            const viewport = target.closest('[data-slot="scroll-area-viewport"]');
            if (!viewport) return;
            const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            const targetTop = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
            viewport.scrollTo({ top: targetTop - 16, behavior: prefersReducedMotion ? 'instant' : 'smooth' });
          }}
        >
          <Hash size={level <= 2 ? 18 : 14} aria-hidden="true" />
        </a>
      )}
    </Tag>
  );
}

const components: Components = {
  h1({ children, id, ...props }) {
    return <HeadingAnchor level={1} id={id} {...props}>{children}</HeadingAnchor>;
  },
  h2({ children, id, ...props }) {
    return <HeadingAnchor level={2} id={id} {...props}>{children}</HeadingAnchor>;
  },
  h3({ children, id, ...props }) {
    return <HeadingAnchor level={3} id={id} {...props}>{children}</HeadingAnchor>;
  },
  h4({ children, id, ...props }) {
    return <HeadingAnchor level={4} id={id} {...props}>{children}</HeadingAnchor>;
  },
  h5({ children, id, ...props }) {
    return <HeadingAnchor level={5} id={id} {...props}>{children}</HeadingAnchor>;
  },
  h6({ children, id, ...props }) {
    return <HeadingAnchor level={6} id={id} {...props}>{children}</HeadingAnchor>;
  },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ children, className, ...props }) {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="bg-muted px-1.5 py-0.5 rounded text-sm"
          {...props}
        >
          {children}
        </code>
      );
    }
    // Mermaid detection — render diagram instead of code block
    if (className?.includes('language-mermaid')) {
      return <MermaidBlock code={extractText(children)} />;
    }
    const lang = (className?.replace('language-', '') ?? 'text').trim() || 'text';
    return <SyntaxHighlighter code={extractText(children)} lang={lang} />;
  },
  table({ children, ...props }) {
    return (
      <div className="overflow-x-auto">
        <table {...props}>{children}</table>
      </div>
    );
  },
  input({ type, checked, ...props }) {
    if (type === "checkbox") {
      return (
        <input
          type="checkbox"
          checked={checked}
          disabled
          className="mr-1.5 align-middle"
          {...props}
        />
      );
    }
    return <input type={type} checked={checked} {...props} />;
  },
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={getRehypePlugins()}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

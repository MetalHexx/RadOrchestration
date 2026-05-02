'use client';

import { useEffect, useId, useState } from 'react';
import type { TemplateSummary } from '@/types/template';

interface TemplateSelectorProps {
  /** Raw `?template=<id>` value from the URL on each parent render. */
  requestedTemplateId: string;
  /**
   * Called whenever the resolved id changes (including the initial resolution).
   * Must be referentially stable across renders (e.g. a useState setter or a
   * useCallback-wrapped function); an inline arrow would cause spurious extra
   * calls on every parent re-render.
   */
  onResolved: (id: string) => void;
  /** Shallow URL update; the parent feeds the new `?template=<id>` back as `requestedTemplateId`. */
  routerReplace: (href: string) => void;
}

/**
 * URL-driven template selector. Reads the requested id from `requestedTemplateId`
 * (the parent re-passes this on every URL change), fetches /api/templates once,
 * and resolves to either the requested id (if it names a known template, including
 * a deprecated one reached via direct URL) or silently falls back to `default`.
 *
 * Deprecated templates do not appear in the dropdown options. If the resolved
 * id IS a deprecated template (arrived via direct URL), it is still appended to
 * the option list so the rendered <select> reflects the active value rather
 * than snapping to default.
 *
 * The selector exposes the resolved id to the parent via `onResolved`. The parent
 * gates canvas rendering on receiving a non-empty resolved id, which avoids a
 * 404 flash when the URL names an unknown template.
 */
export function TemplateSelector({
  requestedTemplateId,
  onResolved,
  routerReplace,
}: TemplateSelectorProps): JSX.Element {
  const labelId = useId();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/templates');
        if (!res.ok) throw new Error(`fetch /api/templates failed: ${res.status}`);
        const json = await res.json() as { templates: TemplateSummary[] };
        if (aborted) return;
        setTemplates(json.templates ?? []);
      } catch (err) {
        if (aborted) return;
        // Contain the rejection so it does not escape as an unhandledrejection
        // event. `templates` stays [] → `resolved` falls back to 'default'.
        // The alert below tells the user the list could not load.
        // eslint-disable-next-line no-console
        console.warn('TemplateSelector: failed to load templates', err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!aborted) setLoaded(true);
      }
    }
    void load();
    return () => { aborted = true; };
  }, []);

  // Until templates are loaded, no id is resolved (parent gates canvas rendering on this).
  // Once loaded, an unknown or empty requested id silently maps to 'default'. A
  // deprecated id reached via direct URL counts as "known" so the selector still
  // shows it as the active option.
  const resolved = !loaded
    ? ''
    : requestedTemplateId && templates.some(t => t.id === requestedTemplateId)
      ? requestedTemplateId
      : 'default';

  useEffect(() => {
    if (resolved) onResolved(resolved);
  }, [resolved, onResolved]);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const id = e.target.value;
    const url = new URL(window.location.href);
    url.searchParams.set('template', id);
    routerReplace(`${url.pathname}${url.search}`);
  }

  const visible = templates.filter(t => t.status !== 'deprecated');
  // Append the resolved id as an extra option whenever it is not in the visible
  // list. Covers two cases: a deprecated id reached via direct URL (so the
  // <select> still reflects the active value) and a fetch failure where
  // `templates` is empty (so the dropdown is not rendered blank with the
  // canvas silently rendering 'default').
  const showActiveAsExtra =
    resolved && !visible.some(t => t.id === resolved);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
      <label id={labelId} htmlFor={`${labelId}-select`} className="text-sm font-medium">
        Template
      </label>
      <select
        id={`${labelId}-select`}
        value={resolved}
        onChange={handleChange}
        disabled={!loaded || !!error}
        className="px-2 py-1 border border-[var(--border)] rounded bg-[var(--background)] text-sm"
      >
        {visible.map(t => (
          <option key={t.id} value={t.id} title={t.description}>{t.id}</option>
        ))}
        {showActiveAsExtra && (
          <option key={resolved} value={resolved}>{resolved}</option>
        )}
      </select>
      {error && (
        <span role="alert" className="text-sm text-[var(--destructive)]">
          Failed to load templates
        </span>
      )}
    </div>
  );
}

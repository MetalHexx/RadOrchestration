'use client';

import { useEffect, useId, useState } from 'react';
import type { TemplateSummary } from '@/types/template';

interface TemplateSelectorProps {
  initialTemplateId: string;
  onTemplateChange: (id: string) => void;
  routerReplace: (href: string) => void;
}

/**
 * URL-driven template selector. Reads ?template=<id> via `initialTemplateId`,
 * fetches /api/templates, hides deprecated templates from the dropdown options,
 * tolerates an active id that is not in the visible options (deprecated-by-URL),
 * and on change writes ?template=<id> via `routerReplace`. Silent fallback to
 * `default` when initialTemplateId is empty or names an id the API did not return.
 */
export function TemplateSelector({
  initialTemplateId,
  onTemplateChange,
  routerReplace,
}: TemplateSelectorProps): JSX.Element {
  const labelId = useId();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [activeId, setActiveId] = useState<string>(initialTemplateId || 'default');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let aborted = false;
    async function load(): Promise<void> {
      try {
        const res = await fetch('/api/templates');
        if (!res.ok) throw new Error(`fetch /api/templates failed: ${res.status}`);
        const json = await res.json() as { templates: TemplateSummary[] };
        if (aborted) return;
        const list = json.templates ?? [];
        setTemplates(list);
        const requested = initialTemplateId;
        const known = new Set(list.map(t => t.id));
        // DD-6: silent fallback to default when ?template is absent, empty, or unknown.
        // DD-7: a known-but-deprecated id stays visible (we treat it as known).
        const resolved = requested && known.has(requested) ? requested : 'default';
        setActiveId(resolved);
        onTemplateChange(resolved);
      } finally {
        if (!aborted) setLoaded(true);
      }
    }
    void load();
    return () => { aborted = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const id = e.target.value;
    setActiveId(id);
    onTemplateChange(id);
    // FR-15: shallow URL update via router.replace; URL is the only persistence layer (AD-7).
    const url = new URL(window.location.href);
    url.searchParams.set('template', id);
    routerReplace(`${url.pathname}${url.search}`);
  }

  // FR-16 / DD-7: hide deprecated from the option list, but if the active id IS the
  // deprecated id (arrived via direct URL), append it as a non-listed option so the
  // <select> still reflects the active value rather than silently snapping to default.
  const visible = templates.filter(t => t.status !== 'deprecated');
  const showActiveAsExtra =
    activeId &&
    !visible.some(t => t.id === activeId) &&
    templates.some(t => t.id === activeId);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--border)]">
      <label id={labelId} htmlFor={`${labelId}-select`} className="text-sm font-medium">
        Template
      </label>
      <select
        id={`${labelId}-select`}
        value={activeId}
        onChange={handleChange}
        disabled={!loaded}
        className="px-2 py-1 border border-[var(--border)] rounded bg-[var(--background)] text-sm"
      >
        {visible.map(t => (
          <option key={t.id} value={t.id} title={t.description}>{t.id}</option>
        ))}
        {showActiveAsExtra && (
          <option key={activeId} value={activeId}>{activeId}</option>
        )}
      </select>
    </div>
  );
}

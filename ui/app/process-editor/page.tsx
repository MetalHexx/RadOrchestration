'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { TemplateSelector } from '@/components/process-editor/template-selector';

const ReadOnlyCanvas = dynamic(
  () => import('@/components/process-editor/read-only-canvas').then(mod => ({ default: mod.ReadOnlyCanvas })),
  { ssr: false }
);

export default function ProcessEditorPage(): JSX.Element {
  // Read the requested id from the URL on every render so back/forward navigation
  // and direct URL edits flow through to the selector and canvas. The selector
  // resolves it (silently falling back to 'default' for absent or unknown ids) and
  // notifies us via onResolved; we gate canvas rendering on that resolution to
  // avoid a 404 flash when the URL names an unknown template.
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTemplateId = searchParams.get('template') ?? '';
  const [resolvedTemplateId, setResolvedTemplateId] = useState<string>('');

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
        <TemplateSelector
          requestedTemplateId={requestedTemplateId}
          onResolved={setResolvedTemplateId}
          routerReplace={(href: string) => router.replace(href, { scroll: false })}
        />
        {resolvedTemplateId && <ReadOnlyCanvas templateId={resolvedTemplateId} />}
      </main>
    </div>
  );
}

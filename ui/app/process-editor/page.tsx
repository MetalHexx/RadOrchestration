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
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTemplateId = searchParams.get('template') ?? '';
  const [activeTemplateId, setActiveTemplateId] = useState<string>(initialTemplateId || 'default');

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
        <TemplateSelector
          initialTemplateId={initialTemplateId}
          onTemplateChange={setActiveTemplateId}
          routerReplace={(href: string) => router.replace(href, { scroll: false })}
        />
        <ReadOnlyCanvas templateId={activeTemplateId} />
      </main>
    </div>
  );
}

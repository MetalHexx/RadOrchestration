import dynamic from 'next/dynamic';
import type { Metadata } from 'next';

const ReadOnlyCanvas = dynamic(
  () => import('@/components/process-editor/read-only-canvas').then(mod => ({ default: mod.ReadOnlyCanvas })),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Process Editor — Orchestration Monitor',
};

export default function ProcessEditorPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <main id="main-content" className="flex-1 flex flex-col overflow-hidden">
        <ReadOnlyCanvas templateId="default" />
      </main>
    </div>
  );
}

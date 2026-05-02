import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Process Editor — Rad Orchestration',
};

export default function ProcessEditorLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return <>{children}</>;
}

import { Button } from '@/components/ui/button';

interface Props { dirty: boolean; saving: boolean; onDiscard: () => void; onSave: () => void }

export function SaveBar({ dirty, saving, onDiscard, onSave }: Props) {
  return (
    <div className="sticky bottom-0 flex items-center justify-end gap-2.5 border-t bg-card/90 px-7 py-3.5 backdrop-blur">
      <Button variant="ghost" disabled={!dirty || saving} onClick={onDiscard}>Discard all</Button>
      <Button disabled={!dirty || saving} onClick={onSave}>Save all</Button>
    </div>
  );
}

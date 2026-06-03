import { Button } from '@/components/ui/button';

export function EmptyRegistryState({ onAddRepo }: { onAddRepo: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-sm text-muted-foreground">
        No repositories yet. Add your first repository to get started.
      </p>
      <Button onClick={onAddRepo}>Add your first repository</Button>
    </div>
  );
}

export function NothingSelectedState() {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <p className="text-sm text-muted-foreground">
        Select a repo or repo group from the left to view and edit it.
      </p>
    </div>
  );
}

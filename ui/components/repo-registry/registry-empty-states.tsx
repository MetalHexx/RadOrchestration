import { Button } from '@/components/ui/button';

export function EmptyRegistryState({ onAddRepo }: { onAddRepo: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        No repositories yet. Add your first repository to get started.
      </p>
      <Button onClick={onAddRepo}>Add your first repository</Button>
    </div>
  );
}

export function NothingSelectedState() {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">
        Select a repo or repo group from the left to view and edit it.
      </p>
    </div>
  );
}

export function RegistryErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="max-w-md text-sm text-destructive" role="alert">{message}</p>
      <Button variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  );
}

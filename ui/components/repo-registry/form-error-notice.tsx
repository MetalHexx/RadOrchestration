export function FormErrorNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </div>
  );
}

"use client";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props { open: boolean; onCancel: () => void; onConfirm: () => void; }
export function UnsavedChangesDialog({ open, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v: boolean) => { if (!v) onCancel(); }}>
      <DialogContent>
        <div className="flex flex-col gap-2">
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>Switching away will lose unsaved edits on this page.</DialogDescription>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} autoFocus>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Discard and continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

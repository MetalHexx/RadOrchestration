"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetScrollBody,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigModeToggle } from "./config-mode-toggle";
import { ConfigForm } from "./config-form";
import { ConfigRawEditor } from "./config-raw-editor";
import { ConfigFooter } from "./config-footer";
import { ConfigErrorState } from "./config-error-state";
import type { UseConfigEditorReturn } from "@/hooks/use-config-editor";

interface ConfigEditorPanelProps {
  editor: UseConfigEditorReturn;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg bg-muted/50 p-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </div>
  );
}

export function ConfigEditorPanel({ editor }: ConfigEditorPanelProps) {
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      editor.close();
    }
  };

  const isReady = !editor.loading && !editor.loadError;

  return (
    <Sheet open={editor.isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Pipeline Configuration</SheetTitle>
          <SheetDescription>
            {editor.mode === "raw"
              ? "Edit the raw orchestration.yml file"
              : "Edit orchestration pipeline settings"}
          </SheetDescription>
          {isReady && (
            <ConfigModeToggle mode={editor.mode} onModeChange={editor.setMode} />
          )}
        </SheetHeader>

        <SheetScrollBody>
          {(editor.loading || editor.loadError || (isReady && editor.mode === "form")) && (
            <ScrollArea className="h-full">
              {editor.loading && (
                <div className="px-4 pb-4">
                  <LoadingSkeleton />
                </div>
              )}

              {editor.loadError && (
                <div className="px-4 pb-4">
                  <ConfigErrorState message={editor.loadError} onRetry={editor.retry} />
                </div>
              )}

              {isReady && editor.mode === "form" && editor.config && (
                <div className="px-4 pb-4">
                  <ConfigForm
                    config={editor.config}
                    onChange={editor.updateField}
                    errors={editor.errors}
                  />
                </div>
              )}
            </ScrollArea>
          )}

          {isReady && editor.mode === "raw" && (
            <ConfigRawEditor
              value={editor.rawYaml}
              onChange={editor.setRawYaml}
              bannerMessage={
                editor.formDirtyOnSwitch
                  ? "Form changes serialized to YAML. Comments from the original file are not preserved."
                  : "Editing raw YAML. No validation is applied \u2014 save writes the content as-is."
              }
            />
          )}
        </SheetScrollBody>

        {isReady && (
          <ConfigFooter
            onSave={editor.save}
            saveState={editor.saveState}
            errorMessage={editor.saveError ?? undefined}
            disabled={!editor.isDirty || (editor.mode === "form" && Object.keys(editor.errors).length > 0)}
            onDismissError={editor.dismissSaveError}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

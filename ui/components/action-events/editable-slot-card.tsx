"use client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSlotEditor, type SlotKey } from "@/hooks/use-slot-editor";

interface Props {
  slotKey: SlotKey;
  slotLabel: string;          // e.g. "1. Before doing this action — custom"
  placeholder: string;        // empty-state guidance per DD-11
  onDirtyChange: (key: string, dirty: boolean) => void;
  onPersistComplete?: () => void;
  onContentChange?: (key: string, value: string) => void;
}

export function EditableSlotCard(props: Props) {
  const { content, setContent, dirty, save, discard } = useSlotEditor(props.slotKey, props.onDirtyChange, props.onPersistComplete);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{props.slotLabel}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">custom</Badge>
          <span aria-hidden className={dirty ? "text-amber-500" : "invisible"}>● dirty</span>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          className="font-mono min-h-[160px]"
          value={content}
          placeholder={props.placeholder}
          onChange={(e) => { setContent(e.target.value); props.onContentChange?.(`${props.slotKey.kind}.${props.slotKey.name}.${props.slotKey.slot}`, e.target.value); }}
        />
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" onClick={discard} disabled={!dirty}>Discard</Button>
        <Button onClick={save} disabled={!dirty && content === ""}>Save</Button>
      </CardFooter>
    </Card>
  );
}

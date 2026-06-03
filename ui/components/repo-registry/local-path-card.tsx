import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { BindState } from './types';
import { EditableCard } from './editable-card';
import { FieldError } from './field-error';

export interface PathCardCopy {
  placeholder?: string; helper?: string; warning?: string; isInvalid: boolean;
}

export function pathCardCopy(state: BindState): PathCardCopy {
  switch (state) {
    case 'unbound':
      return {
        placeholder: 'Paste the local folder path…',
        helper: 'Point this repo at your local clone — the path stays on this machine.',
        isInvalid: false,
      };
    case 'missing':
      return {
        warning: 'This folder no longer exists on this machine — paste a new path to re-bind.',
        isInvalid: true,
      };
    default:
      return { isInvalid: false };
  }
}

interface Props {
  state: BindState;
  value: string;
  onChange: (v: string) => void;
  serverError?: string;
}

export function LocalPathCard({ state, value, onChange, serverError }: Props) {
  const copy = pathCardCopy(state);
  const invalid = copy.isInvalid || !!serverError;
  return (
    <EditableCard title="Local path" accent="local">
      <Input
        className={cn('font-mono', invalid && 'border-destructive')}
        value={value}
        placeholder={copy.placeholder}
        aria-invalid={invalid}
        aria-describedby="err-localPath"
        onChange={e => onChange(e.target.value)}
      />
      {copy.helper && <p className="mt-2 text-xs text-muted-foreground">{copy.helper}</p>}
      {copy.warning && <p className="mt-2 text-xs text-destructive">{copy.warning}</p>}
      <FieldError id="err-localPath" message={serverError} />
    </EditableCard>
  );
}

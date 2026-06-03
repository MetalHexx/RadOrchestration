import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  title: string;
  accent?: 'local';
  children: React.ReactNode;
}

export function EditableCard({ title, accent, children }: Props) {
  return (
    <Card
      className={cn('mt-[18px]', accent === 'local' && 'border-l-[3px]')}
      style={accent === 'local'
        ? { borderLeftColor: 'var(--color-warning)' }
        : undefined}
    >
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

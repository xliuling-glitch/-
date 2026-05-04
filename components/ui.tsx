import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  elevated,
}: {
  className?: string;
  children: React.ReactNode;
  elevated?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-card p-6',
        elevated ? 'border border-ash bg-elevated shadow-subtle' : 'bg-ledger-white',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ color, text }: { color: string; text: string }) {
  return <span className={cn('rounded-md px-2.5 py-1 text-xs font-normal', color)}>{text}</span>;
}

'use client';

import { cn } from '@/lib/utils';
import { WORKFLOW_STATUS_META, type WorkflowStatusKey } from '@/lib/workflow-status';

export function WorkflowStatusBadge({
  status,
  className,
  size = 'md',
}: {
  status: WorkflowStatusKey;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const m = WORKFLOW_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        m.badgeClass,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', m.dotClass)} aria-hidden />
      {m.label}
    </span>
  );
}

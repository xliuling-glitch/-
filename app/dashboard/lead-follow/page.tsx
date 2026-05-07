import { Suspense } from 'react';
import { LeadFollowHubApp } from '@/components/lead-follow-hub/LeadFollowHubApp';

export default function LeadFollowPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-mid">加载留资跟进表…</div>}>
      <LeadFollowHubApp />
    </Suspense>
  );
}

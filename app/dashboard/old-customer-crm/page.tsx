'use client';

import { Suspense } from 'react';
import { OldCustomerCrmApp } from '@/components/old-customer-crm/OldCustomerCrmApp';

export default function OldCustomerCrmPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-mid">加载中…</div>}>
      <OldCustomerCrmApp />
    </Suspense>
  );
}

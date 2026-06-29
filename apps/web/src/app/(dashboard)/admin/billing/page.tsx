'use client';

import { BillingOverview } from '@/components/admin/BillingOverview';

export default function AdminBillingPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing Overview</h1>
        <p className="text-muted-foreground">
          Subscription plans, revenue metrics, and usage summary.
        </p>
      </div>

      <BillingOverview />
    </div>
  );
}

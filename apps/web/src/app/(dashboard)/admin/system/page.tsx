'use client';

import { SystemStatus } from '@/components/admin/SystemStatus';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function AdminSystemPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
        <p className="text-muted-foreground">
          Monitor service status, performance metrics, and system health.
        </p>
      </div>

      <SystemStatus />

      {/* Metrics Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Metrics</CardTitle>
          <CardDescription>
            Real-time system performance and resource utilization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              Metrics charts will be displayed here when connected to monitoring services.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { Clock, Loader2, User } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { apiClient } from '@/lib/api';

interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export function ConfigAuditLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const data = await apiClient.get<AuditLogEntry[]>(
          '/admin/audit-logs',
          { resource: 'platform_config', limit: '20' }
        );
        setLogs(data);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('create') || action.includes('upsert')) return 'default';
    if (action.includes('delete')) return 'destructive';
    return 'secondary';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Configuration Changes</CardTitle>
        <CardDescription>
          Audit trail of all platform configuration modifications.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">
              No configuration changes recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between rounded-lg border p-3"
              >
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                      {log.resourceId && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.resourceId}
                        </span>
                      )}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {log.metadata.category ? `Category: ${String(log.metadata.category)}` : ''}
                        {log.metadata.key ? ` | Key: ${String(log.metadata.key)}` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

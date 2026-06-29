'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: string;
  uptime?: string;
}

const services: ServiceStatus[] = [
  { name: 'API Server', status: 'healthy', latency: '12ms', uptime: '99.99%' },
  { name: 'Database (PostgreSQL)', status: 'healthy', latency: '3ms', uptime: '99.95%' },
  { name: 'Redis Cache', status: 'healthy', latency: '1ms', uptime: '99.99%' },
  { name: 'Queue Worker', status: 'degraded', latency: '45ms', uptime: '98.50%' },
];

function getStatusIndicator(status: ServiceStatus['status']) {
  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'down':
      return 'bg-red-500';
  }
}

function getStatusLabel(status: ServiceStatus['status']) {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'down':
      return 'Down';
  }
}

export function SystemStatus() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Service Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'h-3 w-3 rounded-full',
                    getStatusIndicator(service.status)
                  )}
                />
                <div>
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {getStatusLabel(service.status)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                {service.latency && (
                  <p className="text-xs text-muted-foreground">
                    Latency: {service.latency}
                  </p>
                )}
                {service.uptime && (
                  <p className="text-xs text-muted-foreground">
                    Uptime: {service.uptime}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

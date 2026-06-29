'use client';

import { ConfigAuditLog } from '@/components/admin/ConfigAuditLog';
import { ConfigurationPanel } from '@/components/admin/ConfigurationPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CONFIG_CATEGORIES = [
  { value: 'AI_PROVIDERS', label: 'AI Providers' },
  { value: 'DEPLOYMENT_PROVIDERS', label: 'Deployment Providers' },
  { value: 'SOURCE_CONTROL', label: 'Source Control' },
  { value: 'AUTH_PROVIDERS', label: 'Auth Providers' },
  { value: 'DATABASES', label: 'Databases' },
  { value: 'OBJECT_STORAGE', label: 'Object Storage' },
  { value: 'EMAIL_PROVIDERS', label: 'Email Providers' },
  { value: 'PAYMENT_PROVIDERS', label: 'Payment Providers' },
  { value: 'MONITORING_ANALYTICS', label: 'Monitoring & Analytics' },
] as const;

export default function AdminConfigurationPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Configuration</h1>
        <p className="text-muted-foreground">
          Manage API keys, credentials, and integrations for all platform services.
        </p>
      </div>

      <Tabs defaultValue="AI_PROVIDERS" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {CONFIG_CATEGORIES.map((category) => (
            <TabsTrigger key={category.value} value={category.value} className="text-xs">
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CONFIG_CATEGORIES.map((category) => (
          <TabsContent key={category.value} value={category.value}>
            <ConfigurationPanel
              category={category.value}
              categoryLabel={category.label}
            />
          </TabsContent>
        ))}
      </Tabs>

      <ConfigAuditLog />
    </div>
  );
}

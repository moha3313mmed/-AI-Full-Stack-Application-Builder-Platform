'use client';

import { CreditCard, FolderOpen, Rocket, Users } from 'lucide-react';

import { StatsCard } from '@/components/admin/StatsCard';

const stats = [
  {
    title: 'Total Users',
    value: '2,847',
    icon: Users,
    change: '+12% from last month',
    changeType: 'positive' as const,
  },
  {
    title: 'Active Projects',
    value: '1,429',
    icon: FolderOpen,
    change: '+8% from last month',
    changeType: 'positive' as const,
  },
  {
    title: 'Deployments This Month',
    value: '3,582',
    icon: Rocket,
    change: '+23% from last month',
    changeType: 'positive' as const,
  },
  {
    title: 'Active Subscriptions',
    value: '633',
    icon: CreditCard,
    change: '-2% from last month',
    changeType: 'negative' as const,
  },
];

export default function AdminOverviewPage() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground">
          Platform statistics and key metrics at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatsCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            change={stat.change}
            changeType={stat.changeType}
          />
        ))}
      </div>
    </div>
  );
}

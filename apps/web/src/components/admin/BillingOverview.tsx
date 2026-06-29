'use client';

import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  subscribers: number;
  highlighted?: boolean;
}

const plans: Plan[] = [
  {
    name: 'FREE',
    price: '$0',
    period: '/month',
    features: ['1 project', '100 AI requests/day', 'Community support'],
    subscribers: 1245,
  },
  {
    name: 'PRO',
    price: '$29',
    period: '/month',
    features: ['10 projects', '1,000 AI requests/day', 'Priority support', 'Custom agents'],
    subscribers: 532,
    highlighted: true,
  },
  {
    name: 'TEAM',
    price: '$79',
    period: '/month',
    features: ['Unlimited projects', '10,000 AI requests/day', 'Team collaboration', 'SSO'],
    subscribers: 89,
  },
  {
    name: 'ENTERPRISE',
    price: 'Custom',
    period: '',
    features: ['Unlimited everything', 'Dedicated support', 'On-premise option', 'SLA guarantee'],
    subscribers: 12,
  },
];

const subscriptionStats = {
  totalRevenue: '$48,750',
  activeSubscriptions: 633,
  churnRate: '2.3%',
  avgRevenuePerUser: '$34.50',
};

export function BillingOverview() {
  return (
    <div className="space-y-6">
      {/* Subscription Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{subscriptionStats.totalRevenue}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active Subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{subscriptionStats.activeSubscriptions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Churn Rate</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{subscriptionStats.churnRate}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ARPU</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{subscriptionStats.avgRevenuePerUser}</p>
          </CardContent>
        </Card>
      </div>

      {/* Plan Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={plan.highlighted ? 'border-primary' : undefined}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.highlighted && <Badge>Popular</Badge>}
              </div>
              <CardDescription>
                <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                {plan.period}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {plan.subscribers} active subscribers
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

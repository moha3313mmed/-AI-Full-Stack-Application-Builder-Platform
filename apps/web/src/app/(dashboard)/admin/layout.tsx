'use client';

import {
  Activity,
  CreditCard,
  Key,
  LayoutDashboard,
  Shield,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const adminNavigation = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard },
  { name: 'Users', href: '/admin/users', icon: Users },
  { name: 'Billing', href: '/admin/billing', icon: CreditCard },
  { name: 'Configuration', href: '/admin/configuration', icon: Key },
  { name: 'System', href: '/admin/system', icon: Activity },
];

// TODO: This is a placeholder awaiting real auth context integration.
// In production, CURRENT_USER_ROLE should be derived from the authenticated
// user's session/token (e.g., via a useAuth() hook or server-side session).
const CURRENT_USER_ROLE = 'ADMIN';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (CURRENT_USER_ROLE !== 'ADMIN' && CURRENT_USER_ROLE !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Access Denied</h2>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to access the admin panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <nav className="w-56 shrink-0 border-r bg-muted/30 p-4">
        <div className="mb-4 px-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Admin Panel
          </h2>
        </div>
        <div className="flex flex-col gap-1">
          {adminNavigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

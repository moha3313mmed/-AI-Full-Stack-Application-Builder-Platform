'use client';

import { UsersTable } from '@/components/admin/UsersTable';

export default function AdminUsersPage() {
  const handleRoleChange = (userId: string, newRole: string) => {
    // In production, this would call an API to update the user role
    console.log(`Updating user ${userId} to role ${newRole}`);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          Manage platform users, roles, and permissions.
        </p>
      </div>

      <UsersTable onRoleChange={handleRoleChange} />
    </div>
  );
}

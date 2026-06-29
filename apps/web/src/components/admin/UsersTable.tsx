'use client';

import { Search } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string;
  status: 'active' | 'inactive' | 'suspended';
}

const mockUsers: User[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'ADMIN', createdAt: '2024-01-15', status: 'active' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'USER', createdAt: '2024-02-20', status: 'active' },
  { id: '3', name: 'Charlie Davis', email: 'charlie@example.com', role: 'USER', createdAt: '2024-03-10', status: 'inactive' },
  { id: '4', name: 'Diana Lee', email: 'diana@example.com', role: 'SUPER_ADMIN', createdAt: '2024-01-05', status: 'active' },
  { id: '5', name: 'Evan Brown', email: 'evan@example.com', role: 'USER', createdAt: '2024-04-01', status: 'suspended' },
  { id: '6', name: 'Fiona Garcia', email: 'fiona@example.com', role: 'USER', createdAt: '2024-04-15', status: 'active' },
  { id: '7', name: 'George Wilson', email: 'george@example.com', role: 'ADMIN', createdAt: '2024-05-01', status: 'active' },
  { id: '8', name: 'Hannah Martinez', email: 'hannah@example.com', role: 'USER', createdAt: '2024-05-12', status: 'active' },
];

interface UsersTableProps {
  onRoleChange?: (userId: string, newRole: User['role']) => void;
}

export function UsersTable({ onRoleChange }: UsersTableProps) {
  const [search, setSearch] = useState('');

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadgeVariant = (role: User['role']) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'destructive' as const;
      case 'ADMIN':
        return 'default' as const;
      default:
        return 'secondary' as const;
    }
  };

  const getStatusColor = (status: User['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-yellow-500';
      case 'suspended':
        return 'bg-red-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{user.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={getRoleBadgeVariant(user.role)}>{user.role}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.createdAt}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${getStatusColor(user.status)}`} />
                    <span className="capitalize">{user.status}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={user.role}
                    onChange={(e) =>
                      onRoleChange?.(user.id, e.target.value as User['role'])
                    }
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                  </select>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No users found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

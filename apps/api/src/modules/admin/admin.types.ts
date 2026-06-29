export interface PlatformStats {
  users: number;
  projects: number;
  deployments: number;
  activeSubscriptions: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
}

export interface PaginatedUsers {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

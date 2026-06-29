'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export interface TeamMember {
  id: string;
  userId: string;
  username: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  avatarUrl?: string;
  joinedAt: string;
  lastActiveAt?: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface AddMemberInput {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  permissions?: string[];
}

/**
 * @deprecated Use AddMemberInput instead. Kept for backward compatibility with InviteMemberDialog.
 */
export interface InviteMemberInput {
  email: string;
  role: 'admin' | 'member' | 'viewer';
  message?: string;
}

/**
 * @deprecated Role updates are handled via remove + re-add with new role.
 */
export interface UpdateMemberRoleInput {
  role: 'admin' | 'member' | 'viewer';
}

const teamFetcher = async (url: string): Promise<Team> => {
  return apiClient.get<Team>(url);
};

export function useTeam(teamId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    teamId ? `/teams/${teamId}` : null,
    teamFetcher
  );

  const addMember = async (input: AddMemberInput) => {
    const result = await apiClient.post<TeamMember>(
      `/teams/${teamId}/members`,
      input
    );
    await mutate();
    return result;
  };

  /**
   * @deprecated Use addMember with AddMemberInput instead.
   * This bridges the old invite-based UI to the teams API.
   */
  const inviteMember = async (_input: InviteMemberInput) => {
    // The backend uses userId-based adding. This is a placeholder
    // that will be replaced once user lookup by email is available.
    await mutate();
  };

  /**
   * @deprecated Role updates require remove + re-add via the teams API.
   */
  const updateRole = async (_memberId: string, _input: UpdateMemberRoleInput) => {
    // The teams controller does not have a PATCH endpoint for role updates.
    // To change a role, remove the member and re-add with the new role.
    await mutate();
  };

  const removeMember = async (userId: string) => {
    await apiClient.delete(`/teams/${teamId}/members/${userId}`);
    await mutate();
  };

  return {
    team: data ?? null,
    members: data?.members ?? [],
    isLoading,
    isError: !!error,
    error,
    refresh: mutate,
    addMember,
    inviteMember,
    updateRole,
    removeMember,
  };
}

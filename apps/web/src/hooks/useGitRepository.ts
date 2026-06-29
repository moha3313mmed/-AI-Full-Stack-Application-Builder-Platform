'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export interface GitBranch {
  name: string;
  isDefault: boolean;
  isCurrent: boolean;
  lastCommitSha: string;
  lastCommitMessage: string;
  lastCommitDate: string;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  authorEmail: string;
  date: string;
  filesChanged: number;
  additions: number;
  deletions: number;
}

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  description?: string;
  status: 'open' | 'closed' | 'merged';
  sourceBranch: string;
  targetBranch: string;
  author: string;
  reviewers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GitRepositoryInfo {
  url: string;
  provider: string;
  defaultBranch: string;
  currentBranch: string;
}

export interface CreateBranchInput {
  name: string;
  sourceBranch?: string;
}

const repoFetcher = async (url: string): Promise<GitRepositoryInfo> => {
  return apiClient.get<GitRepositoryInfo>(url);
};

const branchesFetcher = async (url: string): Promise<GitBranch[]> => {
  return apiClient.get<GitBranch[]>(url);
};

const commitsFetcher = async (url: string): Promise<GitCommit[]> => {
  return apiClient.get<GitCommit[]>(url);
};

const prsFetcher = async (url: string): Promise<PullRequest[]> => {
  return apiClient.get<PullRequest[]>(url);
};

export function useGitRepository(projectId: string) {
  const { data: repo, error: repoError, isLoading: repoLoading } = useSWR(
    projectId ? `/git/repositories/${projectId}` : null,
    repoFetcher
  );

  const {
    data: branches,
    error: branchesError,
    isLoading: branchesLoading,
    mutate: mutateBranches,
  } = useSWR(
    projectId ? `/git/repositories/${projectId}/branches` : null,
    branchesFetcher
  );

  const {
    data: commits,
    error: commitsError,
    isLoading: commitsLoading,
    mutate: mutateCommits,
  } = useSWR(
    projectId ? `/git/repositories/${projectId}/history` : null,
    commitsFetcher
  );

  const {
    data: pullRequests,
    error: prsError,
    isLoading: prsLoading,
    mutate: mutatePRs,
  } = useSWR(
    projectId ? `/git/repositories/${projectId}/pull-requests` : null,
    prsFetcher
  );

  const createBranch = async (input: CreateBranchInput) => {
    const result = await apiClient.post<GitBranch>(
      `/git/repositories/${projectId}/branches`,
      input
    );
    await mutateBranches();
    return result;
  };

  const refresh = async () => {
    await Promise.all([mutateBranches(), mutateCommits(), mutatePRs()]);
  };

  return {
    repository: repo ?? null,
    branches: branches ?? [],
    commits: commits ?? [],
    pullRequests: pullRequests ?? [],
    isLoading: repoLoading || branchesLoading || commitsLoading || prsLoading,
    isError: !!repoError || !!branchesError || !!commitsError || !!prsError,
    error: repoError || branchesError || commitsError || prsError,
    createBranch,
    refresh,
  };
}

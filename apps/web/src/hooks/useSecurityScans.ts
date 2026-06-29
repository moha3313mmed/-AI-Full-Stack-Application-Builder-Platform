'use client';

import useSWR from 'swr';

import { apiClient } from '@/lib/api';

export type SecurityScanType =
  | 'VULNERABILITY'
  | 'SECRET_DETECTION'
  | 'SQL_INJECTION'
  | 'XSS'
  | 'CSRF'
  | 'AUTH_REVIEW'
  | 'OWASP_FULL';

export type SecuritySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ScanStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface SecurityFinding {
  id: string;
  type: SecurityScanType;
  severity: SecuritySeverity;
  title: string;
  description: string;
  filePath: string;
  lineNumber: number;
  recommendation: string;
}

export interface SecurityScan {
  id: string;
  projectId: string;
  scanType: SecurityScanType;
  status: ScanStatus;
  score: number;
  findingsCount: number;
  findings: SecurityFinding[];
  startedAt: string;
  completedAt?: string;
}

export interface SecurityScoreData {
  overall: number;
  categories: Record<string, number>;
}

interface SecurityScansResponse {
  scans: SecurityScan[];
  score: SecurityScoreData;
}

const fetcher = async (url: string): Promise<SecurityScansResponse> => {
  return apiClient.get<SecurityScansResponse>(url);
};

export function useSecurityScans(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `/security/scans/${projectId}` : null,
    fetcher
  );

  const triggerScan = async (scanTypes: SecurityScanType[]) => {
    const settled = await Promise.allSettled(
      scanTypes.map((scanType) =>
        apiClient.post<SecurityScan>('/security/scan', { projectId, scanType })
      )
    );
    const results = settled
      .filter((r): r is PromiseFulfilledResult<SecurityScan> => r.status === 'fulfilled')
      .map((r) => r.value);
    await mutate();
    return results;
  };

  const getScore = async () => {
    return apiClient.get<SecurityScoreData>(
      `/security/score/${projectId}`
    );
  };

  return {
    scans: data?.scans ?? [],
    score: data?.score ?? { overall: 0, categories: {} },
    isLoading,
    isError: !!error,
    error,
    triggerScan,
    getScore,
    refresh: mutate,
  };
}

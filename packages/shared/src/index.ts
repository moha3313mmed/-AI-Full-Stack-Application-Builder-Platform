// @builder/shared - Shared types, constants, and utilities

import { randomUUID } from 'node:crypto';

// ============================================================================
// Constants
// ============================================================================

export const APP_NAME = 'AI Builder Platform';
export const APP_VERSION = '0.1.0';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================================================
// Enums
// ============================================================================

export enum ProjectStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  BUILDING = 'BUILDING',
  DEPLOYED = 'DEPLOYED',
  ARCHIVED = 'ARCHIVED',
}

export enum ProjectFramework {
  NEXTJS = 'NEXTJS',
  REACT = 'REACT',
  VUE = 'VUE',
  SVELTE = 'SVELTE',
  EXPRESS = 'EXPRESS',
  NESTJS = 'NESTJS',
}

export enum ProjectLanguage {
  TYPESCRIPT = 'TYPESCRIPT',
  JAVASCRIPT = 'JAVASCRIPT',
  PYTHON = 'PYTHON',
}

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum AgentRole {
  ORCHESTRATOR = 'ORCHESTRATOR',
  PLANNER = 'PLANNER',
  CODER = 'CODER',
  REVIEWER = 'REVIEWER',
  TESTER = 'TESTER',
  DEPLOYER = 'DEPLOYER',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// Types
// ============================================================================

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  framework: ProjectFramework;
  language: ProjectLanguage;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncResult<T, E = Error> = Promise<{ ok: true; data: T } | { ok: false; error: E }>;

// ============================================================================
// Utility Functions
// ============================================================================

export function generateId(): string {
  return randomUUID();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

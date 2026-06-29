// @builder/ui - Shared UI Component Library
//
// This package provides shared React components following the shadcn/ui pattern.
// Components are built with Radix UI primitives and styled with Tailwind CSS.

// ============================================================================
// Component Exports (to be added as components are created)
// ============================================================================

// Placeholder - components will be added in subsequent features
export const UI_VERSION = '0.1.0';

// ============================================================================
// Utility Types for Components
// ============================================================================

export interface ComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export type Variant = 'default' | 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
export type Size = 'sm' | 'md' | 'lg' | 'xl';

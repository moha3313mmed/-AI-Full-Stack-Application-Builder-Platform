'use client';

// Theme store using next-themes, this module is a thin wrapper
// that provides the type and default values for reference
// Actual theme persistence is handled by next-themes ThemeProvider

export type Theme = 'dark' | 'light' | 'system';

export const THEME_STORAGE_KEY = 'theme';
export const DEFAULT_THEME: Theme = 'system';

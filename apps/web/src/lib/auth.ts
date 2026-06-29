import { apiClient } from './api';

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
  apiClient.setToken(token);
}

export function setStoredRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function removeStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  apiClient.setToken(null);
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
  setStoredToken(response.tokens.accessToken);
  setStoredRefreshToken(response.tokens.refreshToken);
  return response;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', data);
  setStoredToken(response.tokens.accessToken);
  setStoredRefreshToken(response.tokens.refreshToken);
  return response;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await apiClient.post<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      { refreshToken },
    );
    setStoredToken(response.accessToken);
    setStoredRefreshToken(response.refreshToken);
    return response.accessToken;
  } catch {
    removeStoredToken();
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } finally {
    removeStoredToken();
  }
}

export async function getSession(): Promise<AuthResponse['user'] | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    apiClient.setToken(token);
    const user = await apiClient.get<AuthResponse['user']>('/auth/me');
    return user;
  } catch {
    removeStoredToken();
    return null;
  }
}

export function initAuth(): void {
  const token = getStoredToken();
  if (token) {
    apiClient.setToken(token);
  }
}

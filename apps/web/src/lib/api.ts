const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = this.buildUrl(path, params);

    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        ...this.getHeaders(),
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: response.statusText,
      }));
      throw new ApiError(response.status, error.message || 'Request failed', error);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>(path, { method: 'GET', params });
  }

  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;

// Typed API helpers for file and codegen endpoints

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

export interface FileData {
  path: string;
  content: string;
  language: string;
}

export interface CodegenRequest {
  description: string;
  framework?: string;
  targetFiles?: string[];
  context?: Record<string, unknown>;
}

export interface CodegenResult {
  files: { path: string; content: string }[];
  summary: string;
}

export const filesApi = {
  getTree: (projectId: string) =>
    apiClient.get<FileTreeNode[]>(`/projects/${projectId}/files/tree`),

  getFile: (projectId: string, path: string) =>
    apiClient.get<FileData>(`/projects/${projectId}/files/read`, { path }),

  createFile: (projectId: string, data: { path: string; content?: string; type?: string }) =>
    apiClient.post<FileData>(`/projects/${projectId}/files`, data),

  updateFile: (projectId: string, path: string, content: string) =>
    apiClient.request<FileData>(`/projects/${projectId}/files`, {
      method: 'PUT',
      params: { path },
      body: JSON.stringify({ content }),
    }),

  deleteFile: (projectId: string, path: string) =>
    apiClient.request(`/projects/${projectId}/files`, {
      method: 'DELETE',
      params: { path },
    }),

  scaffold: (projectId: string, data: { framework: string; options?: Record<string, unknown> }) =>
    apiClient.post(`/projects/${projectId}/files/scaffold`, data),
};

export const codegenApi = {
  generate: (projectId: string, data: CodegenRequest) =>
    apiClient.post<CodegenResult>(`/projects/${projectId}/codegen/generate`, data),

  modify: (projectId: string, data: { description: string; filePath: string; instruction: string }) =>
    apiClient.post<CodegenResult>(`/projects/${projectId}/codegen/modify`, data),
};

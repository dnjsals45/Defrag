import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem('accessToken', data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  signup: (data: { email: string; password: string; nickname: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  verifyEmail: (token: string) =>
    api.get(`/auth/verify-email?token=${token}`),
  resendVerification: (email: string) =>
    api.post('/auth/resend-verification', { email }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  verifyResetToken: (token: string) =>
    api.get('/auth/verify-reset-token', { params: { token } }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
};

// Workspace API
export const workspaceApi = {
  list: () => api.get('/workspaces'),
  get: (id: string) => api.get(`/workspaces/${id}`),
  create: (data: { name: string; type: 'personal' | 'team' }) =>
    api.post('/workspaces', data),
  update: (id: string, data: { name: string }) =>
    api.patch(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete(`/workspaces/${id}`),
};

// Member API
export const memberApi = {
  list: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/members`),
  invite: (workspaceId: string, data: { email: string; role?: string }) =>
    api.post(`/workspaces/${workspaceId}/members/invite`, data),
  updateRole: (workspaceId: string, userId: string, data: { role: string }) =>
    api.patch(`/workspaces/${workspaceId}/members/${userId}`, data),
  remove: (workspaceId: string, userId: string) =>
    api.delete(`/workspaces/${workspaceId}/members/${userId}`),
};

// Connection API (Personal OAuth)
export const connectionApi = {
  list: () => api.get('/connections'),
  disconnect: (provider: string) => api.delete(`/connections/${provider}`),
};

// Integration API (Workspace OAuth)
export const integrationApi = {
  list: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/integrations`),
  updateConfig: (workspaceId: string, provider: string, config: object) =>
    api.patch(`/workspaces/${workspaceId}/integrations/${provider}`, { config }),
  disconnect: (workspaceId: string, provider: string) =>
    api.delete(`/workspaces/${workspaceId}/integrations/${provider}`),
};

// Items API
export const itemApi = {
  list: (workspaceId: string, params?: { source?: string; q?: string; page?: number; limit?: number }) =>
    api.get(`/workspaces/${workspaceId}/items`, { params }),
  get: (workspaceId: string, itemId: string) =>
    api.get(`/workspaces/${workspaceId}/items/${itemId}`),
  create: (workspaceId: string, data: { url: string }) =>
    api.post(`/workspaces/${workspaceId}/items`, data),
  delete: (workspaceId: string, itemId: string) =>
    api.delete(`/workspaces/${workspaceId}/items/${itemId}`),
  sync: (workspaceId: string, options?: { providers?: string[]; syncType?: 'full' | 'incremental' }) =>
    api.post(`/workspaces/${workspaceId}/items/sync`, options),
  syncStatus: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/items/sync/status`),
};

// Search API
export const searchApi = {
  search: (workspaceId: string, data: { query: string; sources?: string[]; limit?: number }) =>
    api.post(`/workspaces/${workspaceId}/search`, data),
  ask: (workspaceId: string, data: { question: string; includeContext?: boolean }) =>
    api.post(`/workspaces/${workspaceId}/ask`, data),
};

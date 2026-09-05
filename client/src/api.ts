import type { AppState, Person } from './types';
import { clearToken, getToken } from './auth';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function url(path: string) {
  return `${API_BASE}${path}`;
}

async function request<T>(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  if (options?.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url(path), { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && options?.auth !== false) {
    clearToken();
  }

  if (!res.ok) {
    throw new ApiError(data.error || 'Có lỗi xảy ra.', res.status);
  }
  return data as T;
}

export function login(username: string, password: string) {
  return request<{ token: string; username: string; role: string }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      auth: false,
    }
  );
}

export function fetchMe() {
  return request<{ username: string; role: string }>('/api/auth/me');
}

export function fetchState(tableNumber?: number) {
  if (tableNumber != null) {
    return request<AppState>(`/api/state/${tableNumber}`, { auth: false });
  }
  return request<AppState>('/api/state', { auth: false });
}

export function checkIn(msv: string) {
  return request<{ person: Person; state: AppState }>('/api/checkin', {
    method: 'POST',
    body: JSON.stringify({ msv }),
  });
}

export function callNext(tableNumber: number) {
  return request<{ person: Person; state: AppState }>(
    `/api/tables/${tableNumber}/next`,
    { method: 'POST', auth: false }
  );
}

export function completeInterview(tableNumber: number) {
  return request<{ person: Person; state: AppState }>(
    `/api/tables/${tableNumber}/complete`,
    { method: 'POST', auth: false }
  );
}

export function cancelPerson(id: string) {
  return request<{ person: Person; state: AppState }>(`/api/people/${id}`, {
    method: 'DELETE',
  });
}

export function resetAll() {
  return request<AppState>('/api/reset', { method: 'POST' });
}

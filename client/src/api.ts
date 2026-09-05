import type { AppState, Person } from './types';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

function url(path: string) {
  return `${API_BASE}${path}`;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url(path), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Có lỗi xảy ra.');
  }
  return data as T;
}

export function fetchState(tableNumber?: number) {
  if (tableNumber != null) {
    return request<AppState>(`/api/state/${tableNumber}`);
  }
  return request<AppState>('/api/state');
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
    { method: 'POST' }
  );
}

export function completeInterview(tableNumber: number) {
  return request<{ person: Person; state: AppState }>(
    `/api/tables/${tableNumber}/complete`,
    { method: 'POST' }
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

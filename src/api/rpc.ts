import { ApiError } from '@/types/domain';

const TOKEN_KEY = 'pxu.session.token';
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

interface RpcEnvelope<T> {
  data?: T;
  token?: string;
  error?: { code?: string; message?: string; details?: Record<string, unknown>; status?: number };
}

export function getSessionToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function clearSessionToken(): void {
  setSessionToken(null);
}

function unavailableError(status: number): ApiError {
  if (status === 404) {
    return new ApiError(
      'API_NOT_FOUND',
      'Không tìm thấy API máy chủ. Kiểm tra cấu hình proxy /api hoặc VITE_API_URL.',
      {},
      404,
    );
  }
  return new ApiError(
    'API_UNAVAILABLE',
    'Không kết nối được API máy chủ. Chạy "npm run dev" (hoặc "npm run api") và kiểm tra MySQL trong XAMPP đang bật.',
    {},
    status,
  );
}

export async function rpc<T>(fn: string, args: unknown[]): Promise<T> {
  const token = getSessionToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/rpc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ fn, args }),
    });
  } catch {
    throw new ApiError('API_UNAVAILABLE', 'Mất kết nối tới API. Kiểm tra API đang chạy và MySQL trong XAMPP đang bật.', {}, 0);
  }

  const text = await response.text();
  let payload: RpcEnvelope<T> | null = null;
  if (text) {
    try {
      payload = JSON.parse(text) as RpcEnvelope<T>;
    } catch {
      payload = null;
    }
  }

  if (!payload) throw unavailableError(response.status);
  if (!response.ok || payload.error) {
    if (response.status === 401) clearSessionToken();
    throw new ApiError(
      payload.error?.code ?? 'INTERNAL',
      payload.error?.message ?? 'Máy chủ trả về dữ liệu không hợp lệ.',
      payload.error?.details,
      payload.error?.status ?? response.status,
    );
  }
  if (payload.token) setSessionToken(payload.token);
  return payload.data as T;
}

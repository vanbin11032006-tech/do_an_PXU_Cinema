import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '@/types/domain';
import { setActor } from '@/mock/core';
import * as authApi from '@/mock/api/auth';
import * as bookingApi from '@/mock/api/booking';
import * as catalogApi from '@/mock/api/catalog';
import * as adminApi from '@/mock/api/admin';
import * as accountApi from '@/mock/api/account';
import { createSession, deleteSession, findSession } from './db';

interface RpcRequest {
  fn: string;
  args: unknown[];
}

const registry: Record<string, unknown> = {
  ...authApi,
  ...bookingApi,
  ...catalogApi,
  ...adminApi,
  ...accountApi,
};

let queue: Promise<unknown> = Promise.resolve();

function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function bearerToken(request: Request): string | null {
  const header = request.header('authorization');
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value ? value : null;
}

export async function handleRpc(request: Request, response: Response, next: NextFunction): Promise<void> {
  const body = request.body as RpcRequest | undefined;
  if (!body || typeof body.fn !== 'string' || !Array.isArray(body.args)) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Yêu cầu RPC không hợp lệ.', status: 400 } });
    return;
  }

  const token = bearerToken(request);
  try {
    const payload = await runSerialized(async () => {
      const session = token ? await findSession(token) : null;
      setActor(session?.userId ?? null);

      if (!Object.prototype.hasOwnProperty.call(registry, body.fn)) {
        throw new ApiError('NOT_FOUND', `Không tìm thấy API "${body.fn}".`, {}, 404);
      }
      const handler = registry[body.fn];
      if (typeof handler !== 'function') {
        throw new ApiError('VALIDATION_ERROR', `"${body.fn}" không phải là API.`, {}, 400);
      }

      if (body.fn === 'logout') {
        if (token) await deleteSession(token);
        setActor(null);
        return { data: null };
      }

      const data = await (handler as (...args: unknown[]) => Promise<unknown>)(...body.args);
      if ((body.fn === 'login' || body.fn === 'register') && data && typeof data === 'object' && 'id' in data) {
        const newToken = await createSession(String((data as { id: string }).id));
        return { data, token: newToken };
      }
      return { data };
    });
    response.json(payload);
  } catch (error) {
    if (error instanceof ApiError) {
      response.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details, status: error.status },
      });
      return;
    }
    next(error);
  }
}

export function rpcErrorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof SyntaxError) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'JSON không hợp lệ.', status: 400 } });
    return;
  }
  console.error('[PXU API] Lỗi không xử lý:', error);
  response.status(500).json({ error: { code: 'INTERNAL', message: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại.', status: 500 } });
}

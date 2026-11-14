import express from 'express';
import cors from 'cors';
import { checkDatabase, initDatabase } from './db';
import { handleRpc, rpcErrorHandler } from './rpc';

try {
  process.loadEnvFile('.env');
} catch {
  /* .env là tùy chọn; dùng biến môi trường hoặc mặc định XAMPP */
}

const PORT = Number(process.env.API_PORT ?? 5000);
const HOST = process.env.API_HOST ?? '127.0.0.1';

async function main(): Promise<void> {
  await initDatabase();

  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', async (_request, response, next) => {
    try {
      const result = await checkDatabase();
      response.json({ status: 'ok', ...result });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/rpc', handleRpc);
  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy endpoint.', status: 404 } });
  });
  app.use(rpcErrorHandler);

  app.listen(PORT, HOST, () => {
    console.log(`[PXU API] http://${HOST}:${PORT}/api  ·  XAMPP MySQL`);
  });
}

main().catch((error) => {
  console.error('[PXU API] Không khởi động được:', error);
  process.exitCode = 1;
});

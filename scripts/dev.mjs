import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

try {
  process.loadEnvFile(path.join(root, '.env'));
} catch {
  /* .env là tùy chọn */
}

const apiPort = process.env.API_PORT ?? '5000';
const apiHost = process.env.API_HOST ?? '127.0.0.1';
const useSupabase = Boolean(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY);

let stopping = false;
const children = [];

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      /* process đã dừng */
    }
    return;
  }
  child.kill('SIGTERM');
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) killTree(child);
  setTimeout(() => process.exit(code), 150);
}

async function apiAlreadyRunning() {
  try {
    const response = await fetch(`http://${apiHost}:${apiPort}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function startWeb() {
  const web = spawn(process.execPath, [viteCli, ...process.argv.slice(2)], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  children.push(web);
  web.on('exit', (code) => {
    if (!stopping) stopAll(code ?? 0);
  });
}

if (useSupabase) {
  console.log('[dev] Chế độ Supabase: bỏ qua API Express/MySQL, chạy web tại http://localhost:5173');
  await startWeb();
} else {
  if (await apiAlreadyRunning()) {
    console.error(`[dev] Cổng ${apiHost}:${apiPort} đang được một API khác sử dụng. Dừng tiến trình đó rồi chạy lại.`);
    process.exit(1);
  }

  const api = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  children.push(api);

  async function waitForApi() {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (api.exitCode !== null) return false;
      try {
        const response = await fetch(`http://${apiHost}:${apiPort}/api/health`);
        if (response.ok) return true;
      } catch {
        /* API chưa sẵn sàng */
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    return false;
  }

  api.on('exit', (code) => {
    if (stopping) return;
    console.error('[dev] API đã dừng. Kiểm tra MySQL trong XAMPP và cổng API.');
    stopAll(code ?? 1);
  });

  const ready = await waitForApi();
  if (!ready) {
    stopAll(1);
  } else {
    console.log(`[dev] API sẵn sàng tại http://${apiHost}:${apiPort} · đang khởi động web…`);
    await startWeb();
  }
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

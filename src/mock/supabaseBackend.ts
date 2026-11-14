import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/domain';
import type { DbBackend } from './db';

/**
 * Lưu trữ Supabase cho chế độ chạy hoàn toàn trên trình duyệt.
 *
 * Mỗi "collection" của mock database là một dòng trong bảng `pxu_state`
 * (id = tên collection, data = JSONB). Nhờ vậy mỗi lần ghi chỉ upsert
 * những collection thay đổi thay vì đẩy cả database ~1.8MB lên mạng.
 *
 * Xem `supabase/schema.sql` để tạo bảng + policy.
 */
const TABLE = 'pxu_state';

const COLLECTION_KEYS = [
  'users',
  'movies',
  'cinemas',
  'rooms',
  'seats',
  'showtimes',
  'bookings',
  'payments',
  'tickets',
  'combos',
  'vouchers',
  'voucherUsages',
  'refunds',
  'exceptions',
  'auditLogs',
  'shifts',
  'priceRules',
  'notifications',
  'banners',
  'news',
  'reviews',
  'tiers',
  'pointTransactions',
  'checkinLogs',
  'favorites',
  'pages',
] as const;

interface RemoteRow {
  id: string;
  data: unknown;
}

function snapshot(db: Database): Map<string, string> {
  const current = new Map<string, string>();
  for (const key of COLLECTION_KEYS) current.set(key, JSON.stringify(db[key]));
  current.set('settings', JSON.stringify(db.settings));
  current.set('meta', JSON.stringify([db.version, db.seededAt]));
  return current;
}

export function createSupabaseBackend(url: string, anonKey: string): DbBackend {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let lastSaved: Map<string, string> | null = null;

  async function load(): Promise<Database | null> {
    const { data, error } = await client.from(TABLE).select('id, data');
    if (error) throw new Error(`Supabase (${TABLE}): ${error.message}`);
    if (!data || data.length === 0) {
      lastSaved = null;
      return null;
    }

    const rows = new Map<string, unknown>((data as RemoteRow[]).map((row) => [row.id, row.data]));
    const meta = rows.get('meta') as [number, string] | undefined;
    const settings = rows.get('settings');
    if (!meta || !settings) {
      lastSaved = null;
      return null;
    }

    const state: Record<string, unknown> = { version: meta[0], seededAt: meta[1], settings };
    for (const key of COLLECTION_KEYS) {
      const value = rows.get(key);
      state[key] = Array.isArray(value) ? value : [];
    }

    const db = state as unknown as Database;
    lastSaved = snapshot(db);
    return db;
  }

  async function save(db: Database): Promise<void> {
    const current = snapshot(db);
    const changed = [...current.keys()].filter((key) => current.get(key) !== lastSaved?.get(key));
    if (changed.length === 0) return;

    const rows = changed.map((id) => ({
      id,
      data: JSON.parse(current.get(id) as string),
      updated_at: new Date().toISOString(),
    }));
    const { error } = await client.from(TABLE).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`Supabase (${TABLE}): ${error.message}`);
    lastSaved = current;
  }

  async function clear(): Promise<void> {
    const { error } = await client.from(TABLE).delete().neq('id', '');
    if (error) throw new Error(`Supabase (${TABLE}): ${error.message}`);
    lastSaved = null;
  }

  return { load, save, clear };
}

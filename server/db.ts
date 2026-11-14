import { randomBytes } from 'node:crypto';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import type { Database } from '@/types/domain';
import { ensureDb, ensureHueCinema, ensureTicketPricing, invalidateDbCache, setDbBackend, writeDb } from '@/mock/db';
import { MOVIE_MEDIA } from '@/mock/movieMedia';

type AnyRow = Record<string, any>;
type CollectionKey = Exclude<keyof Database, 'version' | 'seededAt' | 'settings'>;

interface ColumnSpec {
  name: string;
  type: string;
  pick: (row: AnyRow) => unknown;
}

interface CollectionSpec {
  key: CollectionKey;
  table: string;
  id: (row: AnyRow) => string;
  columns: ColumnSpec[];
  indexes?: string[];
}

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'pxu_cinema',
};

const COLLECTIONS: CollectionSpec[] = [
  {
    key: 'users', table: 'users', id: (r) => String(r.id),
    columns: [
      { name: 'email', type: 'VARCHAR(190)', pick: (r) => r.email },
      { name: 'role', type: 'VARCHAR(32)', pick: (r) => r.role },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'points', type: 'INT', pick: (r) => r.points },
    ],
    indexes: ['UNIQUE KEY uq_users_email (email)', 'INDEX idx_users_role (role)'],
  },
  {
    key: 'movies', table: 'movies', id: (r) => String(r.id),
    columns: [
      { name: 'title', type: 'VARCHAR(255)', pick: (r) => r.title },
      { name: 'slug', type: 'VARCHAR(190)', pick: (r) => r.slug },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'release_date', type: 'VARCHAR(32)', pick: (r) => r.releaseDate },
    ],
    indexes: ['UNIQUE KEY uq_movies_slug (slug)', 'INDEX idx_movies_status (status)'],
  },
  {
    key: 'cinemas', table: 'cinemas', id: (r) => String(r.id),
    columns: [
      { name: 'name', type: 'VARCHAR(190)', pick: (r) => r.name },
      { name: 'city', type: 'VARCHAR(100)', pick: (r) => r.city },
    ],
  },
  {
    key: 'rooms', table: 'rooms', id: (r) => String(r.id),
    columns: [
      { name: 'cinema_id', type: 'INT', pick: (r) => r.cinemaId },
      { name: 'name', type: 'VARCHAR(100)', pick: (r) => r.name },
      { name: 'room_type', type: 'VARCHAR(32)', pick: (r) => r.type },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
    ],
    indexes: ['INDEX idx_rooms_cinema (cinema_id)'],
  },
  {
    key: 'seats', table: 'seats', id: (r) => String(r.id),
    columns: [
      { name: 'room_id', type: 'INT', pick: (r) => r.roomId },
      { name: 'code', type: 'VARCHAR(32)', pick: (r) => r.code },
      { name: 'row_label', type: 'VARCHAR(8)', pick: (r) => r.row },
      { name: 'col_index', type: 'INT', pick: (r) => r.col },
      { name: 'seat_type', type: 'VARCHAR(32)', pick: (r) => r.type },
    ],
    indexes: ['INDEX idx_seats_room (room_id)'],
  },
  {
    key: 'showtimes', table: 'showtimes', id: (r) => String(r.id),
    columns: [
      { name: 'movie_id', type: 'INT', pick: (r) => r.movieId },
      { name: 'cinema_id', type: 'INT', pick: (r) => r.cinemaId },
      { name: 'room_id', type: 'INT', pick: (r) => r.roomId },
      { name: 'show_date', type: 'VARCHAR(32)', pick: (r) => r.showDate },
      { name: 'start_time', type: 'VARCHAR(16)', pick: (r) => r.startTime },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
    ],
    indexes: ['INDEX idx_showtimes_room_date (room_id, show_date)', 'INDEX idx_showtimes_movie (movie_id)'],
  },
  {
    key: 'bookings', table: 'bookings', id: (r) => String(r.id),
    columns: [
      { name: 'code', type: 'VARCHAR(40)', pick: (r) => r.code },
      { name: 'user_id', type: 'VARCHAR(64)', pick: (r) => r.userId },
      { name: 'showtime_id', type: 'INT', pick: (r) => r.showtimeId },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'channel', type: 'VARCHAR(16)', pick: (r) => r.channel },
      { name: 'final_amount', type: 'INT', pick: (r) => r.finalAmount },
      { name: 'created_at', type: 'VARCHAR(40)', pick: (r) => r.createdAt },
    ],
    indexes: ['UNIQUE KEY uq_bookings_code (code)', 'INDEX idx_bookings_user (user_id)', 'INDEX idx_bookings_status (status)'],
  },
  {
    key: 'payments', table: 'payments', id: (r) => String(r.id),
    columns: [
      { name: 'booking_id', type: 'INT', pick: (r) => r.bookingId },
      { name: 'provider', type: 'VARCHAR(32)', pick: (r) => r.provider },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'amount', type: 'INT', pick: (r) => r.amount },
      { name: 'created_at', type: 'VARCHAR(40)', pick: (r) => r.createdAt },
    ],
    indexes: ['INDEX idx_payments_booking (booking_id)', 'INDEX idx_payments_status (status)'],
  },
  {
    key: 'tickets', table: 'tickets', id: (r) => String(r.id),
    columns: [
      { name: 'code', type: 'VARCHAR(80)', pick: (r) => r.code },
      { name: 'booking_id', type: 'INT', pick: (r) => r.bookingId },
      { name: 'seat_id', type: 'INT', pick: (r) => r.seatId },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
    ],
    indexes: ['UNIQUE KEY uq_tickets_code (code)', 'INDEX idx_tickets_booking (booking_id)'],
  },
  {
    key: 'combos', table: 'combos', id: (r) => String(r.id),
    columns: [
      { name: 'name', type: 'VARCHAR(190)', pick: (r) => r.name },
      { name: 'category', type: 'VARCHAR(32)', pick: (r) => r.category },
      { name: 'price', type: 'INT', pick: (r) => r.price },
      { name: 'stock', type: 'INT', pick: (r) => r.stock },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
    ],
  },
  {
    key: 'vouchers', table: 'vouchers', id: (r) => String(r.id),
    columns: [
      { name: 'code', type: 'VARCHAR(64)', pick: (r) => r.code },
      { name: 'voucher_type', type: 'VARCHAR(32)', pick: (r) => r.type },
      { name: 'value', type: 'INT', pick: (r) => r.value },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'used_count', type: 'INT', pick: (r) => r.usedCount },
    ],
    indexes: ['UNIQUE KEY uq_vouchers_code (code)'],
  },
  {
    key: 'voucherUsages', table: 'voucher_usages', id: (r) => String(r.id),
    columns: [
      { name: 'voucher_code', type: 'VARCHAR(64)', pick: (r) => r.voucherCode },
      { name: 'booking_id', type: 'INT', pick: (r) => r.bookingId },
      { name: 'user_id', type: 'VARCHAR(64)', pick: (r) => r.userId },
      { name: 'used_at', type: 'VARCHAR(40)', pick: (r) => r.at },
    ],
    indexes: ['INDEX idx_voucher_usages_code (voucher_code)'],
  },
  {
    key: 'refunds', table: 'refunds', id: (r) => String(r.id),
    columns: [
      { name: 'code', type: 'VARCHAR(40)', pick: (r) => r.code },
      { name: 'booking_id', type: 'INT', pick: (r) => r.bookingId },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'amount', type: 'INT', pick: (r) => r.amount },
    ],
    indexes: ['INDEX idx_refunds_booking (booking_id)', 'INDEX idx_refunds_status (status)'],
  },
  {
    key: 'exceptions', table: 'payment_exceptions', id: (r) => String(r.id),
    columns: [
      { name: 'amount', type: 'INT', pick: (r) => r.amount },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'bank_ref', type: 'VARCHAR(80)', pick: (r) => r.bankRef },
      { name: 'received_at', type: 'VARCHAR(40)', pick: (r) => r.receivedAt },
    ],
  },
  {
    key: 'auditLogs', table: 'audit_logs', id: (r) => String(r.id),
    columns: [
      { name: 'actor_id', type: 'VARCHAR(64)', pick: (r) => r.actorId },
      { name: 'action', type: 'VARCHAR(100)', pick: (r) => r.action },
      { name: 'entity', type: 'VARCHAR(64)', pick: (r) => r.entity },
      { name: 'logged_at', type: 'VARCHAR(40)', pick: (r) => r.at },
    ],
    indexes: ['INDEX idx_audit_actor (actor_id)', 'INDEX idx_audit_action (action)'],
  },
  {
    key: 'shifts', table: 'shifts', id: (r) => String(r.id),
    columns: [
      { name: 'staff_id', type: 'VARCHAR(64)', pick: (r) => r.staffId },
      { name: 'cinema_id', type: 'INT', pick: (r) => r.cinemaId },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'opened_at', type: 'VARCHAR(40)', pick: (r) => r.openedAt },
    ],
  },
  {
    key: 'priceRules', table: 'price_rules', id: (r) => String(r.id),
    columns: [
      { name: 'day_type', type: 'VARCHAR(32)', pick: (r) => r.dayType },
      { name: 'slot', type: 'VARCHAR(32)', pick: (r) => r.slot },
      { name: 'room_type', type: 'VARCHAR(32)', pick: (r) => r.roomType },
      { name: 'price', type: 'INT', pick: (r) => r.price },
      { name: 'active', type: 'TINYINT', pick: (r) => (r.active ? 1 : 0) },
    ],
  },
  {
    key: 'notifications', table: 'notifications', id: (r) => String(r.id),
    columns: [
      { name: 'user_id', type: 'VARCHAR(64)', pick: (r) => r.userId },
      { name: 'notif_type', type: 'VARCHAR(32)', pick: (r) => r.type },
      { name: 'is_read', type: 'TINYINT', pick: (r) => (r.read ? 1 : 0) },
      { name: 'created_at', type: 'VARCHAR(40)', pick: (r) => r.createdAt },
    ],
    indexes: ['INDEX idx_notifications_user (user_id)'],
  },
  {
    key: 'banners', table: 'banners', id: (r) => String(r.id),
    columns: [
      { name: 'title', type: 'VARCHAR(190)', pick: (r) => r.title },
      { name: 'active', type: 'TINYINT', pick: (r) => (r.active ? 1 : 0) },
      { name: 'order_index', type: 'INT', pick: (r) => r.order },
    ],
  },
  {
    key: 'news', table: 'news', id: (r) => String(r.id),
    columns: [
      { name: 'title', type: 'VARCHAR(255)', pick: (r) => r.title },
      { name: 'slug', type: 'VARCHAR(190)', pick: (r) => r.slug },
      { name: 'status', type: 'VARCHAR(32)', pick: (r) => r.status },
      { name: 'published_at', type: 'VARCHAR(40)', pick: (r) => r.publishedAt },
    ],
    indexes: ['UNIQUE KEY uq_news_slug (slug)'],
  },
  {
    key: 'reviews', table: 'reviews', id: (r) => String(r.id),
    columns: [
      { name: 'movie_id', type: 'INT', pick: (r) => r.movieId },
      { name: 'user_id', type: 'VARCHAR(64)', pick: (r) => r.userId },
      { name: 'rating', type: 'INT', pick: (r) => r.rating },
      { name: 'visible', type: 'TINYINT', pick: (r) => (r.visible ? 1 : 0) },
    ],
    indexes: ['INDEX idx_reviews_movie (movie_id)'],
  },
  {
    key: 'tiers', table: 'membership_tiers', id: (r) => String(r.key),
    columns: [
      { name: 'label', type: 'VARCHAR(100)', pick: (r) => r.label },
      { name: 'min_spend', type: 'INT', pick: (r) => r.minSpend },
    ],
  },
  {
    key: 'pointTransactions', table: 'point_transactions', id: (r) => String(r.id),
    columns: [
      { name: 'user_id', type: 'VARCHAR(64)', pick: (r) => r.userId },
      { name: 'txn_type', type: 'VARCHAR(32)', pick: (r) => r.type },
      { name: 'points', type: 'INT', pick: (r) => r.points },
      { name: 'happened_at', type: 'VARCHAR(40)', pick: (r) => r.at },
    ],
    indexes: ['INDEX idx_points_user (user_id)'],
  },
  {
    key: 'checkinLogs', table: 'checkin_logs', id: (r) => String(r.id),
    columns: [
      { name: 'ticket_code', type: 'VARCHAR(80)', pick: (r) => r.ticketCode },
      { name: 'result', type: 'VARCHAR(32)', pick: (r) => r.result },
      { name: 'staff_id', type: 'VARCHAR(64)', pick: (r) => r.staffId },
      { name: 'showtime_id', type: 'INT', pick: (r) => r.showtimeId },
      { name: 'checked_at', type: 'VARCHAR(40)', pick: (r) => r.at },
    ],
  },
  {
    key: 'favorites', table: 'favorites', id: (r) => `${r.userId}:${r.movieId}`,
    columns: [
      { name: 'user_id', type: 'VARCHAR(64)', pick: (r) => r.userId },
      { name: 'movie_id', type: 'INT', pick: (r) => r.movieId },
    ],
    indexes: ['INDEX idx_favorites_user (user_id)'],
  },
  {
    key: 'pages', table: 'static_pages', id: (r) => String(r.slug),
    columns: [
      { name: 'slug', type: 'VARCHAR(190)', pick: (r) => r.slug },
      { name: 'title', type: 'VARCHAR(190)', pick: (r) => r.title },
    ],
    indexes: ['UNIQUE KEY uq_pages_slug (slug)'],
  },
];

let pool: Pool | null = null;
let lastSaved: Map<string, string> | null = null;

function requirePool(): Pool {
  if (!pool) throw new Error('Database chưa được khởi tạo.');
  return pool;
}

function parseJson<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

function snapshot(db: Database): Map<string, string> {
  const current = new Map<string, string>();
  for (const spec of COLLECTIONS) current.set(spec.key, JSON.stringify(db[spec.key]));
  current.set('__settings', JSON.stringify(db.settings));
  current.set('__meta', JSON.stringify([db.version, db.seededAt]));
  return current;
}

function createTableSql(spec: CollectionSpec): string {
  const columns = [
    'row_key VARCHAR(200) NOT NULL PRIMARY KEY',
    'id VARCHAR(160) NOT NULL',
    ...spec.columns.map((column) => `\`${column.name}\` ${column.type} NULL`),
    'ord INT NOT NULL DEFAULT 0',
    'data JSON NOT NULL',
    'updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    ...(spec.indexes ?? []),
  ];
  return `CREATE TABLE IF NOT EXISTS \`${spec.table}\` (${columns.join(', ')}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
}

async function replaceCollection(connection: PoolConnection, spec: CollectionSpec, rows: AnyRow[]): Promise<void> {
  await connection.query(`DELETE FROM \`${spec.table}\``);
  if (!rows.length) return;
  const columns = ['row_key', 'id', 'ord', ...spec.columns.map((column) => column.name), 'data'];
  const columnSql = columns.map((column) => `\`${column}\``).join(', ');
  const placeholdersFor = (count: number) => Array.from({ length: count }, () => `(${columns.map(() => '?').join(', ')})`).join(', ');
  let start = 0;
  while (start < rows.length) {
    let end = start;
    let bytes = 0;
    while (end < rows.length && (end === start || bytes < 2_000_000) && end - start < 100) {
      bytes += Buffer.byteLength(JSON.stringify(rows[end]));
      end += 1;
    }
    const chunk = rows.slice(start, end);
    const values = chunk.flatMap((row, offset) => [
      `${spec.id(row)}#${start + offset}`,
      spec.id(row),
      start + offset,
      ...spec.columns.map((column) => column.pick(row) ?? null),
      JSON.stringify(row),
    ]);
    await connection.query(`INSERT INTO \`${spec.table}\` (${columnSql}) VALUES ${placeholdersFor(chunk.length)}`, values);
    start = end;
  }
}

async function loadState(): Promise<Database | null> {
  const db = requirePool();
  const [metaRows] = await db.query<RowDataPacket[]>('SELECT version, seeded_at FROM app_meta WHERE id = 1');
  const [settingRows] = await db.query<RowDataPacket[]>('SELECT data FROM app_settings WHERE id = 1');
  if (!metaRows.length || !settingRows.length) {
    lastSaved = null;
    return null;
  }
  const state: Record<string, unknown> = {
    version: metaRows[0].version,
    seededAt: metaRows[0].seeded_at,
    settings: parseJson(settingRows[0].data),
  };
  for (const spec of COLLECTIONS) {
    const [rows] = await db.query<RowDataPacket[]>(`SELECT data FROM \`${spec.table}\` ORDER BY ord ASC`);
    state[spec.key] = rows.map((row) => parseJson(row.data));
  }
  const database = state as unknown as Database;
  lastSaved = snapshot(database);
  return database;
}

async function saveState(db: Database): Promise<void> {
  const current = snapshot(db);
  const changed = COLLECTIONS.filter((spec) => current.get(spec.key) !== lastSaved?.get(spec.key));
  const settingsChanged = current.get('__settings') !== lastSaved?.get('__settings');
  const metaChanged = current.get('__meta') !== lastSaved?.get('__meta');
  if (!changed.length && !settingsChanged && !metaChanged) return;

  const connection = await requirePool().getConnection();
  try {
    await connection.beginTransaction();
    for (const spec of changed) {
      await replaceCollection(connection, spec, db[spec.key] as AnyRow[]);
    }
    if (settingsChanged) {
      await connection.query('REPLACE INTO app_settings (id, data) VALUES (1, ?)', [JSON.stringify(db.settings)]);
    }
    if (metaChanged) {
      await connection.query('REPLACE INTO app_meta (id, version, seeded_at) VALUES (1, ?, ?)', [db.version, db.seededAt]);
    }
    await connection.commit();
    lastSaved = current;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function clearState(): Promise<void> {
  const connection = await requirePool().getConnection();
  try {
    await connection.beginTransaction();
    for (const spec of COLLECTIONS) await connection.query(`DELETE FROM \`${spec.table}\``);
    await connection.query('DELETE FROM app_settings');
    await connection.query('DELETE FROM app_meta');
    await connection.query('DELETE FROM sessions');
    await connection.commit();
    lastSaved = null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function initDatabase(): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(CONFIG.database)) {
    throw new Error(`DB_NAME không hợp lệ: ${CONFIG.database}`);
  }
  const bootstrap = await mysql.createConnection({
    host: CONFIG.host,
    port: CONFIG.port,
    user: CONFIG.user,
    password: CONFIG.password,
  });
  try {
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await bootstrap.end();
  }

  pool = mysql.createPool({
    host: CONFIG.host,
    port: CONFIG.port,
    user: CONFIG.user,
    password: CONFIG.password,
    database: CONFIG.database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 5,
  });

  const db = requirePool();
  for (const spec of COLLECTIONS) await db.query(createTableSql(spec));
  await db.query(`CREATE TABLE IF NOT EXISTS app_settings (
    id TINYINT NOT NULL PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS app_meta (
    id TINYINT NOT NULL PRIMARY KEY,
    version INT NOT NULL,
    seeded_at VARCHAR(40) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await db.query(`CREATE TABLE IF NOT EXISTS sessions (
    token CHAR(64) NOT NULL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    created_at VARCHAR(40) NOT NULL,
    INDEX idx_sessions_user (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  setDbBackend({ load: loadState, save: saveState, clear: clearState });
  try {
    const database = await ensureDb();
    let migrated = 0;
    let hueAdded = false;
    let pricingUpdated = false;
    await writeDb((state) => {
      for (const movie of state.movies) {
        const media = MOVIE_MEDIA[movie.slug];
        if (!media) continue;
        if (movie.posterUrl === media.posterUrl && movie.backdropUrl === media.backdropUrl && movie.trailerId === media.trailerId) continue;
        Object.assign(movie, media);
        migrated += 1;
      }
      hueAdded = ensureHueCinema(state);
      pricingUpdated = ensureTicketPricing(state);
    });
    if (hueAdded) console.log('[PXU] Đã thêm cụm rạp PXU Cinema Huế.');
    if (pricingUpdated) console.log('[PXU] Đã cập nhật giá vé: thường 50k · VIP 80k · đôi 110k.');
    if (migrated) console.log(`[PXU] Đã bổ sung ảnh/trailer cho ${migrated} phim.`);
    console.log(`[PXU] MySQL ${CONFIG.host}:${CONFIG.port}/${CONFIG.database} · ${database.users.length} users · ${database.showtimes.length} showtimes · ${database.bookings.length} bookings`);
  } catch (error) {
    invalidateDbCache();
    throw error;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await requirePool().query('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)', [token, userId, new Date().toISOString()]);
  return token;
}

export async function findSession(token: string): Promise<{ userId: string } | null> {
  const [rows] = await requirePool().query<RowDataPacket[]>('SELECT user_id FROM sessions WHERE token = ?', [token]);
  return rows.length ? { userId: rows[0].user_id as string } : null;
}

export async function deleteSession(token: string): Promise<void> {
  await requirePool().query('DELETE FROM sessions WHERE token = ?', [token]);
}

export async function checkDatabase(): Promise<{ ok: boolean; database: string; version?: string }> {
  const [rows] = await requirePool().query<RowDataPacket[]>('SELECT VERSION() AS version');
  return { ok: true, database: CONFIG.database, version: rows[0]?.version as string | undefined };
}

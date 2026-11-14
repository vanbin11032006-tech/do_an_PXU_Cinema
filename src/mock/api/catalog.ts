import type {
  Banner, Cinema, Combo, Database, Movie, News, Paged, PriceRule, Room, Seat, SeatType, SeatView,
  Showtime, ShowtimeSeatMap, ShowtimeStatus,
} from '@/types/domain';
import { ApiError } from '@/types/domain';
import { addDaysISO, dateISO, cinemaNow, minutesToTime, timeToMinutes } from '@/lib/datetime';
import { basePriceFor, seatPrice, slotOf, ROOM_TYPE_SURCHARGE } from '../pricing';
import { NEWS_MEDIA } from '../newsMedia';
import { CINEMA_MEDIA } from '../cinemaMedia';
import {
  audit, canAccessCinema, getActor, getMaybeActor, issueTickets, mutateDb, nextId, requirePermission,
  scopeCinemaIds, startMsOf, withDb,
} from '../core';

export interface ShowtimePublic extends Showtime {
  movie: Movie;
  cinema: Cinema;
  room: Room;
  availableSeats: number;
  totalSeats: number;
  minPrice: number;
  saleState: 'selling' | 'closed' | 'past';
}

export interface MovieQuery {
  status?: Movie['status'] | 'all';
  genre?: string;
  age?: string;
  q?: string;
  sort?: 'newest' | 'rating' | 'title';
  page?: number;
  perPage?: number;
  includeDeleted?: boolean;
}

export interface SeatLayoutCell {
  row: string;
  col: number;
  x: number;
  y: number;
  span: number;
  type: SeatType;
  code: string;
}

export interface ShowtimeInput {
  movieId: number;
  roomId: number;
  showDate: string;
  startTime: string;
  format?: string;
  basePrice?: number;
}

export interface ShowtimeConflict {
  showtimeId: number;
  movieTitle: string;
  startTime: string;
  endTime: string;
}

export interface ShowtimeValidation {
  valid: boolean;
  endTime: string;
  conflicts: ShowtimeConflict[];
  warnings: string[];
}

export interface BulkPreviewRow extends ShowtimeInput {
  endTime: string;
  valid: boolean;
  conflicts: ShowtimeConflict[];
  reason?: string;
}

/* ------------------------------------------------------------------ */
/* Shared projections                                                  */
/* ------------------------------------------------------------------ */

export function sellableSeats(db: Database, roomId: number): Seat[] {
  return db.seats.filter(
    (s) => s.roomId === roomId && (s.type === 'standard' || s.type === 'vip' || s.type === 'couple'),
  );
}

export function activeSeatIds(db: Database, showtimeId: number, excludeBookingId?: number): Set<number> {
  const taken = new Set<number>();
  for (const booking of db.bookings) {
    if (booking.showtimeId !== showtimeId) continue;
    if (booking.id === excludeBookingId) continue;
    if (booking.status !== 'holding' && booking.status !== 'confirmed' && booking.status !== 'completed') continue;
    for (const seat of booking.seats) if (seat.active) taken.add(seat.seatId);
  }
  return taken;
}

export function toShowtimePublic(db: Database, showtime: Showtime, nowMs = Date.now()): ShowtimePublic {
  const movie = db.movies.find((m) => m.id === showtime.movieId)!;
  const room = db.rooms.find((r) => r.id === showtime.roomId)!;
  const cinema = db.cinemas.find((c) => c.id === showtime.cinemaId)!;
  const seats = sellableSeats(db, showtime.roomId);
  const taken = activeSeatIds(db, showtime.id);
  const blocked = showtime.blockedSeatIds.length;
  const totalSeats = seats.length;
  const availableSeats = Math.max(0, totalSeats - taken.size - blocked);
  const cutoff = startMsOf(showtime) - db.settings.onlineCloseBeforeMinutes * 60_000;
  const saleState: ShowtimePublic['saleState'] =
    showtime.status === 'cancelled' || showtime.status === 'finished' || startMsOf(showtime) < nowMs
      ? 'past'
      : cutoff < nowMs || showtime.status === 'closed'
        ? 'closed'
        : 'selling';
  return {
    ...showtime, movie, cinema, room, availableSeats, totalSeats,
    minPrice: seatPrice(showtime.basePrice, 'standard', db.settings),
    saleState,
  };
}

/* ------------------------------------------------------------------ */
/* Public catalog                                                      */
/* ------------------------------------------------------------------ */

export async function listCinemas(): Promise<Cinema[]> {
  return withDb((db) => db.cinemas.map(withCinemaMedia));
}

export async function getCinema(id: number): Promise<Cinema> {
  return withDb((db) => {
    const cinema = db.cinemas.find((c) => c.id === id);
    if (!cinema) throw new ApiError('NOT_FOUND', 'Không tìm thấy rạp.', {}, 404);
    return withCinemaMedia(cinema);
  });
}

export async function listMovies(params: MovieQuery = {}): Promise<Paged<Movie>> {
  const { status = 'all', genre, age, q, sort = 'newest', page = 1, perPage = 12, includeDeleted } = params;
  return withDb((db) => {
    let rows = db.movies.filter((m) => includeDeleted || !m.deletedAt);
    if (status !== 'all') rows = rows.filter((m) => m.status === status);
    if (genre) rows = rows.filter((m) => m.genres.includes(genre));
    if (age) rows = rows.filter((m) => m.age === age);
    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((m) => m.title.toLowerCase().includes(needle)
        || m.genres.some((g) => g.toLowerCase().includes(needle))
        || m.director.toLowerCase().includes(needle));
    }
    rows = [...rows].sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'title') return a.title.localeCompare(b.title, 'vi');
      return b.releaseDate.localeCompare(a.releaseDate);
    });
    const total = rows.length;
    const start = (page - 1) * perPage;
    return { items: rows.slice(start, start + perPage), total, page, perPage };
  });
}

export async function getMovie(slug: string): Promise<Movie> {
  return withDb((db) => {
    const movie = db.movies.find((m) => m.slug === slug && !m.deletedAt);
    if (!movie) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim.', {}, 404);
    return movie;
  });
}

export async function getMovieById(id: number): Promise<Movie> {
  return withDb((db) => {
    const movie = db.movies.find((m) => m.id === id && !m.deletedAt);
    if (!movie) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim.', {}, 404);
    return movie;
  });
}

export async function listGenres(): Promise<string[]> {
  return withDb((db) => Array.from(new Set(db.movies.filter((m) => !m.deletedAt).flatMap((m) => m.genres))).sort((a, b) => a.localeCompare(b, 'vi')));
}

export async function listShowtimes(params: {
  movieId?: number; cinemaId?: number; date?: string; format?: string; roomId?: number; includePast?: boolean;
} = {}): Promise<ShowtimePublic[]> {
  return withDb((db) => {
    const nowMs = Date.now();
    let rows = db.showtimes.filter((s) => s.status !== 'cancelled');
    if (params.movieId) rows = rows.filter((s) => s.movieId === params.movieId);
    if (params.cinemaId) rows = rows.filter((s) => s.cinemaId === params.cinemaId);
    if (params.roomId) rows = rows.filter((s) => s.roomId === params.roomId);
    if (params.date) rows = rows.filter((s) => s.showDate === params.date);
    if (params.format) rows = rows.filter((s) => s.format === params.format);
    if (!params.includePast) rows = rows.filter((s) => startMsOf(s) > nowMs - 30 * 60_000);
    return rows
      .sort((a, b) => (a.showDate + a.startTime).localeCompare(b.showDate + b.startTime))
      .map((s) => toShowtimePublic(db, s, nowMs));
  });
}

export async function getShowtime(id: number): Promise<ShowtimePublic> {
  return withDb((db) => {
    const showtime = db.showtimes.find((s) => s.id === id);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    return toShowtimePublic(db, showtime);
  });
}

export async function getShowtimeSeats(showtimeId: number): Promise<ShowtimeSeatMap> {
  return withDb((db) => {
    const showtime = db.showtimes.find((s) => s.id === showtimeId);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    const movie = db.movies.find((m) => m.id === showtime.movieId)!;
    const room = db.rooms.find((r) => r.id === showtime.roomId)!;
    const cinema = db.cinemas.find((c) => c.id === showtime.cinemaId)!;
    const actor = getMaybeActor(db);
    const seatsInRoom = db.seats
      .filter((s) => s.roomId === showtime.roomId && s.type !== 'aisle' && s.type !== 'blank')
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const taken = new Map<number, { status: 'held' | 'sold'; mine: boolean }>();
    for (const booking of db.bookings) {
      if (booking.showtimeId !== showtimeId) continue;
      if (booking.status !== 'holding' && booking.status !== 'confirmed' && booking.status !== 'completed') continue;
      for (const seat of booking.seats) {
        if (!seat.active) continue;
        taken.set(seat.seatId, {
          status: booking.status === 'holding' ? 'held' : 'sold',
          mine: actor ? booking.userId === actor.id : false,
        });
      }
    }
    const seats: SeatView[] = seatsInRoom.map((seat) => {
      const blocked = showtime.blockedSeatIds.includes(seat.id) || seat.type === 'disabled';
      const state = taken.get(seat.id);
      return {
        id: seat.id, code: seat.code, row: seat.row, col: seat.col, x: seat.x, y: seat.y, span: seat.span,
        type: seat.type,
        price: seatPrice(showtime.basePrice, seat.type, db.settings),
        status: blocked ? 'disabled' : state ? state.status : 'available',
        mine: state?.mine ?? false,
      };
    });
    const grid = {
      rows: Math.max(...seatsInRoom.map((s) => s.y), 0) + 1,
      cols: Math.max(...seatsInRoom.map((s) => s.x + s.span), 0),
    };
    return {
      showtime, movie, room, cinema, grid, seats,
      maxSeats: db.settings.maxSeatsPerBooking,
      serverTime: new Date().toISOString(),
    };
  });
}

export async function listCombos(): Promise<Combo[]> {
  return withDb((db) => db.combos.filter((c) => c.status === 'active').sort((a, b) => a.id - b.id));
}

export async function listBanners(): Promise<Banner[]> {
  return withDb((db) => db.banners.filter((b) => b.active).sort((a, b) => a.order - b.order));
}

function withNewsMedia(item: News): News {
  const media = NEWS_MEDIA[item.slug];
  return media ? { ...item, ...media } : item;
}

function withCinemaMedia(item: Cinema): Cinema {
  const media = CINEMA_MEDIA[item.name];
  return media ? { ...item, ...media } : item;
}

export async function listNews(): Promise<News[]> {
  return withDb((db) => db.news
    .filter((n) => n.status === 'published')
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map(withNewsMedia));
}

export async function getNews(slug: string) {
  return withDb((db) => {
    const item = db.news.find((n) => n.slug === slug && n.status === 'published');
    if (!item) throw new ApiError('NOT_FOUND', 'Không tìm thấy bài viết.', {}, 404);
    return withNewsMedia(item);
  });
}

export async function getStaticPage(slug: string) {
  return withDb((db) => db.pages.find((p) => p.slug === slug) ?? null);
}

export async function getPublicSettings() {
  return withDb((db) => ({
    cinemaName: db.settings.cinemaName,
    hotline: db.settings.hotline,
    email: db.settings.email,
    address: db.settings.address,
    holdMinutes: db.settings.holdMinutes,
    maxSeatsPerBooking: db.settings.maxSeatsPerBooking,
    vatPercent: db.settings.vatPercent,
    customerCancelAllowed: db.settings.customerCancelAllowed,
    customerCancelBeforeHours: db.settings.customerCancelBeforeHours,
    checkinOpenBeforeMinutes: db.settings.checkinOpenBeforeMinutes,
    checkinLateAllowMinutes: db.settings.checkinLateAllowMinutes,
    bankName: db.settings.bankName,
    bankCode: db.settings.bankCode,
    accountNumber: db.settings.accountNumber,
    accountName: db.settings.accountName,
    transferPrefix: db.settings.transferPrefix,
    useCustomQr: db.settings.useCustomQr,
    customQrUrl: db.settings.customQrUrl,
    paymentConfirmMode: db.settings.paymentConfirmMode,
    receiptMaxMb: db.settings.receiptMaxMb,
  }));
}

export async function listAvailableVouchers(): Promise<{ code: string; label: string; minOrder: number }[]> {
  return withDb((db) => db.vouchers
    .filter((v) => v.status === 'active' && new Date(v.expiresAt).getTime() > Date.now() && v.usedCount < v.totalUses)
    .map((v) => ({ code: v.code, label: v.label, minOrder: v.minOrder })));
}

/* ------------------------------------------------------------------ */
/* Admin: movies                                                       */
/* ------------------------------------------------------------------ */

export async function adminListMovies(params: MovieQuery = {}): Promise<Paged<Movie>> {
  return withDb((db) => {
    requirePermission(db, 'movie.read');
    let rows = [...db.movies];
    if (params.status && params.status !== 'all') rows = rows.filter((m) => m.status === params.status);
    if (params.q?.trim()) {
      const needle = params.q.toLowerCase();
      rows = rows.filter((m) => m.title.toLowerCase().includes(needle) || m.slug.includes(needle));
    }
    if (params.genre) rows = rows.filter((m) => m.genres.includes(params.genre!));
    rows.sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 10;
    return { items: rows.slice((page - 1) * perPage, page * perPage), total: rows.length, page, perPage };
  });
}

export interface MovieInput {
  id?: number;
  title: string;
  slug: string;
  description: string;
  director: string;
  cast: string[];
  genres: string[];
  duration: number;
  releaseDate: string;
  language: string;
  age: Movie['age'];
  rating: number;
  status: Movie['status'];
  trailerId?: string;
  posterUrl?: string;
  backdropUrl?: string;
  tagline: string;
  featured: boolean;
  art: Movie['art'];
}

export async function saveMovie(input: MovieInput): Promise<Movie> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'movie.write');
    if (!input.title.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập tên phim.', { fields: { title: 'Bắt buộc' } }, 422);
    if (!input.slug.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập slug.', { fields: { slug: 'Bắt buộc' } }, 422);
    if (input.duration < 30 || input.duration > 240) throw new ApiError('VALIDATION_ERROR', 'Thời lượng phải từ 30 đến 240 phút.', { fields: { duration: 'Không hợp lệ' } }, 422);
    if (db.movies.some((m) => m.slug === input.slug && m.id !== input.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Slug đã tồn tại, vui lòng chọn slug khác.', { fields: { slug: 'Slug đã tồn tại' } }, 422);
    }
    if (input.id) {
      const movie = db.movies.find((m) => m.id === input.id);
      if (!movie) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim.', {}, 404);
      const before = { ...movie };
      Object.assign(movie, input, { id: movie.id });
      audit(db, actor, 'movie.update', 'movie', movie.id, before, movie);
      return movie;
    }
    const movie: Movie = {
      ...input, id: nextId(db.movies), createdAt: new Date().toISOString(),
    };
    db.movies.push(movie);
    audit(db, actor, 'movie.create', 'movie', movie.id, undefined, movie);
    return movie;
  });
}

export async function setMovieStatus(id: number, status: Movie['status']): Promise<Movie> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'movie.write');
    const movie = db.movies.find((m) => m.id === id);
    if (!movie) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim.', {}, 404);
    const before = movie.status;
    movie.status = status;
    audit(db, actor, 'movie.status', 'movie', movie.id, { status: before }, { status });
    return movie;
  });
}

export async function deleteMovie(id: number): Promise<{ softDeleted: boolean; message: string }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'movie.delete');
    const movie = db.movies.find((m) => m.id === id);
    if (!movie) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim.', {}, 404);
    const hasShowtimes = db.showtimes.some((s) => s.movieId === id);
    const hasOrders = db.bookings.some((b) => db.showtimes.some((s) => s.id === b.showtimeId && s.movieId === id));
    if (hasShowtimes || hasOrders) {
      throw new ApiError(
        'MOVIE_HAS_SHOWTIMES',
        'Phim đã có suất chiếu hoặc đơn hàng nên không thể xóa cứng. Hãy chuyển phim sang trạng thái "Kết thúc" hoặc ẩn phim.',
        { hasShowtimes, hasOrders },
        409,
      );
    }
    movie.deletedAt = new Date().toISOString();
    audit(db, actor, 'movie.delete', 'movie', id, movie, { deletedAt: movie.deletedAt });
    return { softDeleted: true, message: 'Đã ẩn phim khỏi hệ thống.' };
  });
}

/* ------------------------------------------------------------------ */
/* Admin: cinemas, rooms, seats                                        */
/* ------------------------------------------------------------------ */

export async function listCinemasAdmin(): Promise<Cinema[]> {
  return withDb((db) => {
    requirePermission(db, 'cinema.read');
    const actor = getActor(db);
    const scope = scopeCinemaIds(actor);
    return db.cinemas
      .filter((c) => scope.length === 0 || scope.includes(c.id))
      .map(withCinemaMedia);
  });
}

export async function saveCinema(input: Partial<Cinema> & { name: string; address: string; city: string; hotline: string }): Promise<Cinema> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'cinema.write');
    if (input.id) {
      const cinema = db.cinemas.find((c) => c.id === input.id);
      if (!cinema) throw new ApiError('NOT_FOUND', 'Không tìm thấy rạp.', {}, 404);
      const before = { ...cinema };
      Object.assign(cinema, input);
      audit(db, actor, 'cinema.update', 'cinema', cinema.id, before, cinema);
      return cinema;
    }
    const cinema: Cinema = { ...input, id: nextId(db.cinemas), imageTone: input.imageTone ?? '#ff6600' };
    db.cinemas.push(cinema);
    audit(db, actor, 'cinema.create', 'cinema', cinema.id, undefined, cinema);
    return cinema;
  });
}

export async function listRooms(cinemaId?: number): Promise<Room[]> {
  return withDb((db) => {
    const actor = getMaybeActor(db);
    const scope = actor ? scopeCinemaIds(actor) : [];
    return db.rooms.filter((r) => (!cinemaId || r.cinemaId === cinemaId) && (scope.length === 0 || scope.includes(r.cinemaId)));
  });
}

export async function saveRoom(input: { id?: number; cinemaId: number; name: string; type: Room['type']; status: Room['status'] }): Promise<Room> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'room.write');
    if (!input.name.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập tên phòng.', {}, 422);
    if (input.id) {
      const room = db.rooms.find((r) => r.id === input.id);
      if (!room) throw new ApiError('NOT_FOUND', 'Không tìm thấy phòng.', {}, 404);
      const before = { ...room };
      Object.assign(room, input);
      audit(db, actor, 'room.update', 'room', room.id, before, room);
      return room;
    }
    const room: Room = { ...input, id: nextId(db.rooms) };
    db.rooms.push(room);
    audit(db, actor, 'room.create', 'room', room.id, undefined, room);
    return room;
  });
}

export async function getRoomSeats(roomId: number): Promise<Seat[]> {
  return withDb((db) => db.seats.filter((s) => s.roomId === roomId).sort((a, b) => a.y - b.y || a.x - b.x));
}

export async function saveSeatLayout(roomId: number, cells: SeatLayoutCell[]): Promise<{ seats: Seat[]; affectedShowtimes: number[] }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'room.write');
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) throw new ApiError('NOT_FOUND', 'Không tìm thấy phòng.', {}, 404);
    const keys = new Set<string>();
    for (const cell of cells) {
      const key = `${cell.row}-${cell.col}`;
      if (keys.has(key)) throw new ApiError('VALIDATION_ERROR', `Ô ghế ${cell.row}${cell.col} bị trùng.`, { fields: { layout: 'Trùng ô' } }, 422);
      keys.add(key);
    }
    const codes = cells.filter((c) => c.type !== 'aisle' && c.type !== 'blank').map((c) => c.code);
    if (new Set(codes).size !== codes.length) {
      throw new ApiError('VALIDATION_ERROR', 'Nhãn ghế phải duy nhất trong phòng.', { fields: { layout: 'Nhãn trùng' } }, 422);
    }
    if (cells.some((c) => c.type === 'couple' && c.span !== 2)) {
      throw new ApiError('VALIDATION_ERROR', 'Ghế đôi phải chiếm đúng 2 ô.', { fields: { layout: 'Ghế đôi không hợp lệ' } }, 422);
    }
    const existingSeats = db.seats.filter((s) => s.roomId === roomId);
    const seatByKey = new Map(existingSeats.map((s) => [`${s.row}-${s.col}`, s]));
    const futureShowtimes = db.showtimes.filter((s) => s.roomId === roomId && startMsOf(s) > Date.now() && s.status !== 'cancelled');
    const occupiedSeatIds = new Set<number>();
    for (const showtime of futureShowtimes) {
      for (const booking of db.bookings) {
        if (booking.showtimeId !== showtime.id) continue;
        if (booking.status !== 'holding' && booking.status !== 'confirmed') continue;
        for (const seat of booking.seats) if (seat.active) occupiedSeatIds.add(seat.seatId);
      }
    }
    const newKeys = new Set(cells.filter((c) => c.type !== 'aisle' && c.type !== 'blank').map((c) => `${c.row}-${c.col}`));
    const affectedShowtimeIds = new Set<number>();
    for (const seat of existingSeats) {
      const newCell = cells.find((c) => c.row === seat.row && c.col === seat.col);
      const removed = !newKeys.has(`${seat.row}-${seat.col}`);
      const disabled = newCell && (newCell.type === 'disabled') && seat.type !== 'disabled';
      if ((removed || disabled) && occupiedSeatIds.has(seat.id)) {
        for (const showtime of futureShowtimes) {
          const booking = db.bookings.find(
            (b) => b.showtimeId === showtime.id && b.seats.some((bs) => bs.seatId === seat.id && bs.active),
          );
          if (booking) affectedShowtimeIds.add(showtime.id);
        }
      }
    }
    if (affectedShowtimeIds.size > 0) {
      throw new ApiError(
        'SEAT_LAYOUT_CONFLICT',
        'Không thể xóa hoặc khóa ghế đã được bán/giữ cho suất chiếu sắp tới. Vui lòng xử lý đổi ghế hoặc hoàn tiền trước.',
        { affectedShowtimes: [...affectedShowtimeIds] },
        409,
      );
    }
    let seatId = nextId(db.seats);
    const nextSeats: Seat[] = [];
    for (const cell of cells) {
      const existing = seatByKey.get(`${cell.row}-${cell.col}`);
      nextSeats.push({
        id: existing?.id ?? seatId++,
        roomId,
        code: cell.code,
        row: cell.row,
        col: cell.col,
        x: cell.x,
        y: cell.y,
        span: cell.span,
        type: cell.type,
      });
    }
    db.seats = db.seats.filter((s) => s.roomId !== roomId).concat(nextSeats);
    audit(db, actor, 'seat_layout.update', 'room', roomId, { seats: existingSeats.length }, { seats: nextSeats.length });
    return { seats: nextSeats, affectedShowtimes: [] };
  });
}

export async function generateRoomSeats(roomId: number, config: { rows: number; cols: number; vipRows: string[]; coupleRows: string[]; disabledCells: string[] }): Promise<Seat[]> {
  return mutateDb((db) => {
    requirePermission(db, 'room.write');
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) throw new ApiError('NOT_FOUND', 'Không tìm thấy phòng.', {}, 404);
    let id = nextId(db.seats);
    const rows = Array.from({ length: config.rows }, (_, i) => String.fromCharCode(65 + i));
    const cells: Seat[] = [];
    for (let y = 0; y < config.rows; y++) {
      const row = rows[y];
      if (config.coupleRows.includes(row)) {
        const pairs = Math.floor(config.cols / 2);
        for (let p = 0; p < pairs; p++) {
          cells.push({
            id: id++, roomId, row, col: p * 2 + 1, x: p * 2 + 1, y, span: 2, type: 'couple',
            code: `${row}${String(p * 2 + 1).padStart(2, '0')}-${row}${String(p * 2 + 2).padStart(2, '0')}`,
          });
        }
        continue;
      }
      for (let col = 1; col <= config.cols; col++) {
        const key = `${row}${col}`;
        cells.push({
          id: id++, roomId, row, col, x: col - 1 + (col > 3 ? 1 : 0) + (col > 11 ? 1 : 0), y, span: 1,
          type: config.disabledCells.includes(key) ? 'disabled' : config.vipRows.includes(row) ? 'vip' : 'standard',
          code: `${row}${String(col).padStart(2, '0')}`,
        });
      }
    }
    db.seats = db.seats.filter((s) => s.roomId !== roomId).concat(cells);
    const actor = getActor(db);
    audit(db, actor, 'seat_layout.generate', 'room', roomId, undefined, { seats: cells.length });
    return cells;
  });
}

/* ------------------------------------------------------------------ */
/* Admin: showtimes                                                    */
/* ------------------------------------------------------------------ */

function validateShowtimeCore(db: Database, input: ShowtimeInput, excludeId?: number): ShowtimeValidation {
  const movie = db.movies.find((m) => m.id === input.movieId);
  const room = db.rooms.find((r) => r.id === input.roomId);
  const warnings: string[] = [];
  if (!movie) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim.', {}, 404);
  if (!room) throw new ApiError('NOT_FOUND', 'Không tìm thấy phòng.', {}, 404);
  if (movie.status === 'ended') throw new ApiError('VALIDATION_ERROR', 'Phim đã kết thúc, không thể tạo suất chiếu.', { fields: { movieId: 'Phim đã kết thúc' } }, 422);
  if (room.status === 'maintenance') throw new ApiError('VALIDATION_ERROR', 'Phòng đang bảo trì.', { fields: { roomId: 'Phòng bảo trì' } }, 422);

  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = startMinutes + movie.duration + db.settings.adsMinutes;
  if (endMinutes >= 1440) throw new ApiError('VALIDATION_ERROR', 'Suất chiếu vượt quá 24:00. Vui lòng chọn giờ sớm hơn.', { fields: { startTime: 'Vượt quá 24:00' } }, 422);
  const endTime = minutesToTime(endMinutes);
  if (input.showDate < dateISO(cinemaNow())) {
    throw new ApiError('VALIDATION_ERROR', 'Không thể tạo suất chiếu trong quá khứ.', { fields: { showDate: 'Ngày đã qua' } }, 422);
  }
  if (input.showDate === dateISO(cinemaNow()) && endMinutes <= cinemaNow().getHours() * 60 + cinemaNow().getMinutes()) {
    warnings.push('Suất chiếu này đã qua thời điểm kết thúc trong ngày hôm nay.');
  }
  const conflicts: ShowtimeConflict[] = [];
  for (const other of db.showtimes) {
    if (other.id === excludeId) continue;
    if (other.roomId !== input.roomId || other.showDate !== input.showDate) continue;
    if (other.status === 'cancelled') continue;
    const otherStart = timeToMinutes(other.startTime);
    const otherEnd = timeToMinutes(other.endTime) + db.settings.roomCleaningMinutes;
    if (startMinutes < otherEnd && otherStart < endMinutes + db.settings.roomCleaningMinutes) {
      const otherMovie = db.movies.find((m) => m.id === other.movieId);
      conflicts.push({
        showtimeId: other.id, movieTitle: otherMovie?.title ?? '—',
        startTime: other.startTime, endTime: other.endTime,
      });
    }
  }
  return { valid: conflicts.length === 0, endTime, conflicts, warnings };
}

export async function validateShowtime(input: ShowtimeInput, excludeId?: number): Promise<ShowtimeValidation> {
  return withDb((db) => {
    requirePermission(db, 'showtime.write');
    return validateShowtimeCore(db, input, excludeId);
  });
}

export async function listShowtimesAdmin(params: {
  cinemaId?: number; roomId?: number; date?: string; movieId?: number; status?: ShowtimeStatus | 'all'; from?: string; to?: string;
} = {}): Promise<ShowtimePublic[]> {
  return withDb((db) => {
    requirePermission(db, 'showtime.read');
    const actor = getActor(db);
    const scope = scopeCinemaIds(actor);
    let rows = db.showtimes.filter((s) => scope.length === 0 || scope.includes(s.cinemaId));
    if (params.cinemaId) rows = rows.filter((s) => s.cinemaId === params.cinemaId);
    if (params.roomId) rows = rows.filter((s) => s.roomId === params.roomId);
    if (params.date) rows = rows.filter((s) => s.showDate === params.date);
    if (params.from) rows = rows.filter((s) => s.showDate >= params.from!);
    if (params.to) rows = rows.filter((s) => s.showDate <= params.to!);
    if (params.movieId) rows = rows.filter((s) => s.movieId === params.movieId);
    if (params.status && params.status !== 'all') rows = rows.filter((s) => s.status === params.status);
    return rows
      .sort((a, b) => (a.showDate + a.startTime).localeCompare(b.showDate + b.startTime))
      .map((s) => toShowtimePublic(db, s));
  });
}

export async function createShowtime(input: ShowtimeInput): Promise<Showtime> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'showtime.write');
    const validation = validateShowtimeCore(db, input);
    if (!validation.valid) {
      throw new ApiError('SHOWTIME_OVERLAP', 'Suất chiếu bị trùng giờ hoặc thiếu thời gian dọn phòng.', { conflicts: validation.conflicts }, 409);
    }
    const room = db.rooms.find((r) => r.id === input.roomId)!;
    const showtime: Showtime = {
      id: nextId(db.showtimes),
      movieId: input.movieId, roomId: input.roomId, cinemaId: room.cinemaId,
      showDate: input.showDate, startTime: input.startTime, endTime: validation.endTime,
      format: input.format ?? `${room.type} Phụ đề`,
      basePrice: input.basePrice ?? basePriceFor(input.showDate, input.startTime, room.type, db.priceRules, db.settings.priceRounding),
      status: 'selling', blockedSeatIds: [], createdAt: new Date().toISOString(),
    };
    db.showtimes.push(showtime);
    audit(db, actor, 'showtime.create', 'showtime', showtime.id, undefined, showtime);
    return showtime;
  });
}

export async function updateShowtime(id: number, input: Partial<ShowtimeInput> & { status?: ShowtimeStatus; note?: string }): Promise<Showtime> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'showtime.write');
    const showtime = db.showtimes.find((s) => s.id === id);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    const hasOrders = db.bookings.some(
      (b) => b.showtimeId === id && (b.status === 'confirmed' || b.status === 'completed'),
    );
    const structuralChange = (input.showDate && input.showDate !== showtime.showDate)
      || (input.startTime && input.startTime !== showtime.startTime)
      || (input.roomId && input.roomId !== showtime.roomId)
      || (input.movieId && input.movieId !== showtime.movieId);
    if (hasOrders && structuralChange) {
      throw new ApiError('BOOKING_INVALID_STATE', 'Suất chiếu đã có đơn. Chỉ được sửa giá/ghi chú; hãy dùng quy trình dời/hủy suất.', {}, 409);
    }
    if (structuralChange) {
      const validation = validateShowtimeCore(db, {
        movieId: input.movieId ?? showtime.movieId,
        roomId: input.roomId ?? showtime.roomId,
        showDate: input.showDate ?? showtime.showDate,
        startTime: input.startTime ?? showtime.startTime,
      }, id);
      if (!validation.valid) throw new ApiError('SHOWTIME_OVERLAP', 'Suất chiếu bị trùng giờ hoặc thiếu thời gian dọn phòng.', { conflicts: validation.conflicts }, 409);
      showtime.endTime = validation.endTime;
    }
    const before = { ...showtime };
    if (input.movieId) showtime.movieId = input.movieId;
    if (input.roomId) {
      showtime.roomId = input.roomId;
      const room = db.rooms.find((r) => r.id === input.roomId)!;
      showtime.cinemaId = room.cinemaId;
    }
    if (input.showDate) showtime.showDate = input.showDate;
    if (input.startTime) showtime.startTime = input.startTime;
    if (input.format) showtime.format = input.format;
    if (input.basePrice !== undefined) showtime.basePrice = input.basePrice;
    if (input.status) showtime.status = input.status;
    audit(db, actor, 'showtime.update', 'showtime', showtime.id, before, showtime);
    return showtime;
  });
}

export async function bulkCreateShowtimes(input: {
  movieId: number; roomId: number; from: string; to: string; times: string[]; format?: string; basePrice?: number; dryRun?: boolean;
}): Promise<{ rows: BulkPreviewRow[]; created: number }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'showtime.write');
    const movie = db.movies.find((m) => m.id === input.movieId);
    const room = db.rooms.find((r) => r.id === input.roomId);
    if (!movie || !room) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim hoặc phòng.', {}, 404);
    if (input.to < input.from) throw new ApiError('VALIDATION_ERROR', 'Khoảng ngày không hợp lệ.', {}, 422);
    if (input.to > addDaysISO(dateISO(cinemaNow()), 90)) throw new ApiError('VALIDATION_ERROR', 'Chỉ được tạo trước tối đa 90 ngày.', {}, 422);
    const rows: BulkPreviewRow[] = [];
    let created = 0;
    const span = Math.round((new Date(input.to).getTime() - new Date(input.from).getTime()) / 86_400_000);
    for (let d = 0; d <= span; d++) {
      const date = addDaysISO(input.from, d);
      for (const time of input.times) {
        const base: ShowtimeInput = { movieId: input.movieId, roomId: input.roomId, showDate: date, startTime: time, format: input.format, basePrice: input.basePrice };
        try {
          const validation = validateShowtimeCore(db, base);
          rows.push({ ...base, endTime: validation.endTime, valid: validation.valid, conflicts: validation.conflicts, reason: validation.valid ? undefined : 'Trùng giờ / thiếu thời gian dọn phòng' });
          if (validation.valid && !input.dryRun) {
            const showtime: Showtime = {
              id: nextId(db.showtimes), movieId: input.movieId, roomId: input.roomId, cinemaId: room.cinemaId,
              showDate: date, startTime: time, endTime: validation.endTime,
              format: input.format ?? `${room.type} Phụ đề`,
              basePrice: input.basePrice ?? basePriceFor(date, time, room.type, db.priceRules, db.settings.priceRounding),
              status: 'selling', blockedSeatIds: [], createdAt: new Date().toISOString(),
            };
            db.showtimes.push(showtime);
            created++;
          }
        } catch (err) {
          const message = err instanceof ApiError ? err.message : 'Không hợp lệ';
          rows.push({ ...base, endTime: '—', valid: false, conflicts: [], reason: message });
        }
      }
    }
    if (!input.dryRun) audit(db, actor, 'showtime.bulk_create', 'showtime', room.id, undefined, { created, from: input.from, to: input.to });
    return { rows, created };
  });
}

export async function showtimeImpact(id: number) {
  return withDb((db) => {
    requirePermission(db, 'showtime.cancel');
    const showtime = db.showtimes.find((s) => s.id === id);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    const affected = db.bookings.filter((b) => b.showtimeId === id && (b.status === 'confirmed' || b.status === 'holding'));
    const movie = db.movies.find((m) => m.id === showtime.movieId)!;
    return {
      showtime,
      movie,
      bookings: affected.map((b) => ({
        code: b.code, customerName: b.customerName, status: b.status, seats: b.seats.filter((s) => s.active).map((s) => s.code),
        amount: b.finalAmount,
      })),
      totalAmount: affected.reduce((sum, b) => sum + b.finalAmount, 0),
    };
  });
}

export async function cancelShowtime(id: number, input: { reason: string; action: 'refund' | 'reschedule'; targetShowtimeId?: number }): Promise<{ cancelledBookings: number; refundsCreated: number }> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'showtime.cancel');
    const showtime = db.showtimes.find((s) => s.id === id);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    if (!input.reason.trim() || input.reason.trim().length < 5) {
      throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do hủy suất chiếu.', { fields: { reason: 'Bắt buộc' } }, 422);
    }
    if (input.action === 'reschedule' && !input.targetShowtimeId) {
      throw new ApiError('VALIDATION_ERROR', 'Vui lòng chọn suất chiếu thay thế.', {}, 422);
    }
    const affected = db.bookings.filter((b) => b.showtimeId === id && (b.status === 'confirmed' || b.status === 'holding'));
    let refundsCreated = 0;
    const target = input.targetShowtimeId ? db.showtimes.find((s) => s.id === input.targetShowtimeId) : null;
    const takenAtTarget = target ? activeSeatIds(db, target.id) : null;
    for (const booking of affected) {
      const movedToTarget = input.action === 'reschedule' && target && takenAtTarget
        && booking.seats.every((s) => !takenAtTarget.has(s.seatId));
      if (movedToTarget && target) {
        booking.showtimeId = target.id;
        booking.holdExpiresAt = new Date(startMsOf(target) - db.settings.onlineCloseBeforeMinutes * 60_000).toISOString();
        for (const seat of booking.seats) takenAtTarget!.add(seat.seatId);
        for (const ticket of db.tickets.filter((t) => t.bookingId === booking.id)) {
          if (ticket.status === 'valid') ticket.status = 'cancelled';
        }
        if (booking.status === 'confirmed') {
          issueTickets(db, booking);
        }
        if (booking.userId) {
          notifyUserMove(db, booking.userId, booking.code, showtime, target);
        }
      } else {
        booking.status = 'cancelled';
        booking.cancelledAt = new Date().toISOString();
        booking.cancelReason = `Rạp hủy suất chiếu: ${input.reason}`;
        for (const seat of booking.seats) seat.active = false;
        for (const ticket of db.tickets.filter((t) => t.bookingId === booking.id)) ticket.status = 'cancelled';
        const payment = db.payments.find((p) => p.bookingId === booking.id && p.status === 'paid');
        if (payment) {
          db.refunds.push({
            id: nextId(db.refunds), code: `RF-${booking.code.slice(-6)}`, bookingId: booking.id,
            scope: 'full', seatIds: booking.seats.map((s) => s.seatId), amount: booking.finalAmount,
            reason: `Suất chiếu bị hủy: ${input.reason}`, status: 'requested',
            requestedBy: actor.id, createdAt: new Date().toISOString(),
          });
          refundsCreated++;
        }
        if (booking.userId) {
          notifyUserCancel(db, booking.userId, booking, showtime, input.reason);
        }
      }
    }
    showtime.status = 'cancelled';
    audit(db, actor, 'showtime.cancel', 'showtime', id, undefined, { reason: input.reason, action: input.action, affected: affected.length });
    return { cancelledBookings: affected.length, refundsCreated };
  });
}

function notifyUserMove(db: Database, userId: string, code: string, from: Showtime, to: Showtime): void {
  db.notifications.push({
    id: nextId(db.notifications), userId, title: 'Suất chiếu đã được dời',
    body: `Đơn ${code} được chuyển từ ${from.startTime} ${from.showDate} sang ${to.startTime} ${to.showDate}. Vui lòng kiểm tra vé mới.`,
    type: 'booking', read: false, createdAt: new Date().toISOString(), link: '/tai-khoan/ve-cua-toi',
  });
}

function notifyUserCancel(db: Database, userId: string, booking: { code: string }, showtime: Showtime, reason: string): void {
  db.notifications.push({
    id: nextId(db.notifications), userId, title: 'Suất chiếu đã bị hủy',
    body: `Suất chiếu ${showtime.startTime} ${showtime.showDate} đã bị hủy (${reason}). Đơn ${booking.code} sẽ được hoàn tiền theo chính sách.`,
    type: 'booking', read: false, createdAt: new Date().toISOString(), link: '/tai-khoan/ve-cua-toi',
  });
}

export async function setBlockedSeats(showtimeId: number, seatIds: number[]): Promise<Showtime> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'showtime.write');
    const showtime = db.showtimes.find((s) => s.id === showtimeId);
    if (!showtime) throw new ApiError('NOT_FOUND', 'Không tìm thấy suất chiếu.', {}, 404);
    showtime.blockedSeatIds = seatIds;
    audit(db, actor, 'showtime.block_seats', 'showtime', showtimeId, undefined, { seatIds });
    return showtime;
  });
}

/* ------------------------------------------------------------------ */
/* Admin: pricing & combos                                             */
/* ------------------------------------------------------------------ */

export async function listPriceRules(): Promise<PriceRule[]> {
  return withDb((db) => {
    requirePermission(db, 'pricing.read');
    return [...db.priceRules];
  });
}

export async function savePriceRules(rules: PriceRule[]): Promise<PriceRule[]> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'pricing.write');
    const before = [...db.priceRules];
    db.priceRules = rules.map((r, i) => ({ ...r, id: r.id || i + 1 }));
    audit(db, actor, 'pricing.update', 'pricing', 'rules', before, db.priceRules);
    return db.priceRules;
  });
}

export async function simulatePrice(input: { showDate: string; startTime: string; roomId: number; seatType: SeatType }): Promise<{ basePrice: number; seatPrice: number; roomSurcharge: number; slot: string }> {
  return withDb((db) => {
    const room = db.rooms.find((r) => r.id === input.roomId);
    if (!room) throw new ApiError('NOT_FOUND', 'Không tìm thấy phòng.', {}, 404);
    const base = basePriceFor(input.showDate, input.startTime, room.type, db.priceRules, db.settings.priceRounding);
    return {
      basePrice: base,
      seatPrice: seatPrice(base, input.seatType, db.settings),
      roomSurcharge: ROOM_TYPE_SURCHARGE[room.type],
      slot: slotOf(input.startTime),
    };
  });
}

export async function listCombosAdmin(): Promise<Combo[]> {
  return withDb((db) => {
    requirePermission(db, 'combo.read');
    return [...db.combos];
  });
}

export async function saveCombo(input: Partial<Combo> & { name: string; price: number; category: Combo['category'] }): Promise<Combo> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'combo.write');
    if (!input.name.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập tên combo.', {}, 422);
    if (input.price < 0) throw new ApiError('VALIDATION_ERROR', 'Giá không hợp lệ.', {}, 422);
    if (input.id) {
      const combo = db.combos.find((c) => c.id === input.id);
      if (!combo) throw new ApiError('NOT_FOUND', 'Không tìm thấy combo.', {}, 404);
      const before = { ...combo };
      Object.assign(combo, input);
      audit(db, actor, 'combo.update', 'combo', combo.id, before, combo);
      return combo;
    }
    const combo: Combo = {
      id: nextId(db.combos), name: input.name, description: input.description ?? '',
      price: input.price, category: input.category, stock: input.stock ?? 0,
      maxPerOrder: input.maxPerOrder ?? 10, status: input.status ?? 'active',
      art: input.art ?? { from: '#ff6600', to: '#7c2d12', emoji: '🍿' }, sold: 0,
    };
    db.combos.push(combo);
    audit(db, actor, 'combo.create', 'combo', combo.id, undefined, combo);
    return combo;
  });
}

export async function adjustComboStock(id: number, delta: number, reason: string): Promise<Combo> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'inventory.write');
    const combo = db.combos.find((c) => c.id === id);
    if (!combo) throw new ApiError('NOT_FOUND', 'Không tìm thấy combo.', {}, 404);
    if (!reason.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập lý do điều chỉnh kho.', {}, 422);
    const before = combo.stock;
    combo.stock = Math.max(0, combo.stock + delta);
    audit(db, actor, 'combo.stock', 'combo', id, { stock: before }, { stock: combo.stock }, reason);
    return combo;
  });
}

/* ------------------------------------------------------------------ */
/* Admin: content                                                      */
/* ------------------------------------------------------------------ */

export async function listBannersAdmin(): Promise<Banner[]> {
  return withDb((db) => {
    requirePermission(db, 'content.write');
    return [...db.banners].sort((a, b) => a.order - b.order);
  });
}

export async function listNewsAdmin(): Promise<News[]> {
  return withDb((db) => {
    requirePermission(db, 'content.write');
    return [...db.news]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map(withNewsMedia);
  });
}

export async function saveBanner(input: Partial<Banner> & { title: string }): Promise<Banner> {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'content.write');
    if (input.id) {
      const banner = db.banners.find((b) => b.id === input.id);
      if (!banner) throw new ApiError('NOT_FOUND', 'Không tìm thấy banner.', {}, 404);
      Object.assign(banner, input);
      audit(db, actor, 'banner.update', 'banner', banner.id, undefined, banner);
      return banner;
    }
    const banner: Banner = {
      id: nextId(db.banners), title: input.title, subtitle: input.subtitle ?? '', movieId: input.movieId,
      ctaLabel: input.ctaLabel ?? 'Mua vé', active: input.active ?? true, order: input.order ?? db.banners.length + 1,
      tone: input.tone ?? { from: '#ff6600', to: '#431407', accent: '#fed7aa' },
    };
    db.banners.push(banner);
    audit(db, actor, 'banner.create', 'banner', banner.id, undefined, banner);
    return banner;
  });
}

export async function deleteBanner(id: number): Promise<void> {
  await mutateDb((db) => {
    const actor = requirePermission(db, 'content.write');
    db.banners = db.banners.filter((b) => b.id !== id);
    audit(db, actor, 'banner.delete', 'banner', id);
  });
}

export async function saveNews(input: { id?: number; title: string; slug: string; excerpt: string; body: string; tag: string; status: 'published' | 'draft'; imageTone?: string }) {
  return mutateDb((db) => {
    const actor = requirePermission(db, 'content.write');
    if (input.id) {
      const item = db.news.find((n) => n.id === input.id);
      if (!item) throw new ApiError('NOT_FOUND', 'Không tìm thấy bài viết.', {}, 404);
      Object.assign(item, input);
      audit(db, actor, 'news.update', 'news', item.id, undefined, item);
      return item;
    }
    const item = {
      id: nextId(db.news), title: input.title, slug: input.slug, excerpt: input.excerpt, body: input.body,
      tag: input.tag, imageTone: input.imageTone ?? '#ff6600', publishedAt: new Date().toISOString(), status: input.status,
    };
    db.news.push(item);
    audit(db, actor, 'news.create', 'news', item.id, undefined, item);
    return item;
  });
}

export async function listReviewsAdmin() {
  return withDb((db) => {
    requirePermission(db, 'review.moderate');
    return [...db.reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });
}

export async function setReviewVisibility(id: number, visible: boolean): Promise<void> {
  await mutateDb((db) => {
    const actor = requirePermission(db, 'review.moderate');
    const review = db.reviews.find((r) => r.id === id);
    if (!review) throw new ApiError('NOT_FOUND', 'Không tìm thấy đánh giá.', {}, 404);
    review.visible = visible;
    audit(db, actor, 'review.visibility', 'review', id, undefined, { visible });
  });
}

/* ------------------------------------------------------------------ */
/* Search / discovery helpers                                          */
/* ------------------------------------------------------------------ */

export async function searchEverything(q: string) {
  return withDb((db) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return { movies: [], orders: [] };
    const actor = getMaybeActor(db);
    const canReadOrders = actor && (actor.role === 'admin' || actor.role === 'manager' || actor.permissions.includes('booking.read'));
    return {
      movies: db.movies.filter((m) => !m.deletedAt && m.title.toLowerCase().includes(needle)).slice(0, 5),
      orders: canReadOrders
        ? db.bookings.filter((b) => b.code.toLowerCase().includes(needle)).slice(0, 5)
        : [],
    };
  });
}

export async function cinemaScopeForActor(): Promise<number[]> {
  return withDb((db) => scopeCinemaIds(getActor(db)));
}

export async function assertCinemaAccess(cinemaId: number): Promise<void> {
  await withDb((db) => {
    const actor = getMaybeActor(db);
    if (actor && !canAccessCinema(actor, cinemaId)) {
      throw new ApiError('FORBIDDEN', 'Bạn không có quyền với rạp này.', {}, 403);
    }
  });
}

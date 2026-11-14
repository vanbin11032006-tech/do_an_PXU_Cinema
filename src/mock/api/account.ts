import type { MembershipTier, Movie, Notification, PointTransaction, Review } from '@/types/domain';
import { ApiError } from '@/types/domain';
import { mutateDb, nextId, notify, requirePermission, withDb, getActor } from '../core';

export interface PointsSummary {
  points: number;
  tier: MembershipTier;
  nextTier?: MembershipTier;
  progress: number;
  twelveMonthSpend: number;
  transactions: PointTransaction[];
  tiers: MembershipTier[];
}

export async function listNotifications(limit = 20): Promise<Notification[]> {
  return withDb((db) => {
    const user = getActor(db);
    return db.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  });
}

export async function markNotificationsRead(ids?: number[]): Promise<{ message: string }> {
  return mutateDb((db) => {
    const user = getActor(db);
    for (const notification of db.notifications) {
      if (notification.userId !== user.id) continue;
      if (!ids || ids.includes(notification.id)) notification.read = true;
    }
    return { message: 'Đã đánh dấu thông báo đã đọc.' };
  });
}

export async function unreadNotificationCount(): Promise<number> {
  return withDb((db) => {
    const user = getActor(db);
    return db.notifications.filter((n) => n.userId === user.id && !n.read).length;
  });
}

export async function getPointsSummary(): Promise<PointsSummary> {
  return withDb((db) => {
    const user = getActor(db);
    const tiers = [...db.tiers].sort((a, b) => a.minSpend - b.minSpend);
    const tier = tiers.find((t) => t.key === user.tier) ?? tiers[0];
    const currentIndex = tiers.findIndex((t) => t.key === tier.key);
    const nextTier = tiers[currentIndex + 1];
    const spend = db.bookings
      .filter((b) => b.userId === user.id && (b.status === 'confirmed' || b.status === 'completed'))
      .reduce((sum, b) => sum + b.finalAmount, 0);
    const progress = nextTier
      ? Math.min(100, Math.round(((spend - tier.minSpend) / Math.max(1, nextTier.minSpend - tier.minSpend)) * 100))
      : 100;
    return {
      points: user.points, tier, nextTier, progress: Math.max(0, progress), twelveMonthSpend: spend,
      transactions: db.pointTransactions.filter((t) => t.userId === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30),
      tiers,
    };
  });
}

export async function listFavorites(): Promise<Movie[]> {
  return withDb((db) => {
    const user = getActor(db);
    const ids = db.favorites.filter((f) => f.userId === user.id).map((f) => f.movieId);
    return db.movies.filter((m) => ids.includes(m.id) && !m.deletedAt);
  });
}

export async function toggleFavorite(movieId: number): Promise<{ favorited: boolean; message: string }> {
  return mutateDb((db) => {
    const user = getActor(db);
    if (!db.movies.some((m) => m.id === movieId)) throw new ApiError('NOT_FOUND', 'Không tìm thấy phim.', {}, 404);
    const existing = db.favorites.find((f) => f.userId === user.id && f.movieId === movieId);
    if (existing) {
      db.favorites = db.favorites.filter((f) => f !== existing);
      return { favorited: false, message: 'Đã bỏ phim khỏi danh sách yêu thích.' };
    }
    db.favorites.push({ userId: user.id, movieId });
    return { favorited: true, message: 'Đã thêm phim vào danh sách yêu thích.' };
  });
}

export async function isFavorite(movieId: number): Promise<boolean> {
  return withDb((db) => {
    const user = getActor(db);
    return db.favorites.some((f) => f.userId === user.id && f.movieId === movieId);
  });
}

export async function listMovieReviews(movieId: number): Promise<Review[]> {
  return withDb((db) => db.reviews
    .filter((r) => r.movieId === movieId && r.visible)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function canReviewMovie(movieId: number): Promise<boolean> {
  return withDb((db) => {
    const user = getActor(db);
    const bookings = db.bookings.filter((b) => b.userId === user.id);
    return db.tickets.some((ticket) => {
      if (ticket.status !== 'used') return false;
      const booking = bookings.find((b) => b.id === ticket.bookingId);
      if (!booking) return false;
      const showtime = db.showtimes.find((s) => s.id === booking.showtimeId);
      return showtime?.movieId === movieId;
    });
  });
}

export async function submitReview(input: { movieId: number; rating: number; comment: string }): Promise<{ message: string }> {
  return mutateDb((db) => {
    const user = getActor(db);
    if (input.rating < 1 || input.rating > 10) throw new ApiError('VALIDATION_ERROR', 'Điểm đánh giá phải từ 1–10.', {}, 422);
    if (!input.comment.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập nhận xét.', {}, 422);
    if (db.reviews.some((r) => r.userId === user.id && r.movieId === input.movieId)) {
      throw new ApiError('VALIDATION_ERROR', 'Bạn đã đánh giá phim này rồi.', {}, 422);
    }
    const allowed = db.tickets.some((ticket) => {
      if (ticket.status !== 'used') return false;
      const booking = db.bookings.find((b) => b.id === ticket.bookingId && b.userId === user.id);
      const showtime = booking ? db.showtimes.find((s) => s.id === booking.showtimeId) : undefined;
      return showtime?.movieId === input.movieId;
    });
    if (!allowed) throw new ApiError('FORBIDDEN', 'Chỉ khách đã xem phim mới được đánh giá.', {}, 403);
    db.reviews.push({
      id: nextId(db.reviews), movieId: input.movieId, userId: user.id, userName: user.name,
      rating: input.rating, comment: input.comment.trim(), visible: true, createdAt: new Date().toISOString(),
    });
    return { message: 'Cảm ơn bạn đã đánh giá phim!' };
  });
}

export async function sendContactMessage(input: { name: string; email: string; message: string }): Promise<{ message: string }> {
  return mutateDb((db) => {
    if (!input.name.trim() || !input.email.trim() || !input.message.trim()) {
      throw new ApiError('VALIDATION_ERROR', 'Vui lòng điền đầy đủ thông tin.', {}, 422);
    }
    const admins = db.users.filter((u) => u.role === 'admin');
    for (const admin of admins) {
      notify(db, admin.id, 'Tin nhắn liên hệ mới', `${input.name} (${input.email}): ${input.message.slice(0, 160)}`, 'system', '/admin');
    }
    return { message: 'Đã gửi tin nhắn. Chúng tôi sẽ phản hồi qua email trong 24 giờ.' };
  });
}

export async function requireStaffAccess(): Promise<void> {
  await withDb((db) => {
    const actor = getActor(db);
    if (actor.role !== 'staff' && actor.role !== 'manager' && actor.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Khu vực dành cho nhân viên.', {}, 403);
    }
  });
}

export async function getNotificationTemplateList(): Promise<string[]> {
  await withDb((db) => requirePermission(db, 'setting.read'));
  return ['booking.confirmed', 'payment.rejected', 'showtime.cancelled', 'refund.completed'];
}

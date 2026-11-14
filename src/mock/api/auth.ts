import type { SessionUser } from '@/types/domain';
import { ApiError } from '@/types/domain';
import { hashPassword, randomToken } from '../crypto';
import { getActor, mutateDb, notify, setActor, toSessionUser, withDb } from '../core';

export const DEMO_ACCOUNTS = [
  { email: 'khach@pxu.vn', password: 'Khach@123', role: 'customer', label: 'Khách hàng', name: 'Nguyễn Minh Anh' },
  { email: 'staff@pxu.vn', password: 'Staff@123', role: 'staff', label: 'Nhân viên', name: 'Trần Quốc Huy' },
  { email: 'manager@pxu.vn', password: 'Manager@123', role: 'manager', label: 'Quản lý', name: 'Lê Thu Hà' },
  { email: 'admin@pxu.vn', password: 'Admin@123', role: 'admin', label: 'Quản trị', name: 'Phạm Gia Bảo' },
] as const;

interface Attempt { count: number; firstAt: number; lockedUntil: number }
const attempts = new Map<string, Attempt>();
const resetTokens = new Map<string, { email: string; expiresAt: number }>();

function registerFailure(key: string): void {
  const now = Date.now();
  const current = attempts.get(key);
  const entry: Attempt = current && now - current.firstAt < 15 * 60_000
    ? { ...current, count: current.count + 1 }
    : { count: 1, firstAt: now, lockedUntil: 0 };
  if (entry.count >= 5) entry.lockedUntil = now + 15 * 60_000;
  attempts.set(key, entry);
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const normalized = email.trim().toLowerCase();
  const memory = attempts.get(normalized);
  if (memory?.lockedUntil && memory.lockedUntil > Date.now()) {
    const minutes = Math.ceil((memory.lockedUntil - Date.now()) / 60_000);
    throw new ApiError('TOO_MANY_REQUESTS', `Bạn đã nhập sai quá 5 lần. Vui lòng thử lại sau ${minutes} phút.`, { retry_after: minutes * 60 }, 429);
  }

  const passwordHash = await hashPassword(password);
  const result = await mutateDb((db) => {
    const user = db.users.find((u) => u.email.toLowerCase() === normalized);
    if (!user || user.passwordHash !== passwordHash) {
      return { error: 'INVALID' as const };
    }
    if (user.status === 'locked') {
      throw new ApiError('ACCOUNT_LOCKED', 'Tài khoản đang bị khóa. Vui lòng liên hệ bộ phận hỗ trợ.', {}, 423);
    }
    if (user.status === 'invited') {
      throw new ApiError('ACCOUNT_LOCKED', 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email mời.', {}, 423);
    }
    user.lastLoginAt = new Date().toISOString();
    setActor(user.id);
    return { user: toSessionUser(user) };
  });

  if ('error' in result) {
    registerFailure(normalized);
    const entry = attempts.get(normalized);
    const remaining = entry && entry.count >= 5 ? 15 : Math.max(1, 5 - (entry?.count ?? 0));
    throw new ApiError(
      'UNAUTHENTICATED',
      entry && entry.count >= 5
        ? 'Bạn đã nhập sai quá 5 lần. Tài khoản tạm khóa 15 phút.'
        : `Email hoặc mật khẩu không đúng. Còn ${remaining} lần thử.`,
      { remaining },
      401,
    );
  }
  attempts.delete(normalized);
  return result.user;
}

export function logout(): void {
  setActor(null);
}

export async function me(): Promise<SessionUser> {
  return withDb((db) => toSessionUser(getActor(db)));
}

export async function register(payload: {
  name: string; email: string; phone: string; password: string; acceptTerms: boolean;
}): Promise<SessionUser> {
  if (!payload.acceptTerms) throw new ApiError('VALIDATION_ERROR', 'Bạn cần đồng ý với điều khoản sử dụng.', { fields: { acceptTerms: 'Bắt buộc' } }, 422);
  const email = payload.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) throw new ApiError('VALIDATION_ERROR', 'Email không hợp lệ.', { fields: { email: 'Email không hợp lệ' } }, 422);
  if (!/^(0|\+84)\d{9}$/.test(payload.phone.replace(/\s/g, ''))) throw new ApiError('VALIDATION_ERROR', 'Số điện thoại không hợp lệ.', { fields: { phone: 'Số điện thoại không hợp lệ' } }, 422);
  if (payload.password.length < 8 || !/[A-Za-z]/.test(payload.password) || !/\d/.test(payload.password)) {
    throw new ApiError('VALIDATION_ERROR', 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.', { fields: { password: 'Mật khẩu chưa đủ mạnh' } }, 422);
  }
  const passwordHash = await hashPassword(payload.password);
  return mutateDb((db) => {
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throw new ApiError('VALIDATION_ERROR', 'Email này đã được sử dụng.', { fields: { email: 'Email đã tồn tại' } }, 422);
    }
    if (db.users.some((u) => u.phone === payload.phone)) {
      throw new ApiError('VALIDATION_ERROR', 'Số điện thoại này đã được sử dụng.', { fields: { phone: 'Số điện thoại đã tồn tại' } }, 422);
    }
    const user = {
      id: `u-${randomToken(8).toLowerCase()}`,
      name: payload.name.trim(),
      email,
      phone: payload.phone.trim(),
      passwordHash,
      role: 'customer' as const,
      permissions: [],
      cinemaIds: [],
      points: 0,
      tier: 'member' as const,
      emailVerified: false,
      status: 'active' as const,
      avatarSeed: Math.floor(Math.random() * 90) + 10,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    notify(db, user.id, 'Chào mừng đến PXU Cinema', 'Tài khoản của bạn đã được tạo. Hãy khám phá các phim đang chiếu!', 'system', '/phim');
    setActor(user.id);
    return toSessionUser(user);
  });
}

export async function updateProfile(payload: { name: string; phone: string; dob?: string }): Promise<SessionUser> {
  return mutateDb((db) => {
    const user = getActor(db);
    if (!payload.name.trim()) throw new ApiError('VALIDATION_ERROR', 'Vui lòng nhập họ tên.', { fields: { name: 'Bắt buộc' } }, 422);
    user.name = payload.name.trim();
    user.phone = payload.phone.trim();
    user.dob = payload.dob || user.dob;
    return toSessionUser(user);
  });
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
  const oldHash = await hashPassword(oldPassword);
  const newHash = await hashPassword(newPassword);
  return mutateDb((db) => {
    const user = getActor(db);
    if (user.passwordHash !== oldHash) {
      throw new ApiError('VALIDATION_ERROR', 'Mật khẩu hiện tại không đúng.', { fields: { oldPassword: 'Không đúng' } }, 422);
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      throw new ApiError('VALIDATION_ERROR', 'Mật khẩu mới tối thiểu 8 ký tự, gồm chữ và số.', { fields: { newPassword: 'Mật khẩu chưa đủ mạnh' } }, 422);
    }
    user.passwordHash = newHash;
    return { message: 'Đã đổi mật khẩu. Các phiên khác đã được thu hồi.' };
  });
}

export async function forgotPassword(email: string): Promise<{ message: string; demoToken?: string }> {
  const normalized = email.trim().toLowerCase();
  const db = await withDb((d) => d);
  const user = db.users.find((u) => u.email.toLowerCase() === normalized);
  const neutral = 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.';
  if (!user) return { message: neutral };
  const token = randomToken(20);
  resetTokens.set(token, { email: normalized, expiresAt: Date.now() + 30 * 60_000 });
  return { message: neutral, demoToken: token };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const entry = resetTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    throw new ApiError('VALIDATION_ERROR', 'Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.', {}, 422);
  }
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw new ApiError('VALIDATION_ERROR', 'Mật khẩu tối thiểu 8 ký tự, gồm chữ và số.', { fields: { password: 'Mật khẩu chưa đủ mạnh' } }, 422);
  }
  const passwordHash = await hashPassword(newPassword);
  await mutateDb((db) => {
    const user = db.users.find((u) => u.email.toLowerCase() === entry.email);
    if (!user) throw new ApiError('NOT_FOUND', 'Không tìm thấy tài khoản.', {}, 404);
    user.passwordHash = passwordHash;
    resetTokens.delete(token);
  });
  return { message: 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.' };
}

export async function resendVerification(): Promise<{ message: string }> {
  await withDb((db) => getActor(db));
  return { message: 'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư của bạn.' };
}

export async function markEmailVerified(): Promise<SessionUser> {
  return mutateDb((db) => {
    const user = getActor(db);
    user.emailVerified = true;
    return toSessionUser(user);
  });
}

export function getDemoAccounts() {
  return DEMO_ACCOUNTS;
}

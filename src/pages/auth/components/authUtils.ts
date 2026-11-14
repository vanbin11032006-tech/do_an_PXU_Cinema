import { errorCode } from '@/lib/errors';
import { isInternalPath } from '@/lib/format';
import type { SessionUser } from '@/types/domain';

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

export const PASSWORD_STRENGTH_LABELS = ['Chưa nhập', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'] as const;

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const PHONE_RE = /^(0|\+84)\d{9}$/;

/** Chỉ chấp nhận đường dẫn nội bộ, không nhận URL tuyệt đối hay `//host`. */
export function sanitizeReturnTo(value: string | null): string | null {
  if (!value || !isInternalPath(value)) return null;
  if (value === '/dang-nhap' || value.startsWith('/dang-nhap?') || value === '/dang-ky' || value.startsWith('/dang-ky?')) {
    return null;
  }
  return value;
}

/** Đích đến sau khi xác thực, ưu tiên khu vực theo vai trò. */
export function destinationFor(user: SessionUser, returnTo: string | null): string {
  if (user.role === 'admin' || user.role === 'manager') return '/admin';
  if (user.role === 'staff') return '/staff/quet-ve';
  return returnTo ?? '/';
}

/** Gợi ý xử lý cho các lỗi xác thực phổ biến (khóa tài khoản, giới hạn tần suất). */
export function authErrorHint(error: unknown): string | null {
  const code = errorCode(error);
  if (code === 'ACCOUNT_LOCKED') {
    return 'Tài khoản đang bị khóa hoặc chưa kích hoạt. Vui lòng liên hệ bộ phận chăm sóc khách hàng của PXU Cinema để được hỗ trợ.';
  }
  if (code === 'TOO_MANY_REQUESTS') {
    return 'Bạn đã thử quá nhiều lần. Vì lý do bảo mật, vui lòng đợi hết thời gian tạm khóa rồi đăng nhập lại.';
  }
  return null;
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function normalizePhone(value: string): string {
  return value.replace(/\s/g, '');
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(normalizePhone(value));
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'Tối thiểu 8 ký tự', ok: password.length >= 8 },
    { label: 'Có chữ cái', ok: /[A-Za-z]/.test(password) },
    { label: 'Có chữ số', ok: /\d/.test(password) },
    { label: 'Có ký tự đặc biệt', ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

/** Điều kiện tối thiểu mà mock API yêu cầu. */
export function isStrongEnough(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

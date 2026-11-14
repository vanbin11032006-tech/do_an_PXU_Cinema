const SECRET_KEY = /(password|passwd|secret|token|hash|otp|pin|cvv|authorization|api[_-]?key)/i;
const ACCOUNT_KEY = /(account[_-]?number|bank[_-]?account|card[_-]?number)/i;

function maskField(key: string, value: unknown): unknown {
  if (typeof value === 'string' && SECRET_KEY.test(key)) return value ? '••••••••' : value;
  if (typeof value === 'string' && ACCOUNT_KEY.test(key)) {
    if (value.length <= 4) return '••••';
    return `${value.slice(0, 2)}${'•'.repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`;
  }
  return maskSensitive(value);
}

/** Đệ quy che các trường nhạy cảm trước khi hiển thị nhật ký. */
export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) result[key] = maskField(key, item);
    return result;
  }
  return value;
}

export function prettyMasked(value: unknown): string {
  if (value === undefined || value === null) return '—';
  return JSON.stringify(maskSensitive(value), null, 2);
}

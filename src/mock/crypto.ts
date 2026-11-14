const AMBIGUOUS_FREE = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export async function sha256Hex(input: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 ^= input.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ input.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  return `fnv${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

export async function hashPassword(password: string): Promise<string> {
  return sha256Hex(`pxu-cinema::${password}`);
}

export function randomToken(length = 16): string {
  const bytes = new Uint32Array(Math.ceil(length / 8));
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length && out.length < length; i++) {
    let v = bytes[i];
    for (let j = 0; j < 8 && out.length < length; j++) {
      out += AMBIGUOUS_FREE[v % AMBIGUOUS_FREE.length];
      v = Math.floor(v / AMBIGUOUS_FREE.length);
    }
  }
  return out;
}

function shortDate(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

export function makeBookingCode(): string {
  return `PXU-${shortDate()}-${randomToken(6)}`;
}

export function makeTicketCode(): string {
  return `PXU${randomToken(26)}`;
}

export function makeRefundCode(): string {
  return `RF-${shortDate()}-${randomToken(4)}`;
}

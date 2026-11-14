import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const vndFormatter = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });

/** 85000 -> "85.000đ" */
export function money(value: number | null | undefined): string {
  return `${vndFormatter.format(Math.round(value ?? 0))}đ`;
}
/** 85000 -> "85.000" (no suffix) */
export function number(value: number | null | undefined): string {
  return vndFormatter.format(Math.round(value ?? 0));
}
export function compactMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${compactFormatter.format(value / 1_000_000_000)} tỷ`;
  if (Math.abs(value) >= 1_000_000) return `${compactFormatter.format(value / 1_000_000)} tr`;
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return String(value);
}
export function percent(value: number, of: number): number {
  if (!of) return 0;
  return Math.round((value / of) * 100);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;
/** ISO date / ISO timestamp -> dd/MM/yyyy (uses stored wall-clock, not machine TZ). */
export function formatDate(input: string | Date | undefined | null): string {
  if (!input) return '—';
  if (typeof input === 'string') {
    const m = input.match(DATE_RE);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
/** ISO timestamp -> HH:mm (Asia/Ho_Chi_Minh wall clock) */
export function formatTime(input: string | Date | undefined | null): string {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}
export function formatDateTime(input: string | undefined | null): string {
  if (!input) return '—';
  return `${formatDate(input)} ${formatTime(input)}`;
}
export function formatDateTimeShort(input: string | undefined | null): string {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${formatTime(d)} ${dd}/${mm}`;
}
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
export function weekdayShort(input: string): string {
  const m = input.match(DATE_RE);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return WEEKDAYS[d.getDay()];
}
export function relativeTime(input: string): string {
  const diff = Date.now() - new Date(input).getTime();
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ngày trước`;
  return formatDate(input);
}
export function countdownText(ms: number): string {
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  const shown = name.slice(0, 1);
  return `${shown}${'*'.repeat(Math.max(2, name.length - 1))}@${domain}`;
}
export function maskPhone(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}${'*'.repeat(phone.length - 6)}${phone.slice(-3)}`;
}
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}
export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
export function downloadBlob(content: string, filename: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob(['\ufeff', content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}
export function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}
export function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

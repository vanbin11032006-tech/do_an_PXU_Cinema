export const CINEMA_TZ_OFFSET = '+07:00';
export const CINEMA_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Current wall-clock time in Asia/Ho_Chi_Minh, expressed with local getters. */
export function cinemaNow(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CINEMA_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = read('hour') === 24 ? 0 : read('hour');
  return new Date(read('year'), read('month') - 1, read('day'), hour, read('minute'), read('second'));
}

/** YYYY-MM-DD in cinema local time. */
export function dateISO(d: Date = cinemaNow()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Calendar-day addition, independent of the machine timezone. */
export function addDaysISO(base: string, days: number): string {
  const [year, month, day] = base.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function showtimeStart(s: { showDate: string; startTime: string }): Date {
  const time = s.startTime.length === 5 ? s.startTime : s.startTime.slice(0, 5);
  return new Date(`${s.showDate}T${time}:00${CINEMA_TZ_OFFSET}`);
}
export function showtimeEnd(s: { showDate: string; endTime: string }): Date {
  const time = s.endTime.length === 5 ? s.endTime : s.endTime.slice(0, 5);
  return new Date(`${s.showDate}T${time}:00${CINEMA_TZ_OFFSET}`);
}
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
export function minutesToTime(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}
export function nowIso(): string {
  return new Date().toISOString();
}
export function isoAfterMinutes(mins: number): string {
  return new Date(Date.now() + mins * 60_000).toISOString();
}
export function dayOfWeek(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1)).getUTCDay();
}
export function isWeekend(iso: string): boolean {
  const d = dayOfWeek(iso);
  return d === 0 || d === 6;
}
export function ageInYears(dob: string): number {
  const birth = new Date(dob);
  const now = cinemaNow();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

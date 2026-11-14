export type Role = 'customer' | 'staff' | 'manager' | 'admin';

export type Permission =
  | 'dashboard.view'
  | 'movie.read' | 'movie.write' | 'movie.delete'
  | 'cinema.read' | 'cinema.write'
  | 'room.read' | 'room.write'
  | 'showtime.read' | 'showtime.write' | 'showtime.cancel'
  | 'pricing.read' | 'pricing.write'
  | 'combo.read' | 'combo.write' | 'inventory.write'
  | 'booking.read' | 'booking.cancel' | 'booking.change' | 'booking.resend'
  | 'payment.review'
  | 'payment.exception.manage'
  | 'refund.request' | 'refund.approve' | 'refund.process'
  | 'voucher.read' | 'voucher.write'
  | 'member.read' | 'member.adjust_points'
  | 'user.read' | 'user.write' | 'user.lock' | 'user.set_role'
  | 'paymentsetting.read' | 'paymentsetting.write'
  | 'content.write' | 'review.moderate'
  | 'report.view' | 'report.export'
  | 'audit.view'
  | 'setting.read' | 'setting.write'
  | 'checkin.override' | 'checkin.undo'
  | 'shift.manage';

export type UserStatus = 'active' | 'locked' | 'invited';
export type Tier = 'member' | 'silver' | 'gold' | 'diamond';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: Role;
  permissions: string[];
  cinemaIds: number[];
  points: number;
  tier: Tier;
  emailVerified: boolean;
  status: UserStatus;
  dob?: string;
  avatarSeed: number;
  createdAt: string;
  lastLoginAt?: string;
}

export type SessionUser = Omit<User, 'passwordHash'>;

export type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18';
export type MovieStatus = 'coming_soon' | 'now_showing' | 'ended';

export interface Movie {
  id: number;
  title: string;
  slug: string;
  description: string;
  director: string;
  cast: string[];
  genres: string[];
  duration: number;
  releaseDate: string;
  language: string;
  age: AgeRating;
  trailerId?: string;
  posterUrl?: string;
  backdropUrl?: string;
  rating: number;
  status: MovieStatus;
  featured: boolean;
  art: { from: string; via: string; to: string; accent: string };
  tagline: string;
  deletedAt?: string;
  createdAt: string;
}

export type RoomType = '2D' | '3D' | 'IMAX' | '4DX' | 'Gold Class';
export type RoomStatus = 'active' | 'maintenance';
export interface Cinema {
  id: number; name: string; address: string; city: string; hotline: string; imageUrl?: string; imageTone: string;
}
export interface Room {
  id: number; cinemaId: number; name: string; type: RoomType; status: RoomStatus;
}
export type SeatType = 'standard' | 'vip' | 'couple' | 'aisle' | 'blank' | 'disabled';
export interface Seat {
  id: number;
  roomId: number;
  code: string;
  row: string;
  col: number;
  x: number;
  y: number;
  span: number;
  type: SeatType;
}
export type SeatLiveStatus = 'available' | 'held' | 'sold' | 'disabled';

export type ShowtimeStatus = 'scheduled' | 'selling' | 'closed' | 'finished' | 'cancelled';
export interface Showtime {
  id: number;
  movieId: number;
  roomId: number;
  cinemaId: number;
  showDate: string;
  startTime: string;
  endTime: string;
  format: string;
  basePrice: number;
  status: ShowtimeStatus;
  blockedSeatIds: number[];
  createdAt: string;
}

export type BookingStatus = 'holding' | 'confirmed' | 'completed' | 'expired' | 'cancelled';
export type PaymentStatus =
  | 'pending' | 'proof_submitted' | 'paid' | 'rejected' | 'expired'
  | 'failed' | 'cancelled' | 'partially_refunded' | 'refunded';
export type PaymentMethod = 'bank_qr' | 'cash' | 'card' | 'mixed';
export type PaymentProvider = 'bank_qr' | 'vnpay' | 'momo' | 'zalopay' | 'cash' | 'card';

export interface BookingSeat {
  seatId: number;
  code: string;
  type: SeatType;
  price: number;
  active: boolean;
}
export interface BookingCombo {
  comboId: number;
  name: string;
  price: number;
  quantity: number;
}
export interface Booking {
  id: number;
  code: string;
  userId: string | null;
  cinemaId: number;
  showtimeId: number;
  channel: 'online' | 'pos';
  staffId?: string;
  shiftId?: string;
  status: BookingStatus;
  seats: BookingSeat[];
  combos: BookingCombo[];
  ticketsSubtotal: number;
  combosSubtotal: number;
  discount: number;
  pointsUsed: number;
  pointsDiscount: number;
  taxAmount: number;
  finalAmount: number;
  voucherCode?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  holdExpiresAt: string;
  holdExtended: boolean;
  confirmedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  comboPickedUpAt?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: number;
  bookingId: number;
  provider: PaymentProvider;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  providerTxnId?: string;
  transferContent: string;
  proofUrl?: string;
  proofHash?: string;
  paidAmount?: number;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReasonCode?: string;
  rejectNote?: string;
  paidAt?: string;
  reference?: string;
  createdAt: string;
}

export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'expired';
export interface Ticket {
  id: number;
  bookingId: number;
  seatId: number;
  seatCode: string;
  code: string;
  status: TicketStatus;
  issuedAt: string;
  checkedInAt?: string;
  checkedInBy?: string;
  checkedInCinemaId?: number;
}
export type CheckinResult =
  | 'OK' | 'ALREADY_USED' | 'TOO_EARLY' | 'TOO_LATE' | 'NOT_FOUND'
  | 'NOT_PAID' | 'CANCELLED' | 'WRONG_CINEMA' | 'ID_CHECK_REQUIRED';
export interface CheckinLog {
  id: number;
  ticketCode: string;
  result: CheckinResult;
  staffId: string;
  staffName: string;
  cinemaId: number;
  showtimeId?: number;
  at: string;
  note?: string;
}

export interface Combo {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'combo' | 'popcorn' | 'drink' | 'snack';
  stock: number;
  maxPerOrder: number;
  status: 'active' | 'hidden';
  art: { from: string; to: string; emoji: string; imageUrl?: string };
  sold: number;
}

export type VoucherType = 'percent' | 'fixed';
export interface Voucher {
  id: number;
  code: string;
  label: string;
  type: VoucherType;
  value: number;
  minOrder: number;
  maxDiscount: number;
  startsAt: string;
  expiresAt: string;
  totalUses: number;
  usedCount: number;
  perUser: number;
  applyTo: 'tickets' | 'all';
  status: 'active' | 'paused';
  createdAt: string;
}
export interface VoucherUsage {
  id: number; voucherCode: string; bookingId: number; userId: string; discount: number; at: string; reverted?: boolean;
}

export type RefundStatus = 'requested' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed';
export interface Refund {
  id: number;
  code: string;
  bookingId: number;
  scope: 'full' | 'partial';
  seatIds: number[];
  amount: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  approvedBy?: string;
  reference?: string;
  note?: string;
  createdAt: string;
  completedAt?: string;
}

export interface PaymentException {
  id: number;
  amount: number;
  content: string;
  receivedAt: string;
  bankRef: string;
  status: 'open' | 'resolved';
  action?: 'link' | 'restore' | 'refund' | 'ignore';
  note?: string;
  resolvedBy?: string;
}

export interface AuditLog {
  id: number;
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip: string;
  reason?: string;
}

export interface Shift {
  id: number;
  staffId: string;
  staffName: string;
  cinemaId: number;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  countedCash?: number;
  expectedCash?: number;
  difference?: number;
  totalSales: number;
  transactions: number;
  status: 'open' | 'closed';
  note?: string;
}

export interface PriceRule {
  id: number;
  dayType: 'weekday' | 'weekend' | 'holiday';
  slot: 'early' | 'day' | 'prime' | 'late';
  roomType: RoomType;
  price: number;
  active: boolean;
}
export interface SeatSurcharge {
  standard: number; vip: number; couple: number;
}

export interface AppSettings {
  cinemaName: string;
  hotline: string;
  email: string;
  address: string;
  holdMinutes: number;
  holdExtendMinutes: number;
  proofPendingMaxMinutes: number;
  maxSeatsPerBooking: number;
  maxActiveHoldsPerUser: number;
  onlineCloseBeforeMinutes: number;
  posCloseBeforeMinutes: number;
  roomCleaningMinutes: number;
  adsMinutes: number;
  checkinOpenBeforeMinutes: number;
  checkinLateAllowMinutes: number;
  customerCancelAllowed: boolean;
  customerCancelBeforeHours: number;
  customerRefundPercent: number;
  pointsPerVnd: number;
  vatPercent: number;
  priceRounding: number;
  paymentConfirmMode: 'manual' | 'auto';
  receiptMaxMb: number;
  loginMaxAttempts: number;
  refundApprovalThreshold: number;
  ticketCodeSecret: string;
  seatSurcharge: SeatSurcharge;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  transferPrefix: string;
  useCustomQr: boolean;
  customQrUrl?: string;
  webhookSecretHint: string;
}

export interface Notification {
  id: number; userId: string; title: string; body: string;
  type: 'booking' | 'payment' | 'system' | 'promo';
  read: boolean; createdAt: string; link?: string;
}
export interface Banner {
  id: number; title: string; subtitle: string; movieId?: number;
  ctaLabel: string; active: boolean; order: number; tone: { from: string; to: string; accent: string };
}
export interface News {
  id: number; title: string; slug: string; excerpt: string; body: string;
  imageUrl?: string; imageTone: string; tag: string; publishedAt: string; status: 'published' | 'draft';
}
export interface Review {
  id: number; movieId: number; userId: string; userName: string; rating: number;
  comment: string; visible: boolean; createdAt: string;
}
export interface MembershipTier {
  key: Tier; label: string; minSpend: number; perks: string[]; color: string;
}
export interface PointTransaction {
  id: number; userId: string; type: 'earn' | 'redeem' | 'adjust' | 'refund_revert' | 'expire';
  points: number; reason: string; at: string; bookingCode?: string;
}
export interface Favorite { userId: string; movieId: number; }
export interface StaticPage { slug: string; title: string; body: string; }

export interface Database {
  version: number;
  seededAt: string;
  users: User[];
  movies: Movie[];
  cinemas: Cinema[];
  rooms: Room[];
  seats: Seat[];
  showtimes: Showtime[];
  bookings: Booking[];
  payments: Payment[];
  tickets: Ticket[];
  combos: Combo[];
  vouchers: Voucher[];
  voucherUsages: VoucherUsage[];
  refunds: Refund[];
  exceptions: PaymentException[];
  auditLogs: AuditLog[];
  shifts: Shift[];
  priceRules: PriceRule[];
  settings: AppSettings;
  notifications: Notification[];
  banners: Banner[];
  news: News[];
  reviews: Review[];
  tiers: MembershipTier[];
  pointTransactions: PointTransaction[];
  checkinLogs: CheckinLog[];
  favorites: Favorite[];
  pages: StaticPage[];
}

export interface Paged<T> { items: T[]; total: number; page: number; perPage: number; }

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status?: number;
}

export class ApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  status: number;
  constructor(code: string, message: string, details?: Record<string, unknown>, status = 400) {
    super(message);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export interface Totals {
  ticketsSubtotal: number;
  combosSubtotal: number;
  discount: number;
  pointsDiscount: number;
  taxAmount: number;
  finalAmount: number;
}

export interface SeatView {
  id: number; code: string; row: string; col: number; x: number; y: number; span: number;
  type: SeatType; price: number; status: SeatLiveStatus; mine: boolean;
}
export interface ShowtimeSeatMap {
  showtime: Showtime;
  movie: Movie;
  room: Room;
  cinema: Cinema;
  grid: { rows: number; cols: number };
  seats: SeatView[];
  maxSeats: number;
  serverTime: string;
}

export interface BookingDetail extends Booking {
  showtime: Showtime;
  movie: Movie;
  room: Room;
  cinema: Cinema;
  payments: Payment[];
  tickets: Ticket[];
  serverTime: string;
  holdDeadline?: string;
}

export type OrderActionKey =
  | 'approve' | 'reject' | 'cancel' | 'refund' | 'resend' | 'changeSeats'
  | 'reschedule' | 'restore' | 'undoCheckin' | 'print';

export interface RolePermissionMatrix { role: Role; permissions: string[] }

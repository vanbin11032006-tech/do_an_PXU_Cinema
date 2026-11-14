type EngineModule = typeof import('@/mock');
import type { CheckinResult, Refund, User } from '@/types/domain';
import { clearSessionToken, getSessionToken, rpc } from './rpc';

/** Gọi engine nghiệp vụ chạy trên API server (xem `server/`). */
function call<K extends keyof EngineModule & string>(name: K): EngineModule[K] {
  return ((...args: unknown[]) => rpc(name, args)) as EngineModule[K];
}

export const addOrderNote = call('addOrderNote');
export const adjustComboStock = call('adjustComboStock');
export const adjustMemberPoints = call('adjustMemberPoints');
export const adminListMovies = call('adminListMovies');
export const applyVoucher = call('applyVoucher');
export const approvePayment = call('approvePayment');
export const approveRefund = call('approveRefund');
export const assertCinemaAccess = call('assertCinemaAccess');
export const bulkCreateShowtimes = call('bulkCreateShowtimes');
export const canReviewMovie = call('canReviewMovie');
export const cancelHolding = call('cancelHolding');
export const cancelOrder = call('cancelOrder');
export const cancelShowtime = call('cancelShowtime');
export const changeOrderSeats = call('changeOrderSeats');
export const changePassword = call('changePassword');
export const changeUserRole = call('changeUserRole');
export const checkin = call('checkin');
export const checkinBooking = call('checkinBooking');
export const checkinStats = call('checkinStats');
export const cinemaNameFor = call('cinemaNameFor');
export const cinemaScopeForActor = call('cinemaScopeForActor');
export const closeShift = call('closeShift');
export const completePayment = call('completePayment');
export const completeRefund = call('completeRefund');
export const confirmBooking = call('confirmBooking');
export const confirmComboPickup = call('confirmComboPickup');
export const createBooking = call('createBooking');
export const createRefund = call('createRefund');
export const createShowtime = call('createShowtime');
export const createStaffUser = call('createStaffUser');
export const currentShift = call('currentShift');
export const deleteBanner = call('deleteBanner');
export const deleteMovie = call('deleteMovie');
export const exportReport = call('exportReport');
export const extendHold = call('extendHold');
export const forgotPassword = call('forgotPassword');
export const generateRoomSeats = call('generateRoomSeats');
export const getAdminAlerts = call('getAdminAlerts');
export const getAdminBadges = call('getAdminBadges');
export const getBooking = call('getBooking');
export const getChannelBreakdown = call('getChannelBreakdown');
export const getCinema = call('getCinema');
export const getDashboardSummary = call('getDashboardSummary');
export const getMovie = call('getMovie');
export const getMovieById = call('getMovieById');
export const getMyHolding = call('getMyHolding');
export const getNews = call('getNews');
export const getNotificationTemplateList = call('getNotificationTemplateList');
export const getOrderDetail = call('getOrderDetail');
export const getPaymentInfo = call('getPaymentInfo');
export const getPaymentSettings = call('getPaymentSettings');
export const getPointsSummary = call('getPointsSummary');
export const getPublicSettings = call('getPublicSettings');
export const getReport = call('getReport');
export const getRevenueSeries = call('getRevenueSeries');
export const getRoomSeats = call('getRoomSeats');
export const getSettings = call('getSettings');
export const getShowtime = call('getShowtime');
export const getShowtimeSeats = call('getShowtimeSeats');
export const getStaticPage = call('getStaticPage');
export const getTicketByCode = call('getTicketByCode');
export const getTopMovies = call('getTopMovies');
export const getUpcomingShowtimes = call('getUpcomingShowtimes');
export const isFavorite = call('isFavorite');
export const listAuditLogs = call('listAuditLogs');
export const listAvailableVouchers = call('listAvailableVouchers');
export const listBanners = call('listBanners');
export const listBannersAdmin = call('listBannersAdmin');
export const listCinemas = call('listCinemas');
export const listCinemasAdmin = call('listCinemasAdmin');
export const listCombos = call('listCombos');
export const listCombosAdmin = call('listCombosAdmin');
export const listFavorites = call('listFavorites');
export const listGenres = call('listGenres');
export const listMembers = call('listMembers');
export const listMembershipTiers = call('listMembershipTiers');
export const listMovieReviews = call('listMovieReviews');
export const listMovies = call('listMovies');
export const listNews = call('listNews');
export const listNewsAdmin = call('listNewsAdmin');
export const listNotifications = call('listNotifications');
export const listOrders = call('listOrders');
export const listPaymentExceptions = call('listPaymentExceptions');
export const listPriceRules = call('listPriceRules');
export const listReceiptQueue = call('listReceiptQueue');
export const listRefunds = call('listRefunds');
export const listReviewsAdmin = call('listReviewsAdmin');
export const listRooms = call('listRooms');
export const listShowtimes = call('listShowtimes');
export const listShowtimesAdmin = call('listShowtimesAdmin');
export const listUsers = call('listUsers');
export const listVouchers = call('listVouchers');
export const lockUser = call('lockUser');
export const login = call('login');
export const markEmailVerified = call('markEmailVerified');
export const markNotificationsRead = call('markNotificationsRead');
export const me = call('me');
export const myBookings = call('myBookings');
export const openShift = call('openShift');
export const posCreateBooking = call('posCreateBooking');
export const posPay = call('posPay');
export const recentCheckins = call('recentCheckins');
export const redeemPoints = call('redeemPoints');
export const register = call('register');
export const rejectPayment = call('rejectPayment');
export const rejectRefund = call('rejectRefund');
export const removeVoucher = call('removeVoucher');
export const reprintTicket = call('reprintTicket');
export const requireStaffAccess = call('requireStaffAccess');
export const resendTicketsEmail = call('resendTicketsEmail');
export const resendVerification = call('resendVerification');
export const resetPassword = call('resetPassword');
export const resolvePaymentException = call('resolvePaymentException');
export const saveBanner = call('saveBanner');
export const saveCinema = call('saveCinema');
export const saveCombo = call('saveCombo');
export const saveMembershipTiers = call('saveMembershipTiers');
export const saveMovie = call('saveMovie');
export const saveNews = call('saveNews');
export const savePaymentSettings = call('savePaymentSettings');
export const savePriceRules = call('savePriceRules');
export const saveRoom = call('saveRoom');
export const saveSeatLayout = call('saveSeatLayout');
export const saveSettings = call('saveSettings');
export const saveVoucher = call('saveVoucher');
export const searchEverything = call('searchEverything');
export const sendContactMessage = call('sendContactMessage');
export const sendUserPasswordReset = call('sendUserPasswordReset');
export const setBlockedSeats = call('setBlockedSeats');
export const setMovieStatus = call('setMovieStatus');
export const setReviewVisibility = call('setReviewVisibility');
export const showtimeImpact = call('showtimeImpact');
export const simulatePrice = call('simulatePrice');
export const staffCurrentShowtimes = call('staffCurrentShowtimes');
export const staffTodayBookings = call('staffTodayBookings');
export const submitPaymentProof = call('submitPaymentProof');
export const submitReview = call('submitReview');
export const testQr = call('testQr');
export const ticketsForBooking = call('ticketsForBooking');
export const toggleFavorite = call('toggleFavorite');
export const undoCheckin = call('undoCheckin');
export const unreadNotificationCount = call('unreadNotificationCount');
export const updateBookingCombos = call('updateBookingCombos');
export const updateBookingSeats = call('updateBookingSeats');
export const updateContact = call('updateContact');
export const updateProfile = call('updateProfile');
export const updateShowtime = call('updateShowtime');
export const validateShowtime = call('validateShowtime');
export const voucherUsages = call('voucherUsages');

export async function logout(): Promise<void> {
  const token = getSessionToken();
  try {
    await rpc('logout', []);
  } finally {
    if (getSessionToken() === token) clearSessionToken();
  }
}

export const DEMO_ACCOUNTS = [
  { email: 'khach@pxu.vn', password: 'Khach@123', role: 'customer', label: 'Khách hàng', name: 'Nguyễn Minh Anh' },
  { email: 'staff@pxu.vn', password: 'Staff@123', role: 'staff', label: 'Nhân viên', name: 'Trần Quốc Huy' },
  { email: 'manager@pxu.vn', password: 'Manager@123', role: 'manager', label: 'Quản lý', name: 'Lê Thu Hà' },
  { email: 'admin@pxu.vn', password: 'Admin@123', role: 'admin', label: 'Quản trị', name: 'Phạm Gia Bảo' },
] as const;

export const rejectionReasons = ['unclear_proof', 'wrong_amount', 'wrong_content', 'not_received', 'other'] as const;

export function can(user: Pick<User, 'role' | 'permissions'> | null, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.permissions.includes('*')) return true;
  return user.permissions.includes(permission)
    || user.permissions.some((p) => p.endsWith('.*') && permission.startsWith(p.slice(0, -1)));
}

export function refundStatusLabel(status: Refund['status']): string {
  const map: Record<Refund['status'], string> = {
    requested: 'Chờ duyệt', approved: 'Đã duyệt', processing: 'Đang xử lý',
    completed: 'Hoàn tất', rejected: 'Từ chối', failed: 'Thất bại',
  };
  return map[status];
}

export function explainResult(result: CheckinResult): string {
  const map: Record<CheckinResult, string> = {
    OK: 'Hợp lệ',
    ALREADY_USED: 'Đã sử dụng',
    TOO_EARLY: 'Chưa đến giờ',
    TOO_LATE: 'Quá giờ',
    NOT_FOUND: 'Không tồn tại',
    NOT_PAID: 'Chưa thanh toán',
    CANCELLED: 'Đã hủy',
    WRONG_CINEMA: 'Sai rạp / suất',
    ID_CHECK_REQUIRED: 'Cần kiểm tra giấy tờ',
  };
  return map[result];
}

export type {
  BulkPreviewRow, CheckinResponse, MemberRow, MovieInput, MovieQuery, OrderRow, PaymentSettings, ReceiptQueueItem, RefundRow, ReportResult, SeatLayoutCell, ShowtimePublic
} from '@/mock';

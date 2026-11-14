import type {
  AppSettings, Booking, BookingSeat, Cinema, Combo, Database,
  MembershipTier, Movie, Payment,
  PriceRule, Room, Seat, SeatType, Shift, Showtime, Ticket, User, Voucher,
} from '@/types/domain';
import { addDaysISO, cinemaNow, dateISO, minutesToTime, showtimeStart, timeToMinutes } from '@/lib/datetime';
import { basePriceFor, includedTax, seatPrice } from './pricing';
import { hashPassword, makeBookingCode, makeRefundCode, makeTicketCode, randomToken } from './crypto';
import { makeReceiptDataUrl } from './receiptArt';
import { MOVIE_MEDIA } from './movieMedia';

const DB_KEY = 'pxu.cinema.db.v3';
const DB_VERSION = 11;

export interface DbBackend {
  load: () => Promise<Database | null>;
  save: (db: Database) => Promise<void>;
  clear: () => Promise<void>;
}

let backend: DbBackend | null = null;
let cache: Database | null = null;
let loading: Promise<Database> | null = null;

/**
 * Gắn backend lưu trữ (MySQL khi chạy API server). Không gọi trong trình duyệt.
 * Đặt `null` để quay lại localStorage.
 */
export function setDbBackend(next: DbBackend | null): void {
  backend = next;
  cache = null;
  loading = null;
}

/** Buộc lần đọc kế tiếp tải lại từ backend (dùng khi ghi DB thất bại). */
export function invalidateDbCache(): void {
  cache = null;
  loading = null;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261026);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
const randInt = (min: number, max: number): number => Math.floor(rng() * (max - min + 1)) + min;

async function persist(db: Database): Promise<void> {
  cache = db;
  if (backend) {
    await backend.save(db);
    return;
  }
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('[PXU] Không thể lưu mock database vào localStorage', err);
  }
}

async function loadPersisted(): Promise<Database | null> {
  if (backend) return backend.load();
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    /* corrupt storage -> reseed */
  }
  return null;
}

export async function ensureDb(): Promise<Database> {
  if (cache) return cache;
  if (loading) return loading;
  loading = (async () => {
    const persisted = await loadPersisted();
    if (persisted && persisted.version === DB_VERSION) {
      cache = persisted;
      return persisted;
    }
    const seeded = await seedDb();
    await persist(seeded);
    return seeded;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

export async function writeDb(mutator: (db: Database) => void): Promise<Database> {
  const db = await ensureDb();
  mutator(db);
  cache = db;
  try {
    await persist(db);
  } catch (err) {
    invalidateDbCache();
    throw err;
  }
  return db;
}

export async function resetDb(): Promise<Database> {
  if (backend) {
    await backend.clear();
  } else {
    localStorage.removeItem(DB_KEY);
  }
  cache = null;
  loading = null;
  return ensureDb();
}

export function peekDb(): Database | null {
  return cache;
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

const MANAGER_PERMISSIONS = [
  'dashboard.view',
  'movie.read', 'movie.write',
  'cinema.read', 'cinema.write',
  'room.read', 'room.write',
  'showtime.read', 'showtime.write', 'showtime.cancel',
  'pricing.read', 'pricing.write',
  'combo.read', 'combo.write', 'inventory.write',
  'booking.read', 'booking.cancel', 'booking.change', 'booking.resend',
  'payment.review', 'payment.exception.manage',
  'refund.request', 'refund.approve', 'refund.process',
  'voucher.read', 'voucher.write',
  'member.read', 'member.adjust_points',
  'user.read', 'user.lock',
  'paymentsetting.read',
  'content.write', 'review.moderate',
  'report.view', 'report.export',
  'audit.view',
  'setting.read',
  'checkin.override', 'checkin.undo',
  'shift.manage',
];

function createSeats(): Omit<Seat, 'id' | 'roomId'>[] {
  const out: Omit<Seat, 'id' | 'roomId'>[] = [];
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  for (const [y, row] of rows.entries()) {
    for (let col = 1; col <= 14; col++) {
      const type: SeatType = row === 'E' || row === 'F' ? 'vip' : 'standard';
      const x = col - 1 + (col > 3 ? 1 : 0) + (col > 11 ? 1 : 0);
      out.push({ code: `${row}${String(col).padStart(2, '0')}`, row, col, x, y, span: 1, type });
    }
  }
  for (let i = 0; i < 6; i++) {
    const startCol = i * 2 + 1;
    out.push({
      code: `H${String(startCol).padStart(2, '0')}-H${String(startCol + 1).padStart(2, '0')}`,
      row: 'H', col: startCol, x: startCol, y: 7, span: 2, type: 'couple',
    });
  }
  return out;
}

function makeMovies(): Omit<Movie, 'id' | 'createdAt'>[] {
  const movies: Omit<Movie, 'id' | 'createdAt'>[] = [
    {
      title: 'Hai Phượng', slug: 'hai-phuong',
      tagline: 'Một người mẹ, một mình chống cả thế giới.',
      description: 'Hai Phượng kể về hành trình đầy gay cấn của người mẹ vùng quê tìm cách cứu con khỏi đường dây bắt cóc khổng lồ. Không một tấc sắt trong tay, người phụ nữ thân cô thế cô phải chống lại bọn xã hội đen tàn ác để giành lại nguồn sống của đời mình.',
      director: 'Lê Văn Kiệt', cast: ['Ngô Thanh Vân', 'Phan Thanh Nhiên', 'Phạm Anh Khoa', 'Thanh Hoa', 'Mai Cát Vi'],
      genres: ['Hành động', 'Võ thuật', 'Giật gân', 'Chính kịch'], duration: 100, releaseDate: addDaysISO(dateISO(), -21),
      language: 'Tiếng Việt', age: 'T16', rating: 6.6, status: 'now_showing', featured: true,
      art: { from: '#f97316', via: '#7c2d12', to: '#0c0a09', accent: '#fed7aa' },
    },
    {
      title: 'Đào, Phở và Piano', slug: 'dao-pho-va-piano',
      tagline: 'Hà Nội 60 ngày đêm, tình yêu giữa bom đạn.',
      description: 'Lấy bối cảnh 60 ngày đêm cuối năm 1946 đầu năm 1947 ở Hà Nội, phim theo chân chàng dân quân Văn Dân và nàng tiểu thư đam mê dương cầm Thục Hương. Giữa bom đạn, họ quyết định cố thủ lại thủ đô đã tan hoang thay vì di tản lên chiến khu.',
      director: 'Phi Tiến Sơn', cast: ['Cao Thị Thuỳ Linh', 'Doãn Quốc Đam', 'Trần Lực', 'Trung Hiếu', 'Tuấn Hưng'],
      genres: ['Lịch sử', 'Chiến tranh', 'Tình cảm', 'Chính kịch'], duration: 100, releaseDate: addDaysISO(dateISO(), -30),
      language: 'Tiếng Việt – Phụ đề Anh', age: 'T13', rating: 6.3, status: 'now_showing', featured: false,
      art: { from: '#f59e0b', via: '#78350f', to: '#1c1917', accent: '#fde68a' },
    },
    {
      title: 'Mai', slug: 'mai',
      tagline: 'Có những người sinh ra để yêu thương, không phải để giữ lại.',
      description: 'Mai là người phụ nữ từng trải, mang trong mình nhiều vết thương. Cuộc gặp gỡ với Dương – chàng trai trẻ giàu cảm xúc – mở ra một chương mới nhưng cũng đặt cả hai trước những lựa chọn nghiệt ngã.',
      director: 'Trấn Thành', cast: ['Phương Anh Đào', 'Tuấn Trần', 'Hồng Đào', 'NSND Ngọc Giàu'],
      genres: ['Tâm lý', 'Tình cảm', 'Gia đình'], duration: 131, releaseDate: addDaysISO(dateISO(), -18),
      language: 'Tiếng Việt', age: 'T16', rating: 7.9, status: 'now_showing', featured: true,
      art: { from: '#f472b6', via: '#9d174d', to: '#1e1b4b', accent: '#fbcfe8' },
    },
    {
      title: 'Lật Mặt 7: Một Điều Ước', slug: 'lat-mat-7-mot-dieu-uoc',
      tagline: 'Một điều ước, cả gia đình thay đổi.',
      description: 'Câu chuyện về bà Hai và năm người con với những toan tính, hiểu lầm và tình thương bị che khuất. Một biến cố khiến cả gia đình phải ngồi lại và nhìn nhau thật lòng.',
      director: 'Lý Hải', cast: ['Lý Hải', 'Minh Hà', 'Trường Thịnh', 'Quách Ngọc Tuyên'],
      genres: ['Gia đình', 'Tâm lý', 'Hài'], duration: 138, releaseDate: addDaysISO(dateISO(), -25),
      language: 'Tiếng Việt', age: 'T13', rating: 7.5, status: 'now_showing', featured: false,
      art: { from: '#fbbf24', via: '#b45309', to: '#422006', accent: '#fef3c7' },
    },
    {
      title: 'Trạng Tí Phiêu Lưu Ký', slug: 'trang-ti-phieu-luu-ky',
      tagline: 'Bốn đứa trẻ, một hành trình không tưởng.',
      description: 'Chuyến phiêu lưu ngoài sức tưởng tượng của bộ tứ Tí – Sửu – Dần – Mẹo khi cả nhóm phải vượt qua nhiều thử thách để khám phá bí ẩn về cha Tí. Trên hành trình, bốn đứa trẻ bị sơn tặc bắt cóc và buộc phải đối đầu với một âm mưu không thể lường trước.',
      director: 'Phan Gia Nhật Linh', cast: ['Huỳnh Hữu Khang', 'Mona Bảo Tiên', 'Vương Hoàng Long', 'Trần Đức Anh', 'Trung Dân'],
      genres: ['Phiêu lưu', 'Giả tượng', 'Gia đình', 'Hài'], duration: 110, releaseDate: addDaysISO(dateISO(), -12),
      language: 'Tiếng Việt', age: 'P', rating: 7.0, status: 'now_showing', featured: true,
      art: { from: '#facc15', via: '#a16207', to: '#1c1917', accent: '#fef9c3' },
    },
    {
      title: 'Chuyện Ma Gần Nhà', slug: 'chuyen-ma-gan-nha',
      tagline: 'Chuyện ma ở ngay cạnh nhà.',
      description: 'Tác phẩm đầu tiên trong vũ trụ kinh dị Việt Nam, lấy cảm hứng từ những truyền thuyết đô thị và câu chuyện ma trong dân gian. Phim mang màu sắc u ám, quỷ dị, đan cài văn hoá và tín ngưỡng của người Việt vào từng khung hình.',
      director: 'Trần Hữu Tấn', cast: ['Khả Như', 'Mạc Can', 'Vân Trang', 'Thanh Trực', 'Lê Bê La'],
      genres: ['Kinh dị', 'Giật gân', 'Bí ẩn'], duration: 110, releaseDate: addDaysISO(dateISO(), -16),
      language: 'Tiếng Việt', age: 'T16', rating: 5.5, status: 'now_showing', featured: true,
      art: { from: '#22d3ee', via: '#0e7490', to: '#020617', accent: '#a5f3fc' },
    },
    {
      title: 'Lôi Báo', slug: 'loi-bao',
      tagline: 'Đổi thân xác, đổi cả số phận.',
      description: 'Tâm là một hoạ sĩ truyện tranh có cuộc sống hạnh phúc bên vợ và con trai. Khi phát hiện mình bị ung thư phổi giai đoạn cuối, anh nhận lời đổi đầu sang một cơ thể mới. Sau ca phẫu thuật, anh không chỉ khỏi bệnh mà còn sở hữu năng lực phi thường.',
      director: 'Victor Vũ', cast: ['Cường Seven', 'Nhã Phương', 'Simba A Pù', 'Hoàng Sơn', 'Quách Ngọc Ngoan'],
      genres: ['Hành động', 'Khoa học viễn tưởng', 'Phiêu lưu', 'Chính kịch'], duration: 90, releaseDate: addDaysISO(dateISO(), -20),
      language: 'Tiếng Việt', age: 'T13', rating: 5.3, status: 'now_showing', featured: false,
      art: { from: '#38bdf8', via: '#1d4ed8', to: '#020617', accent: '#bae6fd' },
    },
    {
      title: 'Wolfoo và Hòn Đảo Kỳ Bí', slug: 'wolfoo-hon-dao-ky-bi',
      tagline: 'Lạc vào Linh Giới, tìm em bằng mọi giá.',
      description: 'Wolfoo 8 tuổi và em gái Lucy bị hút vào một chiếc dây chuyền, lạc đến Linh Giới – thế giới kỳ diệu nơi hai anh em bị chia tách. Trong hành trình tìm em, Wolfoo bị cuốn vào cuộc chiến chống lại binh đoàn quỷ dữ do chú quỷ Bane cai trị.',
      director: 'Phan Thị Thơ', cast: ['Sony Minh Hiếu', 'Đạt Phi', 'Như Ý'],
      genres: ['Hoạt hình', 'Phiêu lưu', 'Giả tượng', 'Gia đình'], duration: 100, releaseDate: addDaysISO(dateISO(), -10),
      language: 'Tiếng Việt', age: 'P', rating: 0, status: 'now_showing', featured: false,
      art: { from: '#4ade80', via: '#15803d', to: '#052e16', accent: '#dcfce7' },
    },
    {
      title: 'Nhà Bà Nữ', slug: 'nha-ba-nu',
      tagline: 'Ai cũng có lỗi, nhưng ai cũng nghĩ mình là nạn nhân.',
      description: 'Ba thế hệ gia đình bà Nữ sống chung trong một ngôi nhà. Bà Nữ một tay cáng đáng mọi việc, nổi tiếng với quán bánh canh cua và khét tiếng kiểm soát cuộc sống của con cái. Mọi thứ thay đổi khi cô con gái út si mê một chàng trai nhà giàu.',
      director: 'Trấn Thành', cast: ['Uyển Ân', 'Song Luân', 'Lê Giang', 'Khả Như', 'Trấn Thành'],
      genres: ['Hài', 'Gia đình', 'Chính kịch', 'Tâm lý'], duration: 103, releaseDate: addDaysISO(dateISO(), -8),
      language: 'Tiếng Việt', age: 'T13', rating: 6.0, status: 'now_showing', featured: false,
      art: { from: '#fb7185', via: '#9f1239', to: '#1f0a12', accent: '#fecdd3' },
    },
    {
      title: 'Mắt Biếc', slug: 'mat-biec',
      tagline: 'Mối tình đi qua cả thanh xuân.',
      description: 'Mối tình đơn phương của Ngạn dành cho Hà Lan – cô bạn có đôi mắt hút hồn nhưng cá tính bướng bỉnh. Từ ngộ nghĩnh trẻ con đến tình yêu thuở học trò trong sáng, rồi bao biến cố, câu chuyện trở thành một cuộc "đuổi hình bắt bóng" buồn da diết nhưng không nguôi hi vọng.',
      director: 'Victor Vũ', cast: ['Trần Nghĩa', 'Trúc Anh', 'Trần Phong', 'Khánh Vân'],
      genres: ['Tình cảm', 'Chính kịch', 'Tâm lý'], duration: 117, releaseDate: addDaysISO(dateISO(), 12),
      language: 'Tiếng Việt', age: 'T16', rating: 6.7, status: 'coming_soon', featured: false,
      art: { from: '#4ade80', via: '#166534', to: '#052e16', accent: '#dcfce7' },
    },
    {
      title: 'Bố Già', slug: 'bo-gia',
      tagline: 'Một người cha, cả một gia đình.',
      description: 'Ba Sang một mình nuôi hai con Quắn và Bù Tọt trong xóm lao động nghèo Sài Gòn. Những hiểu lầm, mâu thuẫn và tình thương bị che khuất dần lộ ra sau biến cố, buộc cả gia đình phải nhìn lại nhau.',
      director: 'Trấn Thành', cast: ['Trấn Thành', 'Tuấn Trần', 'Ngân Chi', 'Ngọc Giàu', 'Lê Giang'],
      genres: ['Hài', 'Gia đình', 'Chính kịch'], duration: 128, releaseDate: addDaysISO(dateISO(), 24),
      language: 'Tiếng Việt', age: 'T13', rating: 7.4, status: 'coming_soon', featured: false,
      art: { from: '#fbbf24', via: '#b45309', to: '#422006', accent: '#fef3c7' },
    },
    {
      title: 'Linh Miêu: Quỷ Nhập Tràng', slug: 'linh-mieu-quy-nhap-trang',
      tagline: 'Đoàn kiệu rước thây trở về cố đô.',
      description: 'Lấy cảm hứng từ truyền thuyết "quỷ nhập tràng", phim đưa người xem về xứ Huế thời chuyển giao, nơi những nghi lễ cổ và bí mật gia tộc đánh thức thứ ác linh không thể hóa giải.',
      director: 'Lưu Thành Luân', cast: ['Hồng Đào', 'Thiên An', 'Thùy Tiên', 'Văn Anh', 'Samuel An'],
      genres: ['Kinh dị', 'Giật gân', 'Bí ẩn'], duration: 109, releaseDate: addDaysISO(dateISO(), 35),
      language: 'Tiếng Việt – Phụ đề Anh', age: 'T18', rating: 0, status: 'coming_soon', featured: false,
      art: { from: '#64748b', via: '#1e293b', to: '#020617', accent: '#e2e8f0' },
    },
    {
      title: 'Quỷ Cẩu', slug: 'quy-cau',
      tagline: 'Nghiệp sát sinh không buông tha ai.',
      description: 'Nam về quê lo đám tang cho bố sau cái chết kinh hoàng, trong khi phải che giấu bạn gái đang mang thai. Sau khi mai táng, Nam liên tục mơ thấy gia đình bị giết và chú chó trắng Mít có biểu hiện kỳ lạ. Anh buộc phải điều tra lò mổ chó truyền thống của gia đình để giải quyết sự kiện kỳ lạ.',
      director: 'Lưu Thành Luân', cast: ['Quang Tuấn', 'Kim Xuân', 'Vân Dung', 'Nam Thư', 'Hạnh Thúy'],
      genres: ['Kinh dị', 'Bí ẩn'], duration: 99, releaseDate: addDaysISO(dateISO(), -90),
      language: 'Tiếng Việt', age: 'T18', rating: 4.7, status: 'ended', featured: false,
      art: { from: '#ef4444', via: '#7f1d1d', to: '#000000', accent: '#fca5a5' },
    },
    {
      title: 'Song Lang', slug: 'song-lang',
      tagline: 'Một câu chuyện tình dưới ánh đèn cải lương.',
      description: 'Sài Gòn thập niên 1980. Dũng “thiên lôi” là tay anh chị chuyên đòi nợ thuê, sống lặng lẽ trong căn tập thể cũ. Một lần đi đòi nợ tại đoàn cải lương Thiên Lý, Dũng chạm mặt Linh Phụng – kép nam chính của đoàn – và sợi dây định mệnh giữa hai con người cùng nặng lòng với cải lương bắt đầu hình thành.',
      director: 'Leon Lê', cast: ['Liên Bỉnh Phát', 'Isaac', 'Thanh Tú', 'Hồng Thanh', 'Mỹ Phương'],
      genres: ['Chính kịch', 'Tình cảm', 'Âm nhạc'], duration: 97, releaseDate: addDaysISO(dateISO(), -24),
      language: 'Tiếng Việt', age: 'T13', rating: 6.8, status: 'now_showing', featured: false,
      art: { from: '#f59e0b', via: '#b45309', to: '#1c1917', accent: '#fef3c7' },
    },
    {
      title: 'Người Vợ Cuối Cùng', slug: 'nguoi-vo-cuoi-cung',
      tagline: 'Kiếp người dưới bóng phong kiến.',
      description: 'Lấy bối cảnh Việt Nam triều Nguyễn, phim kể về Linh – người vợ bất đắc dĩ của một viên quan tri huyện. Vì không thể sinh con nối dõi, cô chịu sự chèn ép của những người vợ lớn. Cuộc gặp lại người yêu thời thanh mai trúc mã đẩy cuộc đời cô sang trang mới.',
      director: 'Victor Vũ', cast: ['Kaity Nguyễn', 'Thuận Nguyễn', 'Quốc Huy', 'Lưu Đê Ly', 'Ngọc Diệp'],
      genres: ['Chính kịch', 'Tình cảm', 'Tâm lý', 'Bí ẩn'], duration: 133, releaseDate: addDaysISO(dateISO(), -19),
      language: 'Tiếng Việt', age: 'T16', rating: 6.8, status: 'now_showing', featured: false,
      art: { from: '#a78bfa', via: '#6d28d9', to: '#1e1b4b', accent: '#ddd6fe' },
    },
    {
      title: 'Em Chưa 18', slug: 'em-chua-18',
      tagline: 'Tình yêu đến khi cô ấy chưa đủ 18.',
      description: 'Hoàng là tay chơi bảnh tỏn, sống theo quy luật “không có đêm thứ hai” với bất kỳ cô nàng nào. Định mệnh ập đến khi anh gặp Linh Đan, có mối tình chớp nhoáng rồi phát hiện bạn gái mới chưa đủ 18 tuổi. Thế giới đào hoa của Hoàng bất ngờ thu nhỏ trong lưới tình của cô học trò tinh quái.',
      director: 'Lê Thanh Sơn', cast: ['Kaity Nguyễn', 'Kiều Minh Tuấn', 'Will', 'Nguyễn Tiến Dũng', 'Kiều Trinh'],
      genres: ['Hài', 'Tình cảm', 'Chính kịch'], duration: 90, releaseDate: addDaysISO(dateISO(), -14),
      language: 'Tiếng Việt', age: 'T16', rating: 6.5, status: 'now_showing', featured: false,
      art: { from: '#f472b6', via: '#be185d', to: '#1e1b4b', accent: '#fbcfe8' },
    },
    {
      title: 'Tro Tàn Rực Rỡ', slug: 'tro-tan-ruc-ro',
      tagline: 'Ba người phụ nữ, ba cách giữ lửa yêu.',
      description: 'Lấy bối cảnh làng chài Thơm Rơm ven biển Cà Mau, phim xoay quanh ba người phụ nữ có cuộc sống tình yêu khác thường. Câu chuyện về cách họ yêu, cách giữ người đàn ông của mình và những mảnh đời còn lại sau giông bão.',
      director: 'Bùi Thạc Chuyên', cast: ['Lê Công Hoàng', 'Juliet Bảo Ngọc Doling', 'Phương Anh Đào', 'Quang Tuấn', 'Hạnh Thúy'],
      genres: ['Chính kịch', 'Tâm lý', 'Tình cảm'], duration: 117, releaseDate: addDaysISO(dateISO(), -11),
      language: 'Tiếng Việt', age: 'T16', rating: 7.0, status: 'now_showing', featured: false,
      art: { from: '#34d399', via: '#065f46', to: '#052e16', accent: '#a7f3d0' },
    },
    {
      title: 'Sút', slug: 'sut',
      tagline: 'Bóng đá, đam mê và gia đình.',
      description: 'Bộ phim điện ảnh Việt Nam đầu tiên lấy đề tài bóng đá, khơi dậy tinh thần hết mình với ước mơ tuổi trẻ. Không chỉ nói về bóng đá, phim còn là câu chuyện về đam mê, tình cảm gia đình và những người trẻ chắp nối ước mơ của nhau.',
      director: 'Việt Max', cast: ['Hà Hiền', 'Gin Tuấn Kiệt', 'Huyme', 'Nhung Kate', 'Tùng Mint'],
      genres: ['Thể thao', 'Hài', 'Gia đình', 'Chính kịch'], duration: 97, releaseDate: addDaysISO(dateISO(), -9),
      language: 'Tiếng Việt', age: 'P', rating: 0, status: 'now_showing', featured: false,
      art: { from: '#84cc16', via: '#3f6212', to: '#0c1a05', accent: '#d9f99d' },
    },
    {
      title: 'Em và Trịnh', slug: 'em-va-trinh',
      tagline: 'Một đời nhạc, một đời tình.',
      description: 'Tác phẩm xoay quanh cuộc đời Trịnh Công Sơn từ thời trẻ đến lúc trung niên trong khoảng những năm 1960-1990, điểm nhấn là câu chuyện giữa cố nhạc sĩ và cô gái Dao Ánh.',
      director: 'Phan Gia Nhật Linh', cast: ['Avin Lu', 'Lan Thy', 'Hoàng Hà', 'Trần Lực', 'Bùi Lan Hương'],
      genres: ['Âm nhạc', 'Tình cảm', 'Chính kịch'], duration: 136, releaseDate: addDaysISO(dateISO(), -22),
      language: 'Tiếng Việt', age: 'T13', rating: 0, status: 'now_showing', featured: false,
      art: { from: '#f59e0b', via: '#b45309', to: '#1c1917', accent: '#fef3c7' },
    },
    {
      title: 'Mùi Cỏ Cháy', slug: 'mui-co-chay',
      tagline: 'Mùa hè đỏ lửa, tuổi trẻ và nỗi nhớ.',
      description: '"Mùi cỏ cháy" lấy bối cảnh Mùa hè đỏ lửa 1972 với trận chiến tại Thành cổ Quảng Trị. Bốn sinh viên Hà Nội lên đường nhập ngũ năm 1971, được huấn luyện tốc hành và tham gia chiến đấu tại Thành cổ. Câu chuyện được kể lại từ ký ức của Hoàng khi ông trở về chiến trường xưa.',
      director: 'Nguyễn Hữu Mười', cast: ['Nguyễn Năng Tùng', 'Hữu Mười', 'Lê Văn Thơm', 'Tô Dũng', 'Thanh Sơn'],
      genres: ['Chiến tranh', 'Lịch sử', 'Chính kịch'], duration: 97, releaseDate: addDaysISO(dateISO(), -28),
      language: 'Tiếng Việt', age: 'T16', rating: 7.8, status: 'now_showing', featured: false,
      art: { from: '#84cc16', via: '#3f6212', to: '#1a2e05', accent: '#d9f99d' },
    },
    {
      title: 'Truy Sát', slug: 'truy-sat',
      tagline: 'Không có đường lùi cho người đi tìm công lý.',
      description: 'Một băng đảng ma túy quốc tế nhắm tới Việt Nam, và nữ cảnh sát cứng rắn nhất phải đưa chúng ra trước công lý. Cuộc truy đuổi xuyên biên giới đẩy cô vào những trận chiến nghẹt thở giữa tội phạm và lòng trung thành.',
      director: 'Cường Ngô', cast: ['Trương Ngọc Ánh', 'Marcus Guilhem', 'Mike Leeder', 'Trung Ly', 'Thiên Nguyễn'],
      genres: ['Hành động', 'Võ thuật', 'Giật gân'], duration: 90, releaseDate: addDaysISO(dateISO(), -26),
      language: 'Tiếng Việt – Phụ đề Anh', age: 'T18', rating: 7.8, status: 'now_showing', featured: false,
      art: { from: '#f97316', via: '#9a3412', to: '#0c0a09', accent: '#fed7aa' },
    },
    {
      title: 'Người Bất Tử', slug: 'nguoi-bat-tu',
      tagline: 'Ba thế kỷ, một lời nguyền.',
      description: 'Những giấc mơ và ảo ảnh dẫn An đến một hang động bí ẩn, nơi cô phát hiện bí mật kinh hoàng về Hùng – người đàn ông đã sống qua ba thế kỷ. Cuộc đời đầy biến động của Hùng dần hé lộ.',
      director: 'Victor Vũ', cast: ['Quách Ngọc Ngoan', 'Ngọc Diệp', 'Jun Vũ', 'Thanh Tú', 'Lâm Vissay'],
      genres: ['Kinh dị', 'Giật gân', 'Giả tượng', 'Bí ẩn'], duration: 132, releaseDate: addDaysISO(dateISO(), -23),
      language: 'Tiếng Việt', age: 'T18', rating: 6.3, status: 'now_showing', featured: false,
      art: { from: '#dc2626', via: '#7f1d1d', to: '#0c0a09', accent: '#fecaca' },
    },
    {
      title: 'Quả Tim Máu', slug: 'qua-tim-mau',
      tagline: 'Trái tim không biết nói dối.',
      description: 'Linh, người nhận ghép tim, bắt đầu có những cơn ác mộng và tầm nhìn dẫn đến một ngôi nhà ở vùng nông thôn xa xôi. Cô tin rằng chủ nhân trước của trái tim đang cố gửi một thông điệp từ bên kia thế giới.',
      director: 'Victor Vũ', cast: ['Thái Hòa', 'Quý Bình', 'Tú Vi', 'Nhã Phương', 'Kim Xuân'],
      genres: ['Kinh dị', 'Giật gân', 'Bí ẩn', 'Hài'], duration: 97, releaseDate: addDaysISO(dateISO(), -17),
      language: 'Tiếng Việt', age: 'T16', rating: 8.4, status: 'now_showing', featured: false,
      art: { from: '#ef4444', via: '#991b1b', to: '#1c1917', accent: '#fca5a5' },
    },
    {
      title: 'Chị Mười Ba 2: 3 Ngày Sinh Tử', slug: 'chi-muoi-ba',
      tagline: 'Ba ngày để sống, một đời để trả.',
      description: 'Sau khi lật đổ ông trùm Hắc Hổ và đập tan âm mưu của Anh Hai, Chị Mười Ba cùng An Cư Nghĩa Đoàn tưởng đã có thể yên ổn làm ăn. Nhưng một loạt biến cố mới buộc chị phải tái xuất trong ba ngày sinh tử.',
      director: 'Võ Thanh Hòa', cast: ['Thu Trang', 'Tiến Luật', 'Kiều Minh Tuấn', 'Trương Minh Quốc Thái'],
      genres: ['Hài', 'Hành động', 'Võ thuật'], duration: 90, releaseDate: addDaysISO(dateISO(), -15),
      language: 'Tiếng Việt', age: 'T16', rating: 4.0, status: 'now_showing', featured: false,
      art: { from: '#facc15', via: '#a16207', to: '#1c1917', accent: '#fef08a' },
    },
    {
      title: 'Dế Mèn: Cuộc Phiêu Lưu Tới Xóm Lầy Lội', slug: 'de-men',
      tagline: 'Phiêu lưu tới xóm lầy lội.',
      description: 'Lấy cảm hứng từ tác phẩm "Dế Mèn phiêu lưu ký" của Tô Hoài, phim theo chân Dế Mèn và những người bạn qua Hà Nội hiện đại để cứu Xóm Lầy Lội – vùng đất từng xanh tươi nay bị đe dọa.',
      director: 'Mai Phương', cast: ['Lê Bống', 'Ali Thục Phương', 'Nguyễn Anh Tuấn', 'Võ Huyền Chi', 'Hồ Tiến Đạt'],
      genres: ['Hoạt hình', 'Phiêu lưu', 'Gia đình', 'Âm nhạc'], duration: 84, releaseDate: addDaysISO(dateISO(), -7),
      language: 'Tiếng Việt', age: 'P', rating: 5.0, status: 'now_showing', featured: false,
      art: { from: '#4ade80', via: '#15803d', to: '#052e16', accent: '#bbf7d0' },
    },
    {
      title: 'Trạng Quỳnh Nhí: Truyền Thuyết Kim Ngưu', slug: 'trang-quynh-nhi',
      tagline: 'Truyền thuyết Kim Ngưu thức giấc.',
      description: 'Cuộc phiêu lưu của Quỳnh và nhóm bạn cùng một chú trâu nước bí ẩn, đưa cả nhóm vào hành trình khám phá truyền thuyết Kim Ngưu và những thử thách kỳ ảo.',
      director: 'Trịnh Lâm Tùng', cast: ['Trọng Phan', 'Lê Hiếu', 'Tạ Tuấn Minh', 'Đới Anh Quân', 'Nông Dũng Nam'],
      genres: ['Hoạt hình', 'Phiêu lưu', 'Giả tượng', 'Gia đình'], duration: 98, releaseDate: addDaysISO(dateISO(), -6),
      language: 'Tiếng Việt', age: 'P', rating: 0, status: 'now_showing', featured: false,
      art: { from: '#22d3ee', via: '#0e7490', to: '#020617', accent: '#a5f3fc' },
    },
    {
      title: 'Tôi Thấy Hoa Vàng Trên Cỏ Xanh', slug: 'toi-thay-hoa-vang',
      tagline: 'Tuổi thơ, tình bạn và những điều chưa kịp nói.',
      description: 'Lấy bối cảnh tại vùng quê Việt Nam, bộ phim kể về câu chuyện tình cảm ngây thơ trong sáng, tình bạn đẹp và tình làng xóm của hai anh em Thiều, Tường và cô bé Mận.',
      director: 'Victor Vũ', cast: ['Thịnh Vinh', 'Trọng Khang', 'Lâm Thanh Mỹ', 'My Anh', 'Mai Thế Hiệp'],
      genres: ['Tình cảm', 'Gia đình', 'Chính kịch', 'Tâm lý'], duration: 103, releaseDate: addDaysISO(dateISO(), -13),
      language: 'Tiếng Việt', age: 'P', rating: 6.9, status: 'now_showing', featured: false,
      art: { from: '#84cc16', via: '#3f6212', to: '#1a2e05', accent: '#d9f99d' },
    },
    {
      title: 'Đất Rừng Phương Nam', slug: 'dat-rung-phuong-nam',
      tagline: 'Về phương Nam, nơi đất rừng gọi tên.',
      description: 'Đất Rừng Phương Nam phiên bản điện ảnh được kế thừa và phát triển từ tiểu thuyết cùng tên của nhà văn Đoàn Giỏi. Phim kể về hành trình phiêu lưu của An – cậu bé chẳng may mất mẹ trên đường đi tìm cha. Cùng An, khán giả trải nghiệm sự trù phú của thiên nhiên và nét đẹp văn hoá đặc sắc của vùng đất Nam Kì Lục Tỉnh.',
      director: 'Nguyễn Quang Dũng', cast: ['Hạo Khang', 'Trấn Thành', 'Công Ninh', 'Mai Tài Phến', 'Tuấn Trần'],
      genres: ['Phiêu lưu', 'Gia đình', 'Chính kịch', 'Chiến tranh'], duration: 100, releaseDate: addDaysISO(dateISO(), -27),
      language: 'Tiếng Việt', age: 'P', rating: 5.3, status: 'now_showing', featured: true,
      art: { from: '#10b981', via: '#065f46', to: '#052e16', accent: '#a7f3d0' },
    },
    {
      title: 'Tấm Cám: Chuyện Chưa Kể', slug: 'tam-cam',
      tagline: 'Cổ tích chưa từng kể như thế này.',
      description: 'Tấm Cám Chuyện Chưa Kể lấy cảm hứng từ câu chuyện cổ tích quen thuộc nhưng khai thác dưới góc độ kỳ ảo. Vẫn là nàng Tấm hiền lành bị mẹ con Cám hãm hại, nhưng câu chuyện bùng nổ hơn với vai trò của Thái tử và những bí ẩn trong vương triều.',
      director: 'Ngô Thanh Vân', cast: ['Ngô Thanh Vân', 'Hạ Vi', 'Ninh Dương Lan Ngọc', 'Isaac', 'Thành Lộc'],
      genres: ['Giả tượng', 'Kinh dị', 'Chính kịch', 'Bí ẩn'], duration: 115, releaseDate: addDaysISO(dateISO(), -29),
      language: 'Tiếng Việt', age: 'T13', rating: 4.8, status: 'now_showing', featured: false,
      art: { from: '#facc15', via: '#92400e', to: '#1c0a0a', accent: '#fde68a' },
    },
    {
      title: 'Thiên Mệnh Anh Hùng', slug: 'thien-menh-anh-hung',
      tagline: 'Một lời sấm, một mối thù, một anh hùng.',
      description: 'Sau vụ thảm án Lệ Chi viên, gia tộc Nguyễn Trãi chỉ còn một đứa bé 5 tuổi sống sót, được gia tướng đem đi trốn để tránh sự truy sát của phe Tuyên Từ Hoàng thái hậu. Mười sáu năm sau, người xưa trở về giữa vòng xoáy quyền lực và mối thù gia tộc.',
      director: 'Victor Vũ', cast: ['Huỳnh Đông', 'Midu', 'Khương Ngọc', 'Minh Thuận', 'Vân Trang'],
      genres: ['Hành động', 'Võ thuật', 'Lịch sử', 'Chính kịch'], duration: 90, releaseDate: addDaysISO(dateISO(), -30),
      language: 'Tiếng Việt', age: 'T16', rating: 6.3, status: 'now_showing', featured: false,
      art: { from: '#dc2626', via: '#7f1d1d', to: '#1c1917', accent: '#fecaca' },
    },
    {
      title: 'Bụi Đời Chợ Lớn', slug: 'bui-doi-cho-lon',
      tagline: 'Chợ Lớn không có chỗ cho người yếu.',
      description: 'Trong thế giới ngầm tại Sài Gòn, Chợ Lớn là trái tim của cả thành phố – ai có Chợ Lớn thì có Sài Gòn. Máu và nước mắt đổ xuống cho những cuộc tranh quyền đoạt vị khốc liệt, xoay quanh mối quan hệ phức tạp giữa bốn nhân vật.',
      director: 'Charlie Nguyễn', cast: ['Hoàng Phúc', 'Long Điền', 'Hà Hiền', 'Huỳnh Bích Phương', 'Hoàng Phi'],
      genres: ['Hành động', 'Tội phạm', 'Chính kịch'], duration: 85, releaseDate: addDaysISO(dateISO(), -25),
      language: 'Tiếng Việt', age: 'T18', rating: 5.3, status: 'now_showing', featured: false,
      art: { from: '#ef4444', via: '#7f1d1d', to: '#0c0a09', accent: '#fca5a5' },
    },
    {
      title: 'Vệ Sĩ Sài Gòn', slug: 've-si-sai-gon',
      tagline: 'Bảo vệ người khác, bảo vệ chính mình.',
      description: 'Bộ phim chiếu rạp đầu tiên của Việt Nam nói về nghề vệ sĩ. Mr. Hoàn Hảo của Kim Lý cùng Mr. Mê Gái của Thái Hòa phải thực hiện một nhiệm vụ tưởng dễ nhưng hóa ra cực khó, kéo theo chuỗi tình huống dở khóc dở cười.',
      director: 'Ken Ochiai', cast: ['Thái Hòa', 'Chi Pu', 'B Trần', 'Kim Ly', 'Khương Ngọc'],
      genres: ['Hành động', 'Hài'], duration: 112, releaseDate: addDaysISO(dateISO(), -21),
      language: 'Tiếng Việt', age: 'T13', rating: 6.0, status: 'now_showing', featured: false,
      art: { from: '#38bdf8', via: '#1d4ed8', to: '#0c1a2e', accent: '#bae6fd' },
    },
    {
      title: 'Gái Già Lắm Chiêu V', slug: 'gai-gia-lam-chieu-v',
      tagline: 'Tình thân hay tiền tài?',
      description: 'Cuộc chiến “chị – em máu mủ tình thâm” chỉ vì hai chữ TÌNH – TIỀN của ba chị em gái Lý gia tại biệt thự Bạch Trà Viên xứ Huế. Từ chị em ruột thịt, họ trở thành những kẻ đối đầu trong vòng xoáy được – mất.',
      director: 'Bảo Nhân', cast: ['Hồng Vân', 'Kaity Nguyễn', 'Khương Lê', 'Hoàng Dũng', 'Lê Khánh'],
      genres: ['Hài', 'Chính kịch', 'Tâm lý'], duration: 115, releaseDate: addDaysISO(dateISO(), -20),
      language: 'Tiếng Việt', age: 'T13', rating: 4.5, status: 'now_showing', featured: false,
      art: { from: '#f472b6', via: '#9d174d', to: '#1e1b4b', accent: '#fbcfe8' },
    },
    {
      title: 'Cua Lại Vợ Bầu', slug: 'cua-lai-vo-bau',
      tagline: 'Yêu nhau bảy năm, cua lại một lần.',
      description: 'Trọng Thoại và Nhã Linh yêu nhau đã bảy năm. Những lỗi lầm nho nhỏ tích tụ thành mâu thuẫn lớn, lại thêm người cũ Quý Khánh xuất hiện khiến Nhã Linh xao lòng. Rồi cô có thai – và câu hỏi đứa bé là của ai kéo cả hai vào rắc rối.',
      director: 'Nhất Trung', cast: ['Trấn Thành', 'Ninh Dương Lan Ngọc', 'Anh Tú Atus', 'Mạc Văn Khoa', 'Khả Như'],
      genres: ['Hài', 'Gia đình', 'Tình cảm'], duration: 90, releaseDate: addDaysISO(dateISO(), -19),
      language: 'Tiếng Việt', age: 'T13', rating: 7.3, status: 'now_showing', featured: false,
      art: { from: '#fbbf24', via: '#b45309', to: '#422006', accent: '#fef3c7' },
    },
    {
      title: 'Chị Chị Em Em', slug: 'chi-chi-em-em',
      tagline: 'Yêu – hận – tình – thù giữa hai người phụ nữ.',
      description: 'Sự kết hợp chưa từng có giữa Thanh Hằng và Chi Pu cùng câu chuyện ly kỳ về yêu – hận – tình – thù đằng sau hai người phụ nữ xinh đẹp, đưa cả hai vào vòng xoáy của ghen tuông và toan tính.',
      director: 'Kathy Uyen', cast: ['Thanh Hằng', 'Chi Pu', 'Lãnh Thanh', 'Kathy Uyen'],
      genres: ['Chính kịch', 'Tâm lý', 'Tình cảm', 'Giật gân'], duration: 94, releaseDate: addDaysISO(dateISO(), -18),
      language: 'Tiếng Việt', age: 'T16', rating: 5.5, status: 'now_showing', featured: false,
      art: { from: '#fb7185', via: '#9f1239', to: '#1f0a12', accent: '#fecdd3' },
    },
    {
      title: 'Cô Ba Sài Gòn', slug: 'co-ba-sai-gon',
      tagline: 'Chiếc áo dài giữ hồn Sài Gòn.',
      description: 'Năm 1969, nhà may Thanh Nữ là nhà may áo dài nổi tiếng nhất Sài Gòn. Bà chủ Thanh Mai có hai cô con gái: Như Ý và cô con nuôi Thanh Loan. Như Ý thích thiết kế đồ Tây và cho rằng áo dài đã quá xưa, cho đến khi những biến cố gia đình buộc cô nhìn lại.',
      director: 'Kay Nguyễn', cast: ['Ninh Dương Lan Ngọc', 'Hồng Vân', 'Ngô Thanh Vân', 'Diễm My 9x', 'S.T Sơn Thạch'],
      genres: ['Chính kịch', 'Hài', 'Tâm lý'], duration: 100, releaseDate: addDaysISO(dateISO(), -16),
      language: 'Tiếng Việt', age: 'T13', rating: 6.1, status: 'now_showing', featured: false,
      art: { from: '#f59e0b', via: '#0f766e', to: '#042f2e', accent: '#fef3c7' },
    },
    {
      title: 'Yêu', slug: 'yeu',
      tagline: 'Yêu là dám chọn.',
      description: 'Bộ phim xoay quanh mối quan hệ tình bạn, tình yêu của Nhi, Hoàng, Tú và Miến. Nhi – cô gái xinh xắn với khát vọng ca hát – đứng giữa tình cảm dành cho bạn trai cứng nhắc và rung động mới, buộc cô phải lựa chọn điều mình thật sự muốn.',
      director: 'Việt Max', cast: ['Chi Pu', 'Gil Le', 'B Trần', 'Phở Đặc Biệt', 'Lâm Thanh Mỹ'],
      genres: ['Tình cảm', 'Chính kịch'], duration: 106, releaseDate: addDaysISO(dateISO(), -14),
      language: 'Tiếng Việt', age: 'T16', rating: 5.1, status: 'now_showing', featured: false,
      art: { from: '#38bdf8', via: '#7c3aed', to: '#172554', accent: '#e9d5ff' },
    },
    {
      title: 'Ma Da', slug: 'ma-da',
      tagline: 'Sông sâu không giấu được oan hồn.',
      description: 'Phim kể về bà Lệ, người làm nghề vớt xác người chết trên sông để đưa về với gia đình. Trong quá trình làm nghề, bà đắc tội với Ma Da – oan hồn dưới sông chuyên kéo chân người thế mạng. Oán hận của cả hai khiến Ma Da bắt mất bé Nhung, con gái bà Lệ.',
      director: 'Nguyễn Hữu Hoàng', cast: ['Việt Hương', 'Thành Lộc', 'Trung Dân', 'Cẩm Ly', 'Hoàng Mèo'],
      genres: ['Kinh dị', 'Bí ẩn', 'Giật gân'], duration: 95, releaseDate: addDaysISO(dateISO(), -5),
      language: 'Tiếng Việt', age: 'T16', rating: 6.5, status: 'now_showing', featured: false,
      art: { from: '#22d3ee', via: '#0e7490', to: '#020617', accent: '#a5f3fc' },
    },
    {
      title: 'Kẻ Ăn Hồn', slug: 'ke-an-hon',
      tagline: 'Năm mạng đổi một bình rượu.',
      description: 'Phim về hàng loạt cái chết bí ẩn ở Làng Địa Ngục, nơi có ma thuật cổ xưa: năm mạng đổi bình Rượu Sọ Người. Thập Nương – cô gái áo đỏ – là kẻ nắm giữ bí thuật luyện nên loại rượu mạnh nhất.',
      director: 'Trần Hữu Tấn', cast: ['Hoàng Hà', 'Võ Điền Gia Huy', 'Thanh Trực', 'Lan Phương', 'Chiều Xuân'],
      genres: ['Kinh dị', 'Bí ẩn', 'Giật gân'], duration: 109, releaseDate: addDaysISO(dateISO(), -4),
      language: 'Tiếng Việt', age: 'T18', rating: 6.0, status: 'now_showing', featured: false,
      art: { from: '#dc2626', via: '#450a0a', to: '#000000', accent: '#fca5a5' },
    },
    {
      title: 'Cám', slug: 'cam',
      tagline: 'Cổ tích đẹp nhất là cổ tích bị bỏ quên.',
      description: 'Cám sinh ra với khuôn mặt dị dạng do lời nguyền truyền qua nhiều thế hệ, bị cha xem là vết nhơ và đày xuống nhà sau sống như người hầu. Trong khi chị cùng cha khác mẹ là Tấm được nuông chiều, lòng căm thù trong Cám ngày một lớn.',
      director: 'Trần Hữu Tấn', cast: ['Lâm Thanh Mỹ', 'Rima Thanh Vy', 'Thuý Diễm', 'Trần Doãn Hoàng', 'Ngô Hải Nam'],
      genres: ['Kinh dị', 'Giả tượng', 'Bí ẩn', 'Giật gân'], duration: 122, releaseDate: addDaysISO(dateISO(), -3),
      language: 'Tiếng Việt', age: 'T18', rating: 9.0, status: 'now_showing', featured: false,
      art: { from: '#ef4444', via: '#7f1d1d', to: '#0c0a09', accent: '#fecaca' },
    },
    {
      title: 'Nhà Gia Tiên', slug: 'nha-gia-tien',
      tagline: 'Ông bà không đi đâu cả.',
      description: 'Nhà Gia Tiên xoay quanh câu chuyện đa góc nhìn về các thế hệ trong một gia đình, với hai nhân vật chính là Gia Minh và Mỹ Tiên. Về căn nhà gia tiên để quay video “triệu view”, Mỹ Tiên – nhà sáng tạo nội dung thế hệ Z không tin tâm linh – bất ngờ nhìn thấy Gia Minh.',
      director: 'Huỳnh Lập', cast: ['Huỳnh Lập', 'Phương Mỹ Chi', 'Hạnh Thúy', 'Puka', 'Huỳnh Đông'],
      genres: ['Kinh dị', 'Hài', 'Gia đình', 'Chính kịch'], duration: 117, releaseDate: addDaysISO(dateISO(), -2),
      language: 'Tiếng Việt', age: 'T16', rating: 7.6, status: 'now_showing', featured: false,
      art: { from: '#f59e0b', via: '#78350f', to: '#1c0a0a', accent: '#fde68a' },
    },
    {
      title: 'Bộ Tứ Báo Thủ', slug: 'bo-tu-bao-thu',
      tagline: 'Bốn người, một phi vụ, cả rổ rắc rối.',
      description: 'Bộ tứ báo thủ gồm Chét-Xi-Cà, Dì Bốn, Cậu Mười Một và Con Kiều xuất hiện cùng phi vụ báo thế kỷ. Kế hoạch tiếp theo là ở Đà Lạt, và bốn báo thủ quyết định quậy Tết tung nóc.',
      director: 'Trấn Thành', cast: ['Quốc Anh', 'Trần Tiểu Vy', 'Kỳ Duyên', 'Trấn Thành', 'Uyển Ân'],
      genres: ['Hài', 'Hành động', 'Tình cảm'], duration: 133, releaseDate: addDaysISO(dateISO(), -1),
      language: 'Tiếng Việt', age: 'T13', rating: 5.8, status: 'now_showing', featured: false,
      art: { from: '#f97316', via: '#b45309', to: '#1c1917', accent: '#fed7aa' },
    },
  ];
  return movies.map((movie) => ({ ...movie, ...MOVIE_MEDIA[movie.slug] }));
}

export async function seedDb(): Promise<Database> {
  const now = cinemaNow();
  const today = dateISO(now);
  const nowMs = Date.now();
  const iso = (date: string, time: string) => showtimeStart({ showDate: date, startTime: time }).toISOString();

  const cinemaPassword = await hashPassword('Khach@123');
  const staffPassword = await hashPassword('Staff@123');
  const managerPassword = await hashPassword('Manager@123');
  const adminPassword = await hashPassword('Admin@123');

  const users: User[] = [
    {
      id: 'u-customer', name: 'Nguyễn Minh Anh', email: 'khach@pxu.vn', phone: '0901234567',
      passwordHash: cinemaPassword, role: 'customer', permissions: [], cinemaIds: [], points: 2450, tier: 'gold',
      emailVerified: true, status: 'active', dob: '1996-08-14', avatarSeed: 11,
      createdAt: iso(today, '09:00'),
    },
    {
      id: 'u-staff', name: 'Trần Quốc Huy', email: 'staff@pxu.vn', phone: '0912345678',
      passwordHash: staffPassword, role: 'staff', permissions: ['booking.read', 'shift.manage'], cinemaIds: [1],
      points: 0, tier: 'member', emailVerified: true, status: 'active', avatarSeed: 22,
      createdAt: iso(addDaysISO(today, -120), '08:00'),
    },
    {
      id: 'u-manager', name: 'Lê Thu Hà', email: 'manager@pxu.vn', phone: '0923456789',
      passwordHash: managerPassword, role: 'manager', permissions: MANAGER_PERMISSIONS, cinemaIds: [1],
      points: 0, tier: 'member', emailVerified: true, status: 'active', avatarSeed: 33,
      createdAt: iso(addDaysISO(today, -240), '08:00'),
    },
    {
      id: 'u-admin', name: 'Phạm Gia Bảo', email: 'admin@pxu.vn', phone: '0934567890',
      passwordHash: adminPassword, role: 'admin', permissions: ['*'], cinemaIds: [],
      points: 0, tier: 'member', emailVerified: true, status: 'active', avatarSeed: 44,
      createdAt: iso(addDaysISO(today, -400), '08:00'),
    },
    {
      id: 'u-c2', name: 'Võ Hoàng Nam', email: 'hoangnam@example.com', phone: '0945678901',
      passwordHash: cinemaPassword, role: 'customer', permissions: [], cinemaIds: [], points: 320, tier: 'silver',
      emailVerified: true, status: 'active', dob: '2001-03-02', avatarSeed: 55,
      createdAt: iso(addDaysISO(today, -95), '10:00'),
    },
    {
      id: 'u-c3', name: 'Đặng Khánh Linh', email: 'khanhlinh@example.com', phone: '0956789012',
      passwordHash: cinemaPassword, role: 'customer', permissions: [], cinemaIds: [], points: 8120, tier: 'diamond',
      emailVerified: true, status: 'active', dob: '1992-11-20', avatarSeed: 66,
      createdAt: iso(addDaysISO(today, -300), '10:00'),
    },
    {
      id: 'u-c4', name: 'Bùi Tiến Dũng', email: 'tiendung@example.com', phone: '0967890123',
      passwordHash: cinemaPassword, role: 'customer', permissions: [], cinemaIds: [], points: 90, tier: 'member',
      emailVerified: false, status: 'active', avatarSeed: 77,
      createdAt: iso(addDaysISO(today, -6), '10:00'),
    },
    {
      id: 'u-c5', name: 'Phan Thùy Dương', email: 'thuyduong@example.com', phone: '0978901234',
      passwordHash: cinemaPassword, role: 'customer', permissions: [], cinemaIds: [], points: 1540, tier: 'silver',
      emailVerified: true, status: 'locked', avatarSeed: 88,
      createdAt: iso(addDaysISO(today, -200), '10:00'),
    },
    {
      id: 'u-c6', name: 'Đỗ Anh Khoa', email: 'anhkhoa@example.com', phone: '0989012345',
      passwordHash: cinemaPassword, role: 'customer', permissions: [], cinemaIds: [], points: 0, tier: 'member',
      emailVerified: true, status: 'active', avatarSeed: 99,
      createdAt: iso(addDaysISO(today, -2), '10:00'),
    },
  ];

  const moviesUnsorted: Movie[] = makeMovies().map((m, i) => ({
    ...m, id: i + 1, createdAt: iso(addDaysISO(today, -180 + i), '08:00'),
  }));

  const cinemas: Cinema[] = [
    {
      id: 1, name: 'PXU Cinema Landmark', address: 'Tầng 4, Vincom Landmark 81, 720A Điện Biên Phủ',
      city: 'TP. Hồ Chí Minh', hotline: '1900 6363', imageTone: '#ff6600',
    },
    {
      id: 2, name: 'PXU Cinema Royal City', address: 'Tầng 3, Vincom Mega Mall Royal City, 72A Nguyễn Trãi',
      city: 'Hà Nội', hotline: '1900 6364', imageTone: '#38bdf8',
    },
    {
      id: 3, name: 'PXU Cinema Huế', address: 'Tầng 3, Vincom Plaza Huế, 50A Hùng Vương, Phường Phú Nhuận',
      city: 'TP. Huế', hotline: '1900 6365', imageTone: '#10b981',
    },
  ];

  const rooms: Room[] = [
    { id: 1, cinemaId: 1, name: 'Cinema 01', type: '2D', status: 'active' },
    { id: 2, cinemaId: 1, name: 'Cinema 02', type: '3D', status: 'active' },
    { id: 3, cinemaId: 1, name: 'IMAX Hall', type: 'IMAX', status: 'active' },
    { id: 4, cinemaId: 2, name: 'Cinema 01', type: '2D', status: 'active' },
    { id: 5, cinemaId: 2, name: 'Gold Class', type: 'Gold Class', status: 'active' },
    { id: 6, cinemaId: 2, name: 'Cinema 03', type: '3D', status: 'maintenance' },
    { id: 7, cinemaId: 3, name: 'Cinema 01', type: '2D', status: 'active' },
    { id: 8, cinemaId: 3, name: 'Cinema 02', type: '3D', status: 'active' },
  ];

  const seats: Seat[] = [];
  let seatId = 1;
  const baseSeats = createSeats();
  for (const room of rooms) {
    for (const s of baseSeats) {
      const broken = room.id === 1 && (s.code === 'D01' || s.code === 'G14');
      seats.push({ ...s, id: seatId++, roomId: room.id, type: broken ? 'disabled' : s.type });
    }
  }

  const priceRules: PriceRule[] = [];
  const slots: { slot: PriceRule['slot']; price: number }[] = [
    { slot: 'early', price: 50000 }, { slot: 'day', price: 50000 },
    { slot: 'prime', price: 50000 }, { slot: 'late', price: 50000 },
  ];
  let ruleId = 1;
  for (const dayType of ['weekday', 'weekend'] as const) {
    for (const s of slots) {
      priceRules.push({
        id: ruleId++, dayType, slot: s.slot, roomType: '2D',
        price: s.price, active: true,
      });
    }
  }

  const settings: AppSettings = {
    cinemaName: 'PXU Cinema', hotline: '1900 6363', email: 'hotro@pxucinema.vn',
    address: 'Tầng 4, Vincom Landmark 81, 720A Điện Biên Phủ, TP.HCM',
    holdMinutes: 10, holdExtendMinutes: 5, proofPendingMaxMinutes: 60,
    maxSeatsPerBooking: 8, maxActiveHoldsPerUser: 3,
    onlineCloseBeforeMinutes: 15, posCloseBeforeMinutes: 0,
    roomCleaningMinutes: 15, adsMinutes: 15,
    checkinOpenBeforeMinutes: 60, checkinLateAllowMinutes: 30,
    customerCancelAllowed: false, customerCancelBeforeHours: 2, customerRefundPercent: 0,
    pointsPerVnd: 10000, vatPercent: 8, priceRounding: 1000,
    paymentConfirmMode: 'manual', receiptMaxMb: 5, loginMaxAttempts: 5,
    refundApprovalThreshold: 2000000,
    ticketCodeSecret: randomToken(24),
    seatSurcharge: { standard: 0, vip: 30000, couple: 10000 },
    bankName: 'Vietcombank', bankCode: 'VCB', accountNumber: '0123456789',
    accountName: 'CONG TY TNHH PXU CINEMA', transferPrefix: 'PXU',
    useCustomQr: false, webhookSecretHint: 'whsec_••••••••8f2a',
  };

  const nowShowing = moviesUnsorted.filter((m) => m.status === 'now_showing');
  const formatsByRoom: Record<number, string> = {
    1: '2D Phụ đề', 2: '3D Phụ đề', 3: 'IMAX Phụ đề', 4: '2D Lồng tiếng', 5: '2D Gold Class', 6: '3D Phụ đề',
    7: '2D Phụ đề', 8: '3D Phụ đề',
  };

  const showtimes: Showtime[] = [];
  let showtimeId = 1;
  const startSlots = ['09:30', '13:00', '16:30', '20:00'];

  for (let dayOffset = -30; dayOffset <= 13; dayOffset++) {
    const date = addDaysISO(today, dayOffset);
    for (const room of rooms) {
      if (room.status === 'maintenance' && dayOffset >= 0) continue;
      const format = formatsByRoom[room.id] ?? '2D Phụ đề';
      for (const [slotIndex, startTime] of startSlots.entries()) {
        const seedIdx = Math.abs(dayOffset) * 5 + room.id * 3 + slotIndex * 2;
        const movie = nowShowing[seedIdx % nowShowing.length];
        const endMinutes = timeToMinutes(startTime) + movie.duration + settings.adsMinutes;
        const endTime = minutesToTime(endMinutes);
        const start = iso(date, startTime);
        const endMs = showtimeStart({ showDate: date, startTime: endTime }).getTime();
        const startMs = new Date(start).getTime();
        let status: Showtime['status'] = 'selling';
        if (endMs < nowMs) status = 'finished';
        else if (startMs - settings.onlineCloseBeforeMinutes * 60_000 < nowMs) status = 'closed';
        showtimes.push({
          id: showtimeId++, movieId: movie.id, roomId: room.id, cinemaId: room.cinemaId,
          showDate: date, startTime, endTime, format,
          basePrice: basePriceFor(date, startTime, room.type, priceRules, settings.priceRounding),
          status, blockedSeatIds: [], createdAt: iso(addDaysISO(today, -32), '09:00'),
        });
      }
    }
  }

  const combos: Combo[] = [
    { id: 1, name: 'Combo Solo', description: '1 bắp rang bơ vừa + 1 nước ngọt 22oz', price: 85000, category: 'combo', stock: 240, maxPerOrder: 10, status: 'active', art: { from: '#f97316', to: '#7c2d12', emoji: '🍿', imageUrl: '/combos/combo-solo-set.jpg' }, sold: 184 },
    { id: 2, name: 'Combo Couple', description: '1 bắp lớn + 2 nước ngọt 22oz + 1 snack', price: 135000, category: 'combo', stock: 160, maxPerOrder: 10, status: 'active', art: { from: '#ec4899', to: '#831843', emoji: '💞', imageUrl: '/combos/combo-couple-set.jpg' }, sold: 152 },
    { id: 3, name: 'Combo Family', description: '2 bắp lớn + 4 nước ngọt + 2 snack', price: 199000, category: 'combo', stock: 96, maxPerOrder: 5, status: 'active', art: { from: '#8b5cf6', to: '#4c1d95', emoji: '👨‍👩‍👧', imageUrl: '/combos/combo-family-set.jpg' }, sold: 88 },
    { id: 4, name: 'Bắp Phô Mai Lớn', description: 'Bắp rang phủ phô mai, size lớn', price: 55000, category: 'popcorn', stock: 140, maxPerOrder: 10, status: 'active', art: { from: '#facc15', to: '#a16207', emoji: '🧈', imageUrl: '/combos/popcorn-cheese.jpg' }, sold: 210 },
    { id: 5, name: 'Pepsi 32oz', description: 'Nước ngọt có ga, ly lớn', price: 25000, category: 'drink', stock: 300, maxPerOrder: 10, status: 'active', art: { from: '#3b82f6', to: '#1e3a8a', emoji: '🥤', imageUrl: '/combos/pepsi-32oz.jpg' }, sold: 355 },
    { id: 6, name: 'Nachos Sốt Phô Mai', description: 'Bánh tortilla giòn + sốt phô mai', price: 65000, category: 'snack', stock: 0, maxPerOrder: 5, status: 'active', art: { from: '#fb923c', to: '#9a3412', emoji: '🧆', imageUrl: '/combos/nachos-cheese.jpg' }, sold: 64 },
    { id: 7, name: 'Trà Đào Cam Sả', description: 'Trà trái cây thanh mát, size lớn', price: 35000, category: 'drink', stock: 12, maxPerOrder: 10, status: 'active', art: { from: '#f59e0b', to: '#78350f', emoji: '🍑', imageUrl: '/combos/tra-dao-cam-sa.jpg' }, sold: 130 },
    { id: 8, name: 'Khoai Tây Chiên', description: 'Khoai tây chiên giòn rắc phô mai', price: 45000, category: 'snack', stock: 80, maxPerOrder: 10, status: 'hidden', art: { from: '#eab308', to: '#854d0e', emoji: '🍟', imageUrl: '/combos/khoai-tay-chien.jpg' }, sold: 44 },
  ];

  const day = 86_400_000;
  const nowTs = Date.now();
  const vouchers: Voucher[] = [
    { id: 1, code: 'PXU10', label: 'Giảm 10% tối đa 50K', type: 'percent', value: 10, minOrder: 100000, maxDiscount: 50000, startsAt: new Date(nowTs - 20 * day).toISOString(), expiresAt: new Date(nowTs + 60 * day).toISOString(), totalUses: 500, usedCount: 137, perUser: 2, applyTo: 'all', status: 'active', createdAt: new Date(nowTs - 20 * day).toISOString() },
    { id: 2, code: 'PXU50K', label: 'Giảm 50.000đ cho đơn từ 300K', type: 'fixed', value: 50000, minOrder: 300000, maxDiscount: 50000, startsAt: new Date(nowTs - 10 * day).toISOString(), expiresAt: new Date(nowTs + 30 * day).toISOString(), totalUses: 200, usedCount: 64, perUser: 1, applyTo: 'all', status: 'active', createdAt: new Date(nowTs - 10 * day).toISOString() },
    { id: 3, code: 'COMBO20', label: 'Giảm 20% bắp nước', type: 'percent', value: 20, minOrder: 150000, maxDiscount: 40000, startsAt: new Date(nowTs - 5 * day).toISOString(), expiresAt: new Date(nowTs + 45 * day).toISOString(), totalUses: 300, usedCount: 89, perUser: 1, applyTo: 'all', status: 'active', createdAt: new Date(nowTs - 5 * day).toISOString() },
    { id: 4, code: 'BIRTHDAY15', label: 'Sinh nhật giảm 15%', type: 'percent', value: 15, minOrder: 0, maxDiscount: 100000, startsAt: new Date(nowTs - 60 * day).toISOString(), expiresAt: new Date(nowTs + 120 * day).toISOString(), totalUses: 999, usedCount: 42, perUser: 1, applyTo: 'all', status: 'active', createdAt: new Date(nowTs - 60 * day).toISOString() },
    { id: 5, code: 'HETHAN', label: 'Ưu đãi đã kết thúc', type: 'fixed', value: 20000, minOrder: 0, maxDiscount: 20000, startsAt: new Date(nowTs - 40 * day).toISOString(), expiresAt: new Date(nowTs - 2 * day).toISOString(), totalUses: 100, usedCount: 100, perUser: 1, applyTo: 'all', status: 'active', createdAt: new Date(nowTs - 40 * day).toISOString() },
    { id: 6, code: 'SVIP25', label: 'Thành viên VIP giảm 25%', type: 'percent', value: 25, minOrder: 400000, maxDiscount: 120000, startsAt: new Date(nowTs - 1 * day).toISOString(), expiresAt: new Date(nowTs + 90 * day).toISOString(), totalUses: 100, usedCount: 3, perUser: 1, applyTo: 'all', status: 'active', createdAt: new Date(nowTs - day).toISOString() },
  ];

  const tiers: MembershipTier[] = [
    { key: 'member', label: 'Member', minSpend: 0, perks: ['Tích 1 điểm / 10.000đ', 'Nhận tin khuyến mãi'], color: '#94a3b8' },
    { key: 'silver', label: 'Silver', minSpend: 2000000, perks: ['Tích điểm ×1.2', 'Giảm 5% bắp nước', 'Voucher sinh nhật'], color: '#cbd5e1' },
    { key: 'gold', label: 'Gold', minSpend: 8000000, perks: ['Tích điểm ×1.5', 'Giảm 10% bắp nước', 'Ưu tiên chọn ghế', 'Voucher sinh nhật 100K'], color: '#fbbf24' },
    { key: 'diamond', label: 'Diamond', minSpend: 20000000, perks: ['Tích điểm ×2', 'Miễn phí nâng hạng ghế', 'Phòng chờ VIP', 'Hotline riêng'], color: '#38bdf8' },
  ];

  const database: Database = {
    version: DB_VERSION, seededAt: new Date().toISOString(),
    users, movies: moviesUnsorted, cinemas, rooms, seats, showtimes,
    bookings: [], payments: [], tickets: [], combos, vouchers, voucherUsages: [],
    refunds: [], exceptions: [], auditLogs: [], shifts: [], priceRules, settings,
    notifications: [], banners: [], news: [], reviews: [], tiers, pointTransactions: [],
    checkinLogs: [], favorites: [], pages: [],
  };

  /* ---------------- seeded commerce ---------------- */

  let bookingId = 1;
  let paymentId = 1;
  let ticketId = 1;
  const takenByShowtime = new Map<number, Set<number>>();

  const seatsByRoom = new Map<number, Seat[]>();
  for (const seat of seats) {
    if (!seatsByRoom.has(seat.roomId)) seatsByRoom.set(seat.roomId, []);
    seatsByRoom.get(seat.roomId)!.push(seat);
  }

  const sellable = (showtime: Showtime): Seat[] =>
    (seatsByRoom.get(showtime.roomId) ?? []).filter((s) => s.type === 'standard' || s.type === 'vip' || s.type === 'couple');

  const startMsOf = (s: Showtime) => showtimeStart({ showDate: s.showDate, startTime: s.startTime }).getTime();

  function addBooking(opts: {
    showtime: Showtime; seatList: Seat[]; userId: string | null; status: Booking['status'];
    channel: 'online' | 'pos'; createdAt: string; paidAt?: string; method?: Payment['method'];
    combos?: { combo: Combo; quantity: number }[]; voucher?: Voucher; paymentStatus?: Payment['status'];
    proofUrl?: string; proofHash?: string; customer?: User; staffId?: string; shiftId?: string;
    checkedIn?: boolean; usedTickets?: boolean; reference?: string;
  }): Booking {
    const st = opts.showtime;
    const bookingCode = makeBookingCode();
    const seatSnapshots: BookingSeat[] = opts.seatList.map((s) => ({
      seatId: s.id, code: s.code, type: s.type, price: seatPrice(st.basePrice, s.type, settings), active: true,
    }));
    const ticketsSubtotal = seatSnapshots.reduce((sum, s) => sum + s.price, 0);
    const comboItems = (opts.combos ?? []).map(({ combo, quantity }) => ({
      comboId: combo.id, name: combo.name, price: combo.price, quantity,
    }));
    const combosSubtotal = comboItems.reduce((sum, c) => sum + c.price * c.quantity, 0);
    const discount = opts.voucher
      ? Math.min(
          opts.voucher.type === 'percent' ? Math.round(((ticketsSubtotal + combosSubtotal) * opts.voucher.value) / 100) : opts.voucher.value,
          opts.voucher.maxDiscount || Infinity,
        )
      : 0;
    const finalAmount = Math.max(0, ticketsSubtotal + combosSubtotal - discount);
    const createdAt = opts.createdAt;
    const isPaid = opts.paymentStatus === 'paid' || opts.status === 'confirmed' || opts.status === 'completed';

    const booking: Booking = {
      id: bookingId++, code: bookingCode, userId: opts.userId,
      cinemaId: st.cinemaId, showtimeId: st.id, channel: opts.channel,
      staffId: opts.staffId, shiftId: opts.shiftId,
      status: opts.status, seats: seatSnapshots, combos: comboItems,
      ticketsSubtotal, combosSubtotal, discount, pointsUsed: 0, pointsDiscount: 0,
      taxAmount: includedTax(finalAmount, settings.vatPercent), finalAmount,
      voucherCode: opts.voucher?.code,
      customerName: opts.customer?.name ?? 'Khách lẻ', customerEmail: opts.customer?.email ?? '',
      customerPhone: opts.customer?.phone ?? '',
      holdExpiresAt: isPaid ? new Date(new Date(createdAt).getTime() + 10 * 60_000).toISOString() : new Date(startMsOf(st) - 15 * 60_000).toISOString(),
      holdExtended: false,
      confirmedAt: isPaid ? opts.paidAt : undefined,
      createdAt, updatedAt: opts.paidAt ?? createdAt,
    };

    database.bookings.push(booking);

    if (!takenByShowtime.has(st.id)) takenByShowtime.set(st.id, new Set());
    const taken = takenByShowtime.get(st.id)!;
    for (const s of opts.seatList) taken.add(s.id);

    if (isPaid) {
      const payment: Payment = {
        id: paymentId++, bookingId: booking.id,
        provider: opts.method === 'cash' ? 'cash' : opts.method === 'card' ? 'card' : 'bank_qr',
        method: opts.method ?? 'bank_qr', amount: finalAmount, status: 'paid',
        transferContent: `${settings.transferPrefix} ${bookingCode.slice(-6)}`,
        submittedAt: opts.paidAt, reviewedAt: opts.paidAt,
        reviewedBy: opts.channel === 'pos' ? 'u-staff' : 'u-admin',
        paidAt: opts.paidAt, reference: opts.reference ?? `FT${randomToken(10)}`,
        createdAt, paidAmount: finalAmount,
      };
      database.payments.push(payment);

      for (const seat of seatSnapshots) {
        const ticket: Ticket = {
          id: ticketId++, bookingId: booking.id, seatId: seat.seatId, seatCode: seat.code,
          code: makeTicketCode(), status: opts.usedTickets ? 'used' : opts.status === 'completed' ? 'expired' : 'valid',
          issuedAt: opts.paidAt ?? createdAt,
          checkedInAt: opts.usedTickets ? opts.paidAt : undefined,
          checkedInBy: opts.usedTickets ? 'Trần Quốc Huy' : undefined,
          checkedInCinemaId: opts.usedTickets ? st.cinemaId : undefined,
        };
        database.tickets.push(ticket);
        if (opts.usedTickets) {
          database.checkinLogs.push({
            id: database.checkinLogs.length + 1, ticketCode: ticket.code, result: 'OK',
            staffId: 'u-staff', staffName: 'Trần Quốc Huy', cinemaId: st.cinemaId,
            showtimeId: st.id, at: opts.paidAt ?? createdAt,
          });
        }
      }

      if (opts.voucher) {
        database.voucherUsages.push({
          id: database.voucherUsages.length + 1, voucherCode: opts.voucher.code,
          bookingId: booking.id, userId: opts.userId ?? 'guest', discount,
          at: opts.paidAt ?? createdAt,
        });
        opts.voucher.usedCount += 1;
      }
      for (const item of opts.combos ?? []) {
        item.combo.stock = Math.max(0, item.combo.stock - item.quantity);
        item.combo.sold += item.quantity;
      }
    } else {
      const payment: Payment = {
        id: paymentId++, bookingId: booking.id, provider: 'bank_qr', method: 'bank_qr',
        amount: finalAmount, status: opts.paymentStatus ?? 'pending',
        transferContent: `${settings.transferPrefix} ${bookingCode.slice(-6)}`,
        proofUrl: opts.proofUrl, proofHash: opts.proofHash,
        submittedAt: opts.proofUrl ? opts.createdAt : undefined,
        createdAt,
      };
      database.payments.push(payment);
    }

    return booking;
  }

  const customers = users.filter((u) => u.role === 'customer' && u.status === 'active');

  // 1. Past revenue: completed bookings across the last 30 days.
  for (const st of showtimes.filter((s) => s.status === 'finished')) {
    if (rng() > 0.34) continue;
    const pool = sellable(st).filter((s) => !takenByShowtime.get(st.id)?.has(s.id));
    if (pool.length < 4) continue;
    const count = randInt(1, 3);
    for (let i = 0; i < count; i++) {
      const chosen: Seat[] = [];
      for (let k = 0; k < randInt(1, 3); k++) {
        const candidate = pick(pool);
        if (!chosen.includes(candidate) && !takenByShowtime.get(st.id)?.has(candidate.id)) chosen.push(candidate);
      }
      if (!chosen.length) continue;
      const customer = pick(customers);
      const paidAt = new Date(startMsOf(st) - randInt(30, 400) * 60_000).toISOString();
      const usedTickets = rng() > 0.18;
      const comboPick = rng() > 0.55 ? [{ combo: pick(combos), quantity: randInt(1, 2) }] : [];
      addBooking({
        showtime: st, seatList: chosen, userId: rng() > 0.25 ? customer.id : null,
        status: 'completed', channel: rng() > 0.7 ? 'pos' : 'online', createdAt: paidAt, paidAt,
        method: rng() > 0.7 ? 'cash' : 'bank_qr', combos: comboPick,
        paymentStatus: 'paid', customer, usedTickets,
        staffId: rng() > 0.7 ? 'u-staff' : undefined,
      });
    }
  }

  // 2. Occupancy for today and tomorrow so seat maps feel alive.
  for (const st of showtimes.filter((s) => s.showDate === today || s.showDate === addDaysISO(today, 1))) {
    if (st.status === 'finished') continue;
    const pool = sellable(st);
    const count = randInt(1, 3);
    for (let i = 0; i < count; i++) {
      const chosen: Seat[] = [];
      const desired = randInt(1, 3);
      for (let k = 0; k < desired; k++) {
        const candidate = pick(pool);
        if (!takenByShowtime.get(st.id)?.has(candidate.id) && !chosen.includes(candidate)) chosen.push(candidate);
      }
      if (!chosen.length) continue;
      const customer = pick(customers);
      const paidAt = new Date(Math.max(nowMs - randInt(1, 40) * 3_600_000, startMsOf(st) - 6 * 3600_000)).toISOString();
      addBooking({
        showtime: st, seatList: chosen, userId: customer.id, status: 'confirmed', channel: 'online',
        createdAt: paidAt, paidAt, paymentStatus: 'paid', customer,
      });
    }
  }

  // 3. Demo customer's upcoming ticket + past used ticket.
  const demo = users.find((u) => u.id === 'u-customer')!;
  const upcoming = showtimes.find((s) => s.status === 'selling' && s.showDate === addDaysISO(today, 1) && s.startTime === '20:00')
    ?? showtimes.find((s) => s.status === 'selling');
  if (upcoming) {
    const pool = sellable(upcoming).filter((s) => !takenByShowtime.get(upcoming.id)?.has(s.id));
    const chosen = [pool[2], pool[3]].filter(Boolean) as Seat[];
    if (chosen.length) {
      const paidAt = new Date(nowMs - 26 * 3600_000).toISOString();
      addBooking({
        showtime: upcoming, seatList: chosen, userId: demo.id, status: 'confirmed', channel: 'online',
        createdAt: paidAt, paidAt, paymentStatus: 'paid', customer: demo,
        combos: [{ combo: combos[0], quantity: 1 }], voucher: vouchers[0],
      });
      database.notifications.push({
        id: database.notifications.length + 1, userId: demo.id, title: 'Đặt vé thành công',
        body: `Vé cho suất ${upcoming.startTime} ngày ${upcoming.showDate} đã sẵn sàng. Mã đơn ${database.bookings[database.bookings.length - 1].code}.`,
        type: 'booking', read: false, createdAt: paidAt, link: `/tai-khoan/ve-cua-toi`,
      });
    }
  }
  const pastForDemo = showtimes.find((s) => s.status === 'finished' && s.showDate === addDaysISO(today, -1) && s.startTime === '20:00');
  if (pastForDemo) {
    const pool = sellable(pastForDemo).filter((s) => !takenByShowtime.get(pastForDemo.id)?.has(s.id));
    if (pool.length) {
      const paidAt = new Date(startMsOf(pastForDemo) - 8 * 3600_000).toISOString();
      addBooking({
        showtime: pastForDemo, seatList: [pool[0]], userId: demo.id, status: 'completed',
        channel: 'online', createdAt: paidAt, paidAt, paymentStatus: 'paid', customer: demo, usedTickets: true,
      });
      const movie = moviesUnsorted.find((m) => m.id === pastForDemo.movieId)!;
      database.reviews.push({
        id: 1, movieId: movie.id, userId: demo.id, userName: demo.name, rating: 9,
        comment: 'Hình ảnh và âm thanh rất tốt, phòng chiếu sạch và nhân viên thân thiện. Sẽ quay lại!',
        visible: true, createdAt: new Date(nowMs - 12 * 3600_000).toISOString(),
      });
    }
  }

  // 4. Receipts awaiting review (proof_submitted) for the admin queue.
  const pendingTargets = showtimes
    .filter((s) => s.status === 'selling' && startMsOf(s) > nowMs + 90 * 60_000)
    .filter((_, i) => i % 37 === 0)
    .slice(0, 3);
  pendingTargets.forEach((st, idx) => {
    const pool = sellable(st).filter((s) => !takenByShowtime.get(st.id)?.has(s.id));
    if (pool.length < 2) return;
    const chosen = [pool[0], pool[1]].filter(Boolean);
    const customer = customers[(idx + 1) % customers.length];
    const seeded = addBooking({
      showtime: st, seatList: chosen, userId: customer.id, status: 'holding', channel: 'online',
      createdAt: new Date(nowMs - (idx + 1) * 7 * 60_000).toISOString(),
      customer, paymentStatus: 'proof_submitted',
    });
    const amount = seeded.finalAmount;
    const proof = makeReceiptDataUrl({
      amount, content: `${settings.transferPrefix} ${seeded.code.slice(-6)}`, bank: 'Vietcombank',
      account: '0123456789', owner: 'CONG TY TNHH PXU CINEMA',
      reference: `FT${randomToken(10)}`,
      at: new Date(nowMs - (idx + 1) * 7 * 60_000).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    });
    const payment = database.payments.find((p) => p.bookingId === seeded.id)!;
    payment.proofUrl = proof;
    payment.proofHash = `seed-${idx}-${seeded.code}`;
    payment.submittedAt = new Date(nowMs - (idx + 1) * 6 * 60_000).toISOString();
    payment.paidAmount = amount;
    seeded.holdExpiresAt = new Date(nowMs + (58 - idx * 9) * 60_000).toISOString();
  });

  // 5. A rejected receipt so the customer-facing rejection state is demonstrable.
  const rejectTarget = showtimes.filter((s) => s.status === 'selling' && s.showDate >= today).at(-12);
  if (rejectTarget) {
    const pool = sellable(rejectTarget).filter((s) => !takenByShowtime.get(rejectTarget.id)?.has(s.id));
    if (pool.length) {
      const customer = users.find((u) => u.id === 'u-c2')!;
      const rejected = addBooking({
        showtime: rejectTarget, seatList: [pool[0]], userId: customer.id, status: 'holding',
        channel: 'online', createdAt: new Date(nowMs - 26 * 60_000).toISOString(), customer,
        paymentStatus: 'rejected',
      });
      const payment = database.payments.find((p) => p.bookingId === rejected.id)!;
      payment.rejectReasonCode = 'unclear_proof';
      payment.rejectNote = 'Ảnh biên lai bị mờ, không đọc được số tiền. Vui lòng gửi lại ảnh rõ hơn.';
      payment.proofUrl = makeReceiptDataUrl({
        amount: rejected.finalAmount, content: `${settings.transferPrefix} ${rejected.code.slice(-6)}`,
        bank: 'Vietcombank', account: '0123456789', owner: 'CONG TY TNHH PXU CINEMA',
        reference: `FT${randomToken(10)}`, at: new Date(nowMs - 30 * 60_000).toLocaleString('vi-VN'),
      });
      payment.proofHash = `rejected-${rejected.code}`;
      payment.submittedAt = new Date(nowMs - 30 * 60_000).toISOString();
      payment.reviewedAt = new Date(nowMs - 20 * 60_000).toISOString();
      payment.reviewedBy = 'u-admin';
      rejected.holdExpiresAt = new Date(nowMs + 9 * 60_000).toISOString();
    }
  }

  // 6. POS shift today + cash booking.
  const shift: Shift = {
    id: 1, staffId: 'u-staff', staffName: 'Trần Quốc Huy', cinemaId: 1,
    openedAt: iso(today, '08:30'), openingCash: 1000000, status: 'open', totalSales: 0, transactions: 0,
  };
  database.shifts.push(shift);
  const posShowtime = showtimes.find((s) => s.cinemaId === 1 && s.showDate === today && s.status !== 'finished');
  if (posShowtime) {
    const pool = sellable(posShowtime).filter((s) => !takenByShowtime.get(posShowtime.id)?.has(s.id));
    if (pool.length >= 2) {
      const paidAt = new Date(nowMs - 2 * 3600_000).toISOString();
      const posBooking = addBooking({
        showtime: posShowtime, seatList: [pool[0], pool[1]], userId: null, status: 'confirmed',
        channel: 'pos', createdAt: paidAt, paidAt, method: 'cash', staffId: 'u-staff', shiftId: '1',
        combos: [{ combo: combos[0], quantity: 2 }],
      });
      posBooking.customerName = 'Khách lẻ';
      shift.totalSales += posBooking.finalAmount;
      shift.transactions += 1;
    }
  }
  shift.expectedCash = shift.openingCash + shift.totalSales;

  // 7. Refund request in progress.
  const pastPaid = database.bookings.find((b) => b.status === 'completed');
  if (pastPaid) {
    database.refunds.push({
      id: 1, code: makeRefundCode(), bookingId: pastPaid.id, scope: 'partial',
      seatIds: [pastPaid.seats[0]?.seatId].filter(Boolean), amount: pastPaid.seats[0]?.price ?? 85000,
      reason: 'Khách báo trùng lịch, hoàn 1 ghế theo chính sách', status: 'requested',
      requestedBy: 'u-manager', createdAt: new Date(nowMs - 3 * 3600_000).toISOString(),
    });
  }

  // 8. Payment exceptions.
  database.exceptions.push(
    {
      id: 1, amount: 170000, content: 'PXU 9K2M4Q', receivedAt: new Date(nowMs - 4 * 3600_000).toISOString(),
      bankRef: `FT${randomToken(10)}`, status: 'open',
    },
    {
      id: 2, amount: 340000, content: 'PXU ZX81LP', receivedAt: new Date(nowMs - 26 * 3600_000).toISOString(),
      bankRef: `FT${randomToken(10)}`, status: 'open',
    },
  );

  // 9. Audit logs.
  const auditActions: { action: string; entity: string; actor: string; minutes: number }[] = [
    { action: 'payment.approve', entity: 'order', actor: 'u-admin', minutes: 22 },
    { action: 'showtime.create', entity: 'showtime', actor: 'u-manager', minutes: 130 },
    { action: 'movie.update', entity: 'movie', actor: 'u-admin', minutes: 360 },
    { action: 'voucher.update', entity: 'voucher', actor: 'u-manager', minutes: 820 },
    { action: 'auth.login', entity: 'user', actor: 'u-admin', minutes: 1100 },
    { action: 'payment.reject', entity: 'order', actor: 'u-admin', minutes: 1500 },
    { action: 'seat_layout.update', entity: 'room', actor: 'u-manager', minutes: 2200 },
    { action: 'settings.update', entity: 'settings', actor: 'u-admin', minutes: 2600 },
    { action: 'refund.approve', entity: 'refund', actor: 'u-manager', minutes: 3100 },
    { action: 'user.lock', entity: 'user', actor: 'u-admin', minutes: 4200 },
  ];
  auditActions.forEach((a, i) => {
    const actor = users.find((u) => u.id === a.actor)!;
    database.auditLogs.push({
      id: i + 1, at: new Date(nowMs - a.minutes * 60_000).toISOString(), actorId: actor.id,
      actorName: actor.name, action: a.action, entity: a.entity,
      entityId: a.entity === 'settings' ? 'global' : String(randInt(1, 6)),
      before: a.action === 'settings.update' ? { hold_minutes: 10 } : undefined,
      after: a.action === 'settings.update' ? { hold_minutes: 12 } : undefined,
      ip: `203.113.${randInt(1, 254)}.${randInt(1, 254)}`,
    });
  });

  // 10. Content.
  database.banners = [
    { id: 1, title: 'Hai Phượng', subtitle: 'Ngô Thanh Vân trong màn rượt đuổi nghẹt thở – đang chiếu tại PXU Cinema.', movieId: 1, ctaLabel: 'Mua vé ngay', active: true, order: 1, tone: { from: '#f97316', to: '#7c2d12', accent: '#fed7aa' } },
    { id: 2, title: 'Nhà Bà Nữ', subtitle: 'Gia đình, tiếng cười và những góc tối – phim mới của Trấn Thành.', movieId: 9, ctaLabel: 'Đặt vé', active: true, order: 2, tone: { from: '#fb7185', to: '#9f1239', accent: '#fecdd3' } },
    { id: 3, title: 'Chuyện Ma Gần Nhà', subtitle: 'Vũ trụ kinh dị Việt: nỗi sợ ngay cạnh nhà. T16 – cân nhắc trước khi xem.', movieId: 6, ctaLabel: 'Mua vé', active: true, order: 3, tone: { from: '#22d3ee', to: '#0e7490', accent: '#a5f3fc' } },
    { id: 4, title: 'Thành viên Diamond', subtitle: 'Nâng hạng ghế miễn phí, phòng chờ VIP và hotline riêng.', ctaLabel: 'Tìm hiểu', active: false, order: 4, tone: { from: '#0ea5e9', to: '#082f49', accent: '#bae6fd' } },
  ];

  database.news = [
    { id: 1, title: 'PXU Cinema ra mắt phòng Gold Class tại Royal City', slug: 'ra-mat-phong-gold-class', excerpt: 'Trải nghiệm ghế êm, phục vụ tại chỗ và không gian riêng tư cho những buổi hẹn đặc biệt.', body: 'PXU Cinema chính thức khai trương phòng Gold Class tại PXU Cinema Royal City với 104 chỗ ngồi, ghế da cao cấp và dịch vụ phục vụ tại chỗ. Khách hàng Gold Class được ưu tiên check-in riêng và nhận combo bắp nước tại ghế.', imageTone: '#fbbf24', tag: 'Tin rạp', publishedAt: new Date(nowMs - 3 * day).toISOString(), status: 'published' },
    { id: 2, title: 'Ưu đãi 50K cho thành viên khi đặt vé online', slug: 'uu-dai-50k-thanh-vien', excerpt: 'Nhập mã PXU50K cho đơn từ 300.000đ, áp dụng đến hết tháng này.', body: 'Chương trình áp dụng cho khách hàng đặt vé trực tuyến tại PXU Cinema, không áp dụng đồng thời với các chương trình giảm giá khác. Mỗi tài khoản sử dụng 1 lần.', imageTone: '#ff6600', tag: 'Khuyến mãi', publishedAt: new Date(nowMs - 2 * day).toISOString(), status: 'published' },
    { id: 3, title: 'Hướng dẫn nhận bắp nước khi đặt combo online', slug: 'huong-dan-nhan-bap-nuoc', excerpt: 'Xuất trình mã đơn tại quầy bắp nước, không cần check-in như vé.', body: 'Sau khi đặt vé và combo online, bạn nhận được mã QR đơn hàng trong mục "Vé của tôi". Tại rạp, đến quầy bắp nước, xuất trình mã này để nhận combo. Combo chỉ nhận một lần và không hoàn tiền sau khi nhận.', imageTone: '#22c55e', tag: 'Hướng dẫn', publishedAt: new Date(nowMs - 5 * day).toISOString(), status: 'published' },
  ];

  database.pages = [
    { slug: 'dieu-khoan', title: 'Điều khoản sử dụng', body: 'Khi sử dụng dịch vụ của PXU Cinema, bạn đồng ý với các điều khoản về đặt vé, thanh toán, hoàn hủy và bảo mật thông tin cá nhân theo quy định pháp luật hiện hành, bao gồm Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.' },
    { slug: 'chinh-sach-hoan-huy', title: 'Chính sách hoàn hủy', body: 'Khách hàng có thể tự hủy đơn đang giữ ghế. Đơn đã thanh toán chỉ được hoàn theo chính sách của rạp: hủy trước giờ chiếu tối thiểu 2 giờ, mức hoàn do quản lý rạp quyết định. Vé đã sử dụng không thể hủy hoặc hoàn.' },
    { slug: 'bao-mat', title: 'Chính sách bảo mật', body: 'PXU Cinema chỉ thu thập thông tin cần thiết cho việc đặt vé và chăm sóc khách hàng. Dữ liệu được lưu trữ an toàn, không chia sẻ cho bên thứ ba ngoài đơn vị thanh toán và đơn vị vận chuyển thông báo.' },
    { slug: 'faq', title: 'Câu hỏi thường gặp', body: 'Tôi có thể đổi ghế sau khi thanh toán? — Có, nếu còn ít nhất 30 phút trước giờ chiếu và ghế mới có giá bằng hoặc thấp hơn. Tôi cần mang gì khi nhận vé ưu đãi? — Vui lòng mang giấy tờ chứng minh (HSSV, CCCD) để nhân viên kiểm tra tại cửa phòng.' },
    { slug: 'quy-che-rap', title: 'Quy chế rạp', body: 'Không mang thức ăn từ bên ngoài vào phòng chiếu. Vui lòng giữ trật tự, tắt chuông điện thoại. Phim T16/T18 yêu cầu xuất trình giấy tờ hợp lệ. Trẻ em dưới 13 tuổi cần người bảo hộ khi xem phim nhãn K.' },
  ];

  database.notifications.push(
    { id: database.notifications.length + 1, userId: 'u-admin', title: 'Có biên lai mới chờ duyệt', body: '3 biên lai đang chờ xác nhận thanh toán. Ưu tiên xử lý đơn chờ lâu nhất.', type: 'payment', read: false, createdAt: new Date(nowMs - 6 * 60_000).toISOString(), link: '/admin/duyet-bien-lai' },
    { id: database.notifications.length + 1, userId: 'u-admin', title: 'Cảnh báo tồn kho', body: 'Nachos Sốt Phô Mai đã hết hàng. Cập nhật kho để tiếp tục bán.', type: 'system', read: false, createdAt: new Date(nowMs - 40 * 60_000).toISOString(), link: '/admin/combo' },
    { id: database.notifications.length + 1, userId: 'u-customer', title: 'Ưu đãi dành cho bạn', body: 'Nhập mã PXU10 giảm 10% cho đơn tiếp theo, tối đa 50.000đ.', type: 'promo', read: true, createdAt: new Date(nowMs - 2 * day).toISOString(), link: '/khuyen-mai' },
  );

  database.favorites = [{ userId: 'u-customer', movieId: 1 }, { userId: 'u-customer', movieId: 5 }];
  database.pointTransactions = [
    { id: 1, userId: 'u-customer', type: 'earn', points: 85, reason: 'Thanh toán đơn hàng', at: new Date(nowMs - 26 * 3600_000).toISOString() },
    { id: 2, userId: 'u-customer', type: 'adjust', points: 120, reason: 'Quà tặng sinh nhật', at: new Date(nowMs - 8 * day).toISOString() },
    { id: 3, userId: 'u-customer', type: 'redeem', points: -50, reason: 'Đổi voucher bắp nước', at: new Date(nowMs - 15 * day).toISOString() },
  ];

  database.reviews.push(
    { id: 2, movieId: 2, userId: 'u-c3', userName: 'Đặng Khánh Linh', rating: 9, comment: 'Bối cảnh Hà Nội 60 ngày đêm rất đẹp, diễn xuất tốt và cảm xúc. Một bộ phim Việt đáng xem.', visible: true, createdAt: new Date(nowMs - 2 * day).toISOString() },
    { id: 3, movieId: 5, userId: 'u-c2', userName: 'Võ Hoàng Nam', rating: 8, comment: 'Rất phù hợp cho gia đình có trẻ nhỏ. Con mình thích nhất bộ tứ Tí – Sửu – Dần – Mẹo.', visible: true, createdAt: new Date(nowMs - 4 * day).toISOString() },
    { id: 4, movieId: 6, userId: 'u-c6', userName: 'Đỗ Anh Khoa', rating: 9, comment: 'Kinh dị dân gian Việt Nam làm rất có không khí. Nhớ mang CCCD vì phim T16.', visible: false, createdAt: new Date(nowMs - 1 * day).toISOString() },
  );

  for (const c of customers) {
    if (c.id === 'u-customer') continue;
    database.notifications.push({
      id: database.notifications.length + 1, userId: c.id, title: 'Chào mừng đến PXU Cinema',
      body: 'Khám phá phim đang chiếu và ưu đãi thành viên mới.', type: 'promo',
      read: false, createdAt: new Date(nowMs - 3 * day).toISOString(), link: '/phim',
    });
  }

  return database;
}

/**
 * Bổ sung cụm rạp Huế cho database đã seed trước đó mà không làm mất đơn hàng.
 * Trả về true nếu có thay đổi để server persist.
 */
export function ensureHueCinema(db: Database): boolean {
  if (db.cinemas.some((cinema) => cinema.city.toLocaleLowerCase('vi').includes('huế'))) return false;

  const cinemaId = Math.max(0, ...db.cinemas.map((cinema) => cinema.id)) + 1;
  db.cinemas.push({
    id: cinemaId,
    name: 'PXU Cinema Huế',
    address: 'Tầng 3, Vincom Plaza Huế, 50A Hùng Vương, Phường Phú Nhuận',
    city: 'TP. Huế',
    hotline: '1900 6365',
    imageTone: '#10b981',
  });

  const sources = [
    { room: db.rooms.find((room) => room.cinemaId === 1 && room.type === '2D'), name: 'Cinema 01', type: '2D' as const },
    { room: db.rooms.find((room) => room.cinemaId === 1 && room.type === '3D'), name: 'Cinema 02', type: '3D' as const },
  ].filter((source) => Boolean(source.room));

  let roomId = Math.max(0, ...db.rooms.map((room) => room.id)) + 1;
  let seatId = Math.max(0, ...db.seats.map((seat) => seat.id)) + 1;
  let showtimeId = Math.max(0, ...db.showtimes.map((showtime) => showtime.id)) + 1;

  for (const source of sources) {
    const room: Room = {
      id: roomId++,
      cinemaId,
      name: source.name,
      type: source.type,
      status: 'active',
    };
    db.rooms.push(room);

    for (const seat of db.seats.filter((item) => item.roomId === source.room!.id)) {
      db.seats.push({ ...seat, id: seatId++, roomId: room.id });
    }

    for (const showtime of db.showtimes.filter((item) => item.roomId === source.room!.id)) {
      db.showtimes.push({
        ...showtime,
        id: showtimeId++,
        roomId: room.id,
        cinemaId,
        blockedSeatIds: [],
      });
    }
  }

  return true;
}

/**
 * Chuyển bảng giá cũ (60/95/170k) sang giá vé thống nhất 50k thường · 80k VIP · 110k đôi.
 * Chỉ chạy một lần khi phát hiện cấu hình phụ phí cũ.
 */
export function ensureTicketPricing(db: Database): boolean {
  const current = db.settings.seatSurcharge;
  const isLegacy = current.standard === 0 && current.vip === 35000 && current.couple === 50000;
  if (!isLegacy) return false;

  db.settings.seatSurcharge = { standard: 0, vip: 30000, couple: 10000 };
  for (const rule of db.priceRules) rule.price = 50000;
  for (const showtime of db.showtimes) showtime.basePrice = 50000;
  return true;
}

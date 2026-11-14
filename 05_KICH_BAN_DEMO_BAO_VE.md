# KỊCH BẢN DEMO BẢO VỆ ĐỒ ÁN — PXU CINEMA

> Dùng kèm: `01_TAI_LIEU_NGHIEP_VU.md` (nghiệp vụ), `02`–`04` (giao diện, kỹ thuật).
> Tài liệu này chỉ chứa **những gì cần bấm, cần nói, và cần trả lời**.

---

## 0. THÔNG TIN CHUNG

| Hạng mục | Nội dung |
|---|---|
| Link demo | **https://pxucinema.vercel.app** |
| Thời lượng | 12–14 phút (bản rút gọn 8 phút ở mục 7) |
| Cấu trúc | Mở đầu 1' → Khách hàng 4' → Nhân viên 2' → Quản lý 4' → Kỹ thuật 1,5' → Kết 0,5' |
| Tài khoản | `khach@pxu.vn` / `Khach@123` · `staff@pxu.vn` / `Staff@123` · `manager@pxu.vn` / `Manager@123` · `admin@pxu.vn` / `Admin@123` |
| Điểm mạnh cần nhấn | Nghiệp vụ rạp phim **đầy đủ 4 phân hệ**, dữ liệu **online thật** (Supabase), phân quyền RBAC, máy trạng thái đơn hàng, audit log |

### Ba con số mở đầu (nói ngay 10 giây đầu)

> “Hệ thống có **42 phim – 3 rạp – 8 phòng – 832 ghế – 1.352 suất chiếu**, hơn **800 đơn đặt vé** và
> **1.500 vé** trong dữ liệu mẫu; toàn bộ chạy trên **một cơ sở dữ liệu online dùng chung**.”

---

## 1. CHUẨN BỊ TRƯỚC 10 PHÚT (bắt buộc)

### 1.1. Thiết bị & trình duyệt

- [ ] **Máy tính đã cắm sạc**, tắt thông báo Windows/Zalo/Messenger.
- [ ] **Trình duyệt 1 (Chrome)**: dùng cho KHÁCH HÀNG — đăng nhập sẵn `khach@pxu.vn`.
- [ ] **Trình duyệt 2 (Edge / cửa sổ Ẩn danh)**: dùng cho NHÂN VIÊN + QUẢN LÝ.
      → Lý do: phiên đăng nhập lưu trong `localStorage`, mở 2 tab cùng trình duyệt sẽ **dùng chung 1 tài khoản**.
- [ ] Phóng to 110–125% (`Ctrl` + `+`) để hội đồng đọc được chữ.
- [ ] Ẩn thanh bookmark, đóng tab thừa.

### 1.2. Mở sẵn 4 tab (đừng bấm lung tung khi demo)

| Tab | URL | Dùng ở phần |
|---|---|---|
| 1 | `/` (Trang chủ) | Mở đầu |
| 2 | `/admin` (Bảng điều khiển) — đăng nhập `admin@pxu.vn` | Phần quản lý |
| 3 | `/staff/quet-ve` — đăng nhập `staff@pxu.vn` | Phần nhân viên |
| 4 | `/tai-khoan/ve-cua-toi` — đăng nhập `khach@pxu.vn` | Vé của khách |

> Cách chia: **tab 1 + 4** (khách) ở trình duyệt 1; **tab 2 + 3** (quản lý, nhân viên) ở trình duyệt 2.

### 1.3. Chọn sẵn “suất chiếu demo” (bắt buộc — quyết định buổi demo trôi chảy)

Ba điều kiện phải chọn đúng, nếu không phần quét vé sẽ báo lỗi trước mặt hội đồng:

| Điều kiện | Lý do |
|---|---|
| Rạp **PXU Cinema Landmark** (rạp số 1) | Tài khoản `staff@pxu.vn` và `manager@pxu.vn` chỉ có quyền **trong rạp 1**; đặt ở rạp khác sẽ bị báo “vé thuộc rạp khác” |
| Suất chiếu **trong vòng 60 phút tới** | Cổng soát vé chỉ mở **trước giờ chiếu 60 phút** (và cho trễ 30 phút sau khi phim kết thúc) |
| Còn ghế trống | Để chọn được 2 ghế ở bước sau |

**Cách xử lý nếu hôm đó không có suất nào trong 60 phút tới:**

- Cách A (khuyến nghị): vào `/admin/suat-chieu` tạo 1 suất cho **phòng 1 – PXU Cinema Landmark**, giờ hiện tại **+30 phút** → vừa có suất đẹp, vừa demo được chức năng xếp suất.
- Cách B: đăng nhập `manager@pxu.vn` khi soát vé → hệ thống hiện nút **“Ghi đè”**, nhập PIN **`1234`** để bỏ qua kiểm tra thời gian.

### 1.4. Kiểm tra “dữ liệu demo” có sẵn để khoe

Vào `/admin` và **đối chiếu trước giờ G** (số có thể thay đổi sau mỗi lần tập):

| Màn hình | Cần thấy | Ý nghĩa để nói |
|---|---|---|
| Menu **Duyệt biên lai** | huy hiệu **2** | 2 biên lai khách đã chuyển khoản, chờ duyệt tay |
| Menu **Hoàn tiền** | huy hiệu **1** | 1 yêu cầu hoàn tiền đang chờ xử lý |
| Menu **Giao dịch bất thường** | huy hiệu **2** | 2 giao dịch lệch trạng thái cần khôi phục đơn |

Nếu các số này bằng 0 → **reset dữ liệu** theo mục 6 rồi kiểm tra lại.

### 1.5. Phương án dự phòng (chuẩn bị 5 phút, dùng khi mạng hỏng)

- [ ] Chụp ảnh màn hình 10 màn chính, để trong 1 thư mục `demo-anh/`.
- [ ] Quay video 3 phút toàn bộ luồng đặt vé (làm sẵn từ hôm trước).
- [ ] Chạy được bản local (`npm run dev`) trên laptop — dùng khi Vercel/Supabase có sự cố.
- [ ] Điện thoại bật 4G làm điểm phát wifi dự phòng.

---

## 2. TIMELINE 14 PHÚT

| Phút | Nội dung | Màn hình |
|---|---|---|
| 0:00–1:00 | Mở đầu: bài toán, phạm vi, kiến trúc tổng quan | Trang chủ |
| 1:00–2:00 | Khách: trang chủ, tìm phim, chi tiết phim | `/`, `/phim`, `/phim/:slug` |
| 2:00–5:00 | Khách: **đặt vé 4 bước** (ghế → combo → xác nhận → thanh toán QR) → nhận vé điện tử | `/dat-ve/...`, `/thanh-toan/...`, `/ve/...` |
| 5:00–5:30 | Khách: điểm thưởng, hạng thành viên, đơn của tôi | `/tai-khoan/diem-thuong` |
| 5:30–7:00 | Nhân viên: quét vé vừa đặt, POS bán tại quầy | `/staff/quet-ve`, `/staff/ban-ve` |
| 7:00–9:00 | Quản lý: dashboard + duyệt biên lai + hoàn tiền + bất thường | `/admin`, `/admin/duyet-bien-lai`… |
| 9:00–11:00 | Quản lý: phim, suất chiếu, rạp/phòng, sơ đồ ghế, bảng giá | `/admin/phim`, `/admin/suat-chieu`, `/admin/rap` |
| 11:00–12:00 | Quản lý: voucher, thành viên, báo cáo, nhật ký | `/admin/bao-cao`, `/admin/nhat-ky` |
| 12:00–13:30 | Kỹ thuật: kiến trúc, RPC, state machine, RBAC, Supabase/Vercel | Sơ đồ + 2 tab |
| 13:30–14:00 | Kết: hạn chế & hướng phát triển | — |

---

## 3. KỊCH BẢN CHI TIẾT (nói gì – bấm gì)

### PHẦN 1 — MỞ ĐẦU (1 phút)

**Bấm:** giữ ở Trang chủ `/`.

**Nói:**
> “Đề tài giải quyết bài toán đặt vé xem phim: khách tự chọn ghế và thanh toán online, nhân viên soát vé
> và bán tại quầy, quản lý theo dõi doanh thu và cấu hình hệ thống.
> Kiến trúc gồm React + TypeScript ở frontend, toàn bộ nghiệp vụ đóng gói thành **một tầng RPC duy nhất**,
> dữ liệu lưu trên **PostgreSQL của Supabase** và phát hành trên **Vercel**.”

**Nhấn mạnh điểm khác biệt:**
> “Đây không phải bản mock tĩnh: hai máy khác nhau mở cùng link sẽ thấy **cùng một dữ liệu**.”

---

### PHẦN 2 — PHÂN HỆ KHÁCH HÀNG (4 phút)

#### 2.1. Trang chủ (20 giây) — `/`

- Cuộn nhẹ: banner phim nổi bật → “Đang chiếu & sắp chiếu” → “Combo xem phim trọn vị”.
- **Nói:** “Trang chủ tổng hợp banner, phim đang chiếu/sắp chiếu, combo và khối đặt vé nhanh (chọn phim – rạp – ngày – suất).”

#### 2.2. Danh sách & chi tiết phim (30 giây)

- Bấm **Phim** → `/phim`: lọc theo trạng thái (đang chiếu / sắp chiếu), thể loại, tìm kiếm.
- Bấm một phim → `/phim/bo-tu-bao-thu`.
- **Nói:** “Trang chi tiết gồm trailer, nội dung, độ tuổi, đánh giá và **lịch chiếu theo rạp – ngày – suất**; bấm suất chiếu là vào thẳng bước chọn ghế.”

#### 2.3. Đặt vé 4 bước (2,5 phút) — phần quan trọng nhất

**Chọn suất:** ở trang chi tiết phim, tab **Lịch chiếu**, chọn rạp **PXU Cinema Landmark**, ngày hôm nay, bấm suất đã chọn ở mục 1.3.

**Bước 1 — Chọn ghế:** `/dat-ve/{showtimeId}/ghe`
- Bấm 2 ghế (1 ghế thường + 1 ghế VIP nếu có) → panel bên phải hiện tạm tính.
- **Nói:** “Sơ đồ ghế lấy trực tiếp từ cấu hình phòng; ghế đã bán/bị khoá bị disable.
  Mỗi đơn **tối đa 8 ghế**, ghế được **giữ 10 phút** để tránh tranh chấp.”
- Bấm **Tiếp tục** → hệ thống tạo đơn ở trạng thái `holding` (giữ ghế).

**Bước 2 — Combo bắp nước:** `/dat-ve/{bookingCode}/bap-nuoc`
- Tăng 1 combo (ví dụ Combo Couple) → **Tiếp tục**.

**Bước 3 — Xác nhận, voucher & điểm:** `/dat-ve/{bookingCode}/xac-nhan`
- Nhập voucher **`PXU10`** → bấm áp dụng → tổng tiền giảm 10%
  (đơn tối thiểu **100.000đ**, giảm tối đa **50.000đ** — chọn 2 ghế là đủ điều kiện).
- Kéo xuống mục **Voucher & điểm thưởng**: dùng điểm (tối đa 20% giá trị đơn).
- Kiểm tra thông tin người nhận (họ tên / SĐT / email).
- **Nói:** “Voucher được kiểm tra hạn dùng, giá trị đơn tối thiểu và số lần sử dụng; điểm thưởng
  quy đổi **10.000đ = 1 điểm**, khấu trừ tối đa 20%.”

**Bước 4 — Thanh toán QR:** `/thanh-toan/{bookingCode}`
- Chỉ vào **đồng hồ đếm ngược giữ ghế** + nút **“Gia hạn +5'”**, mã VietQR, số tiền, nội dung chuyển khoản (có tiền tố mã đơn để đối soát).
- **Nói:** “Hệ thống sinh VietQR động theo đúng số tiền và nội dung đơn; hỗ trợ cả ảnh QR tĩnh của rạp.
  Cấu hình ngân hàng, số tài khoản sửa được trong Admin → Thanh toán QR.”
- Bấm **“Thanh toán thành công”** → vé phát hành ngay (bản demo chạy chế độ xác nhận nhanh;
  chế độ duyệt biên lai tay sẽ demo ở phần quản lý).

**Nhận vé — Vé điện tử:** `/ve/{bookingCode}`
- Hiện **QR vé**, mã vé, ghế, phòng, giờ chiếu; có nút tải vé / thêm vào lịch / gửi lại email.
- **Nói:** “Mỗi ghế sinh một mã vé riêng, có trạng thái `valid → used/expired`, dùng để quét ở cổng soát vé.”
- **Để nguyên tab này** — phần nhân viên sẽ dùng chính mã vé vừa tạo.

#### 2.4. Tài khoản khách (30 giây)

- `/tai-khoan/ve-cua-toi`: danh sách vé, lọc theo trạng thái, mở lại QR.
- `/tai-khoan/diem-thuong`: điểm hiện có, lịch sử tích/tiêu điểm, hạng thành viên
  (Member → Silver → Gold → Diamond theo mốc chi tiêu).
- `/tai-khoan/thong-bao`: thông báo đặt vé thành công, nhắc suất chiếu.

---

### PHẦN 3 — PHÂN HỆ NHÂN VIÊN (2 phút, trình duyệt 2)

#### 3.1. Quét vé (45 giây) — `/staff/quet-ve`

- Dán **mã vé** vừa đặt ở phần 2 (hoặc quét QR nếu có webcam) → bấm soát vé.
- **Nói:** “Hệ thống kiểm tra lần lượt: mã vé có tồn tại, đơn đã thanh toán, vé **chưa được dùng**,
  **đúng rạp** của nhân viên, và có nằm trong **khung giờ soát vé** (mở trước 60 phút, cho trễ 30 phút sau khi kết thúc).
  Mỗi lượt quét — kể cả lượt thất bại — đều ghi **nhật ký check-in** kèm nhân viên, rạp và thời điểm.”
- Quét lại lần 2 để hội đồng thấy thông báo chặn trùng: “Vé đã được sử dụng lúc … bởi Trần Quốc Huy”.
- **Nếu báo “Chưa đến giờ vào phòng”**: dùng tài khoản `manager@pxu.vn` → nút **Ghi đè** → PIN **`1234`**.

#### 3.2. Bán vé tại quầy (45 giây) — `/staff/ban-ve`

- **Nói:** “POS dành cho khách mua trực tiếp: chọn suất → chọn ghế → bán combo → thu tiền mặt hoặc QR →
  in vé. Đơn tại quầy ghi `channel = pos` để tách doanh thu online/offline trong báo cáo.”
- Thao tác nhanh 1 đơn (nếu còn thời gian).

#### 3.3. Vé trong ngày & ca làm việc (30 giây)

- `/staff/ve-trong-ngay`: danh sách vé theo suất, trạng thái, tìm theo mã/ghế/SĐT.
- `/staff/ca-lam-viec`: mở ca – đóng ca, đối chiếu tiền mặt đầu/cuối ca.

---

### PHẦN 4 — PHÂN HỆ QUẢN LÝ (4 phút, đăng nhập `admin@pxu.vn`)

#### 4.1. Bảng điều khiển (40 giây) — `/admin`

- Chỉ vào 6 chỉ số: **Doanh thu hôm nay, Doanh thu tháng, Vé bán hôm nay, Tỷ lệ lấp đầy,
  Biên lai chờ duyệt, Đơn hết hạn hôm nay**.
- Biểu đồ: doanh thu theo ngày, cơ cấu kênh bán (online/pos), vé bán theo ngày, top 5 phim,
  suất chiếu sắp tới, cảnh báo vận hành.
- **Nói:** “Mọi số liệu tính từ dữ liệu giao dịch thật, không hard-code.”

#### 4.2. Quy trình duyệt biên lai (45 giây) — `/admin/duyet-bien-lai`

- Mở 1 phiếu **chờ duyệt** → xem ảnh biên lai, số tiền, nội dung chuyển khoản → **Duyệt**.
- **Nói:** “Đây là nhánh xác nhận thủ công: khách tải ảnh biên lai, kế toán đối chiếu rồi duyệt.
  Duyệt xong hệ thống tự phát hành vé và cộng điểm. Từ chối thì đơn quay lại trạng thái chờ thanh toán.”
- **Nhấn:** “Duyệt/từ chối đều ghi **audit log** — ai làm, lúc nào.”

#### 4.3. Hoàn tiền (30 giây) — `/admin/hoan-tien`

- Mở yêu cầu hoàn tiền (mã đơn, số tiền, lý do) → duyệt hoàn.
- **Nói:** “Chính sách huỷ/hoàn cấu hình được: huỷ trước bao nhiêu giờ, hoàn bao nhiêu %,
  ngưỡng tiền phải duyệt tay.”

#### 4.4. Giao dịch bất thường (30 giây) — `/admin/giao-dich-bat-thuong`

- Mở 1 bản ghi → bấm **Khôi phục đơn**.
- **Nói:** “Đây là công cụ ‘cứu’ các đơn lệch trạng thái (đã trừ tiền nhưng đơn hết hạn, hoặc ngược lại) —
  tình huống có thật khi tích hợp cổng thanh toán.”

#### 4.5. Quản lý phim & suất chiếu (40 giây)

- `/admin/phim`: bảng phim, tìm kiếm, đổi trạng thái, mở form thêm/sửa phim.
- `/admin/suat-chieu`: tạo suất chiếu cho phòng/ngày giờ.
  - **Nói:** “Khi xếp suất, hệ thống **chặn trùng giờ** và tự trừ **thời gian dọn phòng** giữa hai suất;
    giá vé lấy theo **bảng giá** (ghế thường/VIP/couple, phụ thu, làm tròn).”

#### 4.6. Rạp, phòng & thiết kế sơ đồ ghế (30 giây)

- `/admin/rap` → mở một phòng → **Thiết kế sơ đồ ghế**.
- **Nói:** “Sơ đồ ghế là lưới kéo-thả: đổi loại ghế (thường/VIP/couple), đánh dấu ghế hỏng,
  sức chứa cập nhật theo thời gian thực. Đây là dữ liệu gốc cho bước chọn ghế của khách.”

#### 4.7. Báo cáo, nhật ký, cài đặt (40 giây)

- `/admin/bao-cao`: doanh thu theo phim/rạp/kênh, tỷ lệ lấp đầy, xuất dữ liệu.
- `/admin/nhat-ky`: lọc theo người dùng, hành động, thời gian.
- `/admin/cai-dat`: các tham số nghiệp vụ (VAT 8%, giữ ghế 10 phút, tối đa 8 ghế/đơn,
  10.000đ = 1 điểm, giờ mở/đóng bán vé, chế độ xác nhận thanh toán…).
- **Nói:** “Toàn bộ quy tắc nghiệp vụ nằm ở cấu hình, không sửa code — đổi chính sách là đổi tham số.”

---

### PHẦN 5 — KỸ THUẬT (1,5 phút)

**Nói theo 5 gạch đầu dòng (không mở code nếu hội đồng không yêu cầu):**

1. **Frontend:** React 18 + TypeScript + Vite + Tailwind; TanStack Query cho cache/mutations; Zustand cho phiên đăng nhập; React Hook Form + Zod cho form.
2. **Kiến trúc:** toàn bộ nghiệp vụ gom vào **một tầng RPC** (`rpc(fn, args)`) → frontend không biết dữ liệu nằm ở đâu;
   đổi backend chỉ sửa 1 chỗ.
3. **Nghiệp vụ:** máy trạng thái đơn hàng `holding → confirmed → completed` (+ `expired`, `cancelled`, `refunded`),
   kiểm tra tồn ghế, hold timeout, hoàn điểm/voucher khi huỷ.
4. **Phân quyền:** RBAC theo vai trò (customer / staff / manager / admin) ở cả UI và tầng RPC — không chỉ ẩn nút.
5. **Dữ liệu & triển khai:** PostgreSQL (Supabase) lưu dạng JSONB theo từng collection; Vercel phát hành bản build tĩnh.
   **Mở 2 máy/2 trình duyệt cùng lúc** để chứng minh dữ liệu dùng chung.

**Câu chốt:**
> “Vì dữ liệu ở online nên em có thể mở song song máy khách và máy nhân viên: đặt vé ở máy này, quét vé ở máy kia ngay lập tức.”

**Sơ đồ để vẽ lên slide / bảng (nếu hội đồng hỏi kiến trúc):**

```
        Người dùng (khách · nhân viên · quản lý · admin)
                            │
        React 18 + TypeScript + Vite + Tailwind
        TanStack Query (cache/mutation) · Zustand (phiên) · Zod (form)
                            │
                    rpc(fn, args)   ← MỘT cửa duy nhất
                            │
        ┌───────────────────┴────────────────────┐
        │                                        │
(A) Engine nghiệp vụ chạy trong trình duyệt   (B) Express API (/api/rpc)
    → Supabase PostgreSQL (JSONB)                 → MySQL (XAMPP, local)
    → bản đang chạy trên Vercel                   → bản chạy local dev
        └────────────────────────────────────────┘
                     Vercel (static + rewrite SPA)
```

**Bảng quy tắc nghiệp vụ đang cấu hình (nói nếu bị hỏi con số):**

| Tham số | Giá trị |
|---|---|
| Thời gian giữ ghế | 10 phút (+ gia hạn 5 phút) |
| Số ghế tối đa / đơn | 8 |
| VAT | 8% |
| Tích điểm | 10.000đ = 1 điểm, khấu trừ tối đa 20% đơn |
| Huỷ vé | trước giờ chiếu 2 giờ |
| Soát vé | mở trước 60 phút, trễ tối đa 30 phút sau khi kết thúc |
| Hạng thành viên | Member → Silver → Gold → Diamond (mốc 0 / 2tr / 8tr / 20tr) |

---

### PHẦN 6 — KẾT (30 giây)

> “Hạn chế hiện tại: xác thực dùng session nội bộ thay vì chuẩn OAuth/JWT đầy đủ; xử lý ghi đồng thời theo
> hướng ‘lần ghi sau thắng’ nên phù hợp đồ án/demo, muốn lên production cần API server có transaction và RLS chặt hơn.
> Hướng phát triển: tích hợp cổng thanh toán thật (VNPay/MoMo webhook), gửi email/SMS thật, app mobile cho nhân viên quét vé.”

---

## 4. BẢNG “MỖI MÀN HÌNH NÓI GÌ” (nếu bị hỏi nhanh)

| Màn hình | Thông điệp 1 dòng |
|---|---|
| Trang chủ | Điểm vào: banner, phim, combo, đặt vé nhanh |
| Danh sách phim | Tìm/lọc phim theo trạng thái, thể loại |
| Chi tiết phim | Trailer, nội dung, lịch chiếu theo rạp/ngày |
| Chọn ghế | Sơ đồ ghế thật, giữ ghế 10', tối đa 8 ghế |
| Combo | Bán thêm bắp nước trong luồng đặt vé |
| Xác nhận | Voucher + điểm thưởng + thông tin người nhận |
| Thanh toán | VietQR động, nội dung chuyển khoản = mã đơn |
| Vé | QR từng ghế, tải/in, gửi email |
| Điểm thưởng | Tích điểm, hạng thành viên, lịch sử |
| Quét vé | Chống trùng, đúng rạp, ghi log check-in |
| POS | Bán tại quầy, tách kênh doanh thu |
| Dashboard | KPI + biểu đồ tính từ dữ liệu thật |
| Duyệt biên lai | Xác nhận thủ công → tự phát hành vé |
| Hoàn tiền | Chính sách huỷ/hoàn cấu hình được |
| Bất thường | Khôi phục đơn lệch trạng thái |
| Suất chiếu | Chặn trùng giờ, trừ thời gian dọn phòng |
| Sơ đồ ghế | Thiết kế phòng kéo-thả, loại ghế + giá |
| Báo cáo | Doanh thu theo phim/rạp/kênh, lấp đầy |
| Nhật ký | Truy vết thao tác quản trị |
| Cài đặt | Toàn bộ quy tắc nghiệp vụ thành tham số |

---

## 5. CÂU HỎI HỘI ĐỒNG HAY HỎI — TRẢ LỜI MẪU

**1. “Dữ liệu có dùng chung giữa các máy không, hay chỉ lưu trên máy?”**
> “Dùng chung. Dữ liệu nằm trên PostgreSQL của Supabase; mở máy khác là thấy ngay. Em có thể chứng minh bằng 2 trình duyệt.”

**2. “Vì sao chọn Supabase thay vì tự viết backend?”**
> “Đồ án tập trung vào nghiệp vụ và giao diện. Supabase cho PostgreSQL + REST sẵn, miễn phí, có RLS — đủ cho quy mô demo và vẫn là SQL thật, không phải mock.”

**3. “Anon key công khai trong bundle thì bảo mật thế nào?”**
> “Đây là anon key của Supabase, bản chất công khai; quyền thật do **RLS policy** quyết định. Bản demo đang mở quyền đọc/ghi để tiện chấm, khi lên production sẽ siết policy theo người dùng và chuyển xác thực sang Supabase Auth/JWT.”

**4. “Nếu 2 người đặt cùng một ghế thì sao?”**
> “Ghế bị giữ ngay khi tạo đơn (trạng thái `holding`, hết hạn 10 phút) nên người thứ hai không chọn được. Ở tầng dữ liệu, bản demo dùng cơ chế ghi sau thắng; lên production sẽ khoá ghế bằng transaction ở server.”

**5. “Phân quyền làm ở đâu, có chặn được nếu gọi API trực tiếp không?”**
> “RBAC kiểm tra ở tầng RPC trước khi thực thi, không chỉ ẩn nút trên UI. Khách gọi thẳng API quản trị vẫn bị chặn bởi permission.”

**6. “Máy trạng thái đơn hàng gồm những gì?”**
> “`holding` (giữ ghế) → `confirmed` (đã thanh toán) → `completed` (đã xem/phát hành vé xong); nhánh phụ `expired` khi hết thời gian giữ, `cancelled` khi khách huỷ, `refunded` khi hoàn tiền. Mỗi bước có điều kiện và ghi log.”

**7. “Vé chống dùng lại thế nào?”**
> “Mỗi vé có mã riêng, trạng thái `valid/used/expired`. Quét lần hai bị chặn; lượt quét ghi nhân viên, rạp, thời điểm vào `checkinLogs`.”

**8. “Tại sao không thấy backend Express như mô tả?”**
> “Bản chạy trên Vercel dùng engine nghiệp vụ chạy phía client + Supabase để không cần server (Vercel static). Bản Express/MySQL vẫn còn trong repo (`server/`) và dùng được khi chạy local — cùng một bộ API RPC nên frontend không đổi.”

**9. “Kiểm thử đến đâu?”**
> “Có test luồng đặt vé (`src/mock/__tests__/booking-flow.test.ts`) và kiểm tra kiểu toàn bộ bằng `tsc --noEmit`; ngoài ra em kiểm thử thủ công theo checklist nghiệp vụ trong tài liệu 01.”

**10. “Điểm khác biệt so với các đồ án cùng đề tài?”**
> “Đủ 4 phân hệ (khách – nhân viên – quản lý – quản trị), có nghiệp vụ ‘khó’: giữ ghế, voucher + điểm thưởng, duyệt biên lai, hoàn tiền, giao dịch bất thường, audit log, và dữ liệu online thật.”

**11. “Hiệu năng khi dữ liệu lớn?”**
> “Bản demo tải snapshot theo collection từ Supabase; khi mở rộng sẽ phân trang, chỉ tải collection cần dùng và chuyển sang API server có phân trang phía DB.”

**12. “Nếu mất mạng thì sao?”**
> “Có kịch bản dự phòng: bản local (`npm run dev`) và video demo. Thiết kế hướng tới production sẽ thêm cache và retry.”

---

## 6. RESET DỮ LIỆU VỀ BAN ĐẦU (làm trước khi tập / trước giờ G)

Dữ liệu demo **dùng chung và lưu vĩnh viễn** — mỗi lần đặt vé sẽ thêm đơn thật. Muốn về trạng thái sạch:

1. Mở Supabase → **SQL Editor** → chạy:

```sql
delete from public.pxu_state;
```

2. Mở lại web (Ctrl+F5, tốt nhất là cửa sổ ẩn danh). Lần tải đầu, hệ thống **tự seed lại toàn bộ dữ liệu mẫu**
   (42 phim, 1.352 suất chiếu, 812 đơn, 2 biên lai chờ duyệt, 1 yêu cầu hoàn tiền, 2 giao dịch bất thường).

> ⚠️ Chỉ chạy `delete` khi không còn ai đang demo. Đừng chạy `drop table`.

---

## 7. BẢN RÚT GỌN 8 PHÚT (nếu hội đồng giới hạn thời gian)

| Phút | Nội dung |
|---|---|
| 0:00–0:40 | Mở đầu + 3 con số |
| 0:40–3:30 | Đặt vé: chọn suất → ghế (nói giữ ghế 10') → combo → voucher → QR → vé QR |
| 3:30–4:30 | Quét vé ở tab nhân viên (quét 2 lần để thấy chặn trùng) |
| 4:30–6:30 | Dashboard → duyệt 1 biên lai → duyệt 1 hoàn tiền → khôi phục 1 giao dịch bất thường |
| 6:30–7:30 | Suất chiếu (chặn trùng giờ) + sơ đồ ghế + báo cáo |
| 7:30–8:00 | Kỹ thuật 1 câu + hạn chế/hướng phát triển |

**Bỏ khi rút gọn:** POS, ca làm việc, voucher/thành viên, banner/tin tức, đánh giá.

---

## 8. CHECKLIST 2 PHÚT TRƯỚC GIỜ G

- [ ] Link mở được, đã đăng nhập sẵn 3 vai trò (khách / nhân viên / admin) ở đúng cửa sổ.
- [ ] Huy hiệu Duyệt biên lai = 2, Hoàn tiền = 1, Bất thường = 2.
- [ ] Biết chính xác **phim + suất chiếu** sẽ chọn (chọn sẵn từ trước, đừng tìm giữa buổi).
- [ ] Voucher `PXU10` còn hiệu lực (kiểm tra ở `/admin/voucher`).
- [ ] Đã tắt thông báo, tắt VPN nếu mạng chậm.
- [ ] Mở sẵn thư mục ảnh dự phòng + video demo.
- [ ] Nước uống, giấy nháp ghi 3 con số + 4 tài khoản demo.

---

## 9. NHỮNG ĐIỀU KHÔNG NÊN LÀM KHI DEMO

- ❌ Không **F5** giữa luồng đặt vé/thanh toán (mất trạng thái hiển thị).
- ❌ Không mở 2 tab cùng trình duyệt với 2 tài khoản khác nhau (dùng chung `localStorage`).
- ❌ Không bấm **xoá dữ liệu / cài đặt hệ thống** khi đang demo.
- ❌ Không demo thanh toán chuyển khoản thật.
- ❌ Không nói “phần này em chưa làm được” — nói “phần này nằm ngoài phạm vi đồ án, hướng phát triển là …”.

---

## 10. PHỤ LỤC — GỢI Ý BỘ SLIDE (12 trang) ĐI KÈM KHI DEMO

| # | Slide | Nội dung chính |
|---|---|---|
| 1 | Trang bìa | Tên đề tài, GVHD, sinh viên, link demo + mã QR tới `pxucinema.vercel.app` |
| 2 | Đặt vấn đề | Quy trình đặt vé thủ công: xếp hàng, giữ ghế, đối soát chuyển khoản, soát vé giấy |
| 3 | Mục tiêu & phạm vi | 4 phân hệ; những gì **trong** và **ngoài** phạm vi (thanh toán thật, app mobile) |
| 4 | Kiến trúc tổng quan | Sơ đồ ở mục 3 – Phần 5 rút gọn thành 1 hình |
| 5 | Công nghệ | React 18 / TypeScript / Vite / Tailwind / TanStack Query / Zustand / Zod / Supabase / Vercel |
| 6 | Phân hệ khách hàng | Ảnh luồng 4 bước đặt vé + điểm thưởng |
| 7 | Nghiệp vụ khó #1 | Giữ ghế 10 phút & máy trạng thái đơn hàng (sơ đồ mũi tên) |
| 8 | Nghiệp vụ khó #2 | Voucher + điểm thưởng + hạng thành viên (bảng quy tắc) |
| 9 | Phân hệ nhân viên | Quét vé (sơ đồ 6 bước kiểm tra), POS, ca làm việc |
| 10 | Phân hệ quản lý | Dashboard + duyệt biên lai + hoàn tiền + bất thường |
| 11 | Dữ liệu & triển khai | Supabase (JSONB, RLS) + Vercel + cách chứng minh dữ liệu online |
| 12 | Kết quả & hướng phát triển | Số liệu dữ liệu mẫu, hạn chế, 3 hướng phát triển, lời cảm ơn |

**Mẹo trình bày:** mỗi slide chỉ 1 ý; ảnh chụp màn hình thật (không dùng mockup); câu nào cũng quy về
**giá trị nghiệp vụ** (“giảm thao tác tay”, “chống bán trùng ghế”, “đối soát được tiền”), không sa vào chi tiết code.

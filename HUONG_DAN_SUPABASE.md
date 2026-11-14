# Hướng dẫn đưa dữ liệu PXU Cinema lên Supabase

Chế độ này chạy **toàn bộ nghiệp vụ ngay trong trình duyệt** và lưu dữ liệu online trên **Supabase**,
không cần API Express/MySQL. Phù hợp cho đồ án/demo đã deploy Vercel dạng tĩnh.

> ⚠️ **Chỉ dùng cho demo.** Anon key nằm trong bundle nên ai cũng có thể đọc/ghi dữ liệu
> (kể cả hash mật khẩu demo). Không dùng cho dữ liệu thật.

## 1. Tạo bảng trên Supabase

1. Mở [Supabase Dashboard](https://supabase.com/dashboard) → chọn project.
2. Vào **SQL Editor** → dán toàn bộ nội dung `supabase/schema.sql` → **Run**.
3. Kiểm tra **Table Editor** thấy bảng `pxu_state` (ban đầu trống).

## 2. Lấy khoá

**Project Settings → API**:

- **Project URL** — dạng `https://<project-ref>.supabase.co`
- **anon / public key** — chuỗi dài bắt đầu bằng `eyJ...`

## 3. Chạy local

Điền vào `.env` (đã có sẵn URL):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Sau đó:

```bash
npm run dev
```

Lần đầu mở web, app tự seed dữ liệu mẫu (~1.8 MB) lên bảng `pxu_state` (27 dòng).
Từ lần sau, mỗi thao tác chỉ ghi những bảng thay đổi.

Kiểm tra nhanh: mở web ở 2 trình duyệt/2 máy khác nhau → dữ liệu giống nhau.

## 4. Đưa lên Vercel

**Cách đang dùng: Vercel phát hành trực tiếp thư mục `dist` đã build sẵn**, không build lại trên Vercel
(nên không phụ thuộc `tsc`/`esbuild`/`rollup` của máy chủ Vercel). Cấu hình nằm trong `vercel.json`:
`installCommand`/`buildCommand` là lệnh rỗng, `outputDirectory: "dist"`.

Vì vậy mỗi lần sửa code, chạy **một lệnh duy nhất**:

```bash
npm run deploy
```

Lệnh này build lại (`tsc --noEmit && vite build`), commit thư mục `dist`, rồi push → Vercel tự phát hành.
Nhớ `git pull` trước nếu bạn sửa code trên máy khác.

Key Supabase đã nằm trong `.env.production` (được commit) nên **không cần khai báo Environment Variables**
trên Vercel nữa. Nếu muốn tách riêng môi trường, vẫn có thể thêm `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` trong **Settings → Environment Variables** và build lại bằng `npm run deploy`.

`vercel.json` cũng có rewrite SPA để các đường dẫn như `/phim`, `/admin` không bị 404 khi F5.

## 5. Lưu ý

- **Ghi đồng thời:** cơ chế là "lần ghi sau thắng". Hai người sửa cùng lúc có thể ghi đè nhau.
  Với đồ án demo thì chấp nhận được; muốn chắc hơn cần API server + transaction.
- **Bảo mật:** policy trong `schema.sql` cho phép `anon` đọc/ghi toàn bộ. Đừng lưu dữ liệu cá nhân thật.
- **Mật khẩu DB Supabase** từng bị lộ trong chat → vào **Project Settings → Database → Reset database password**.
  Chế độ này không dùng mật khẩu DB, chỉ dùng URL + anon key.
- Muốn xoá dữ liệu để seed lại: trong SQL Editor chạy `delete from public.pxu_state;` rồi tải lại web.

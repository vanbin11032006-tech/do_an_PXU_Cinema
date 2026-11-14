-- PXU Cinema — bảng lưu trữ cho chế độ Supabase (browser -> Supabase)
-- Chạy toàn bộ file này trong Supabase Dashboard -> SQL Editor -> Run.

create table if not exists public.pxu_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pxu_state enable row level security;

grant select, insert, update, delete on public.pxu_state to anon, authenticated;

drop policy if exists "pxu_state_select" on public.pxu_state;
drop policy if exists "pxu_state_insert" on public.pxu_state;
drop policy if exists "pxu_state_update" on public.pxu_state;
drop policy if exists "pxu_state_delete" on public.pxu_state;

-- Demo: cho phép anon đọc/ghi toàn bộ state.
-- LƯU Ý: anon key nằm trong bundle nên ai cũng có thể đọc/ghi dữ liệu.
-- Không dùng cho dữ liệu thật / production.
create policy "pxu_state_select" on public.pxu_state
  for select to anon, authenticated using (true);

create policy "pxu_state_insert" on public.pxu_state
  for insert to anon, authenticated with check (true);

create policy "pxu_state_update" on public.pxu_state
  for update to anon, authenticated using (true) with check (true);

create policy "pxu_state_delete" on public.pxu_state
  for delete to anon, authenticated using (true);

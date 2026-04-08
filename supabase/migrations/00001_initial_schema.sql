-- ============================================
-- 勤怠管理アプリ: 初期スキーマ
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- 1. users テーブル
-- ============================================
create table public.users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  work_type text not null default 'fixed' check (work_type in ('fixed', 'flex')),
  fixed_start_time time,
  fixed_end_time time,
  flex_core_start time,
  flex_core_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- 2. attendance_records テーブル（打刻記録）
-- ============================================
create table public.attendance_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  break_start timestamptz,
  break_end timestamptz,
  work_location text not null default 'office' check (work_location in ('office', 'remote')),
  source text not null default 'web' check (source in ('web', 'slack', 'line')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, date)
);

-- ============================================
-- 3. leave_balances テーブル（有給残日数）
-- ============================================
create table public.leave_balances (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  fiscal_year int not null,
  grant_date date not null,
  total_days decimal(4,1) not null default 0,
  used_days decimal(4,1) not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, fiscal_year)
);

-- ============================================
-- 4. leave_requests テーブル（休暇申請）
-- ============================================
create table public.leave_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  leave_type text not null default 'paid' check (leave_type in ('paid', 'sick', 'special')),
  start_date date not null,
  end_date date not null,
  days decimal(3,1) not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================
-- 5. attendance_corrections テーブル（勤怠修正申請）
-- ============================================
create table public.attendance_corrections (
  id uuid primary key default uuid_generate_v4(),
  attendance_id uuid not null references public.attendance_records(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  field text not null check (field in ('clock_in', 'clock_out', 'break_start', 'break_end')),
  old_value timestamptz,
  new_value timestamptz not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================
-- 6. overtime_requests テーブル（残業申請）
-- ============================================
create table public.overtime_requests (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  date date not null,
  expected_hours decimal(3,1) not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================
-- インデックス
-- ============================================
create index idx_attendance_user_date on public.attendance_records(user_id, date);
create index idx_attendance_date on public.attendance_records(date);
create index idx_leave_requests_user on public.leave_requests(user_id);
create index idx_leave_requests_status on public.leave_requests(status);
create index idx_corrections_status on public.attendance_corrections(status);
create index idx_overtime_status on public.overtime_requests(status);

-- ============================================
-- updated_at 自動更新トリガー
-- ============================================
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tr_users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at();

create trigger tr_attendance_updated_at
  before update on public.attendance_records
  for each row execute function public.update_updated_at();

create trigger tr_leave_balances_updated_at
  before update on public.leave_balances
  for each row execute function public.update_updated_at();

-- ============================================
-- RLS (Row Level Security)
-- ============================================
alter table public.users enable row level security;
alter table public.attendance_records enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.overtime_requests enable row level security;

-- users: 自分のレコードは読める、adminは全員読める
create policy "users_select_own" on public.users
  for select using (auth.uid() = auth_id);
create policy "users_select_admin" on public.users
  for select using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );
create policy "users_update_admin" on public.users
  for update using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );
create policy "users_insert_admin" on public.users
  for insert with check (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );

-- attendance_records: 自分のは読み書き可、adminは全員読める
create policy "attendance_select_own" on public.attendance_records
  for select using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "attendance_select_admin" on public.attendance_records
  for select using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );
create policy "attendance_insert_own" on public.attendance_records
  for insert with check (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "attendance_update_own" on public.attendance_records
  for update using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "attendance_update_admin" on public.attendance_records
  for update using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );

-- leave_balances: 自分のは読める、adminは全員読み書き
create policy "leave_bal_select_own" on public.leave_balances
  for select using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "leave_bal_select_admin" on public.leave_balances
  for select using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );
create policy "leave_bal_all_admin" on public.leave_balances
  for all using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );

-- leave_requests: 自分のは読み書き、adminは全員読み書き
create policy "leave_req_select_own" on public.leave_requests
  for select using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "leave_req_insert_own" on public.leave_requests
  for insert with check (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "leave_req_all_admin" on public.leave_requests
  for all using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );

-- attendance_corrections: 自分のは読み書き、adminは全員読み書き
create policy "corrections_select_own" on public.attendance_corrections
  for select using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "corrections_insert_own" on public.attendance_corrections
  for insert with check (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "corrections_all_admin" on public.attendance_corrections
  for all using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );

-- overtime_requests: 自分のは読み書き、adminは全員読み書き
create policy "overtime_select_own" on public.overtime_requests
  for select using (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "overtime_insert_own" on public.overtime_requests
  for insert with check (
    user_id in (select id from public.users where auth_id = auth.uid())
  );
create policy "overtime_all_admin" on public.overtime_requests
  for all using (
    exists (select 1 from public.users u where u.auth_id = auth.uid() and u.role = 'admin')
  );

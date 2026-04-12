-- ============================================
-- 半日休暇・時間単位有給対応 (#13)
-- ============================================

-- leave_requests に休暇区分カラムを追加
ALTER TABLE leave_requests ADD COLUMN leave_unit TEXT NOT NULL DEFAULT 'full_day'
  CHECK (leave_unit IN ('full_day', 'half_am', 'half_pm', 'hourly'));

-- 時間単位有給の時間数カラムを追加
ALTER TABLE leave_requests ADD COLUMN hours DECIMAL(4,1);

-- leave_balances に時間単位有給の使用時間を追加
ALTER TABLE leave_balances ADD COLUMN hourly_used_hours DECIMAL(5,1) NOT NULL DEFAULT 0;
ALTER TABLE leave_balances ADD COLUMN hourly_max_hours DECIMAL(5,1) NOT NULL DEFAULT 40;

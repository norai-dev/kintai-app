-- ============================================
-- 複数回休憩対応: break_records テーブル追加
-- ============================================

CREATE TABLE public.break_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_break_records_attendance ON public.break_records(attendance_id);
CREATE INDEX idx_break_records_attendance_open ON public.break_records(attendance_id) WHERE break_end IS NULL;

ALTER TABLE public.break_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own breaks" ON public.break_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.attendance_records ar
    WHERE ar.id = break_records.attendance_id
      AND ar.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY "Users can manage own breaks" ON public.break_records FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.attendance_records ar
    WHERE ar.id = break_records.attendance_id
      AND ar.user_id = (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
);

CREATE POLICY "Admins can manage all breaks" ON public.break_records FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin'
  )
);

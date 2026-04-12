-- ============================================
-- 月次締め処理: monthly_closings テーブル
-- ============================================

CREATE TABLE public.monthly_closings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_by UUID NOT NULL REFERENCES public.users(id),
  reopened_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES public.users(id),
  reopen_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE public.monthly_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view closings" ON public.monthly_closings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage closings" ON public.monthly_closings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- インデックス
CREATE INDEX idx_monthly_closings_year_month ON public.monthly_closings(year, month);

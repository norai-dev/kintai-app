"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";

/** ユーザーごとの月間残業分を集計するヘルパー */
function calcOvertimeMinutesByUser(
  records: Record<string, unknown>[],
  holidaySet: Set<string> = new Set()
): Map<string, { name: string; minutes: number }> {
  const map = new Map<string, { name: string; minutes: number }>();
  for (const r of records) {
    if (!r.clock_in || !r.clock_out) continue;
    const diff =
      new Date(r.clock_out as string).getTime() -
      new Date(r.clock_in as string).getTime();
    let breakMin = 0;
    if (r.break_start && r.break_end) {
      breakMin =
        new Date(r.break_end as string).getTime() -
        new Date(r.break_start as string).getTime();
    }
    const workMin = Math.floor((diff - breakMin) / 60000);

    const dow = new Date((r.date as string) + "T00:00:00").getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidaySet.has(r.date as string);

    // 祝日・週末は全時間が休日出勤（8h控除なし）
    const overtimeMin = (isWeekend || isHoliday)
      ? workMin
      : Math.max(0, workMin - 8 * 60);

    const userId = r.user_id as string;
    const existing = map.get(userId);
    if (existing) {
      existing.minutes += overtimeMin;
    } else {
      map.set(userId, {
        name: (r.users as { name: string })?.name ?? "不明",
        minutes: overtimeMin,
      });
    }
  }
  return map;
}

/** 対象期間の開始・終了日文字列を返す */
function monthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export async function getDashboardData() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA");
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 全社員数
  const { count: totalUsers } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true });

  // 本日の出勤者
  const { data: todayRecords } = await supabase
    .from("attendance_records")
    .select("user_id, clock_in, clock_out, users!inner(name)")
    .eq("date", today);

  const clockedIn = todayRecords?.length ?? 0;
  const todayMembers = (todayRecords ?? []).map((r: Record<string, unknown>) => ({
    name: (r.users as { name: string })?.name ?? "不明",
    clock_in: r.clock_in as string,
    clock_out: r.clock_out as string | null,
  }));

  // 未承認申請数
  const { count: pendingRequests } = await supabase
    .from("leave_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // ── 今月の残業計算 ──────────────────────────────────────────
  const { start: monthStart, end: monthEnd } = monthRange(currentYear, currentMonth);

  const [{ data: monthRecords }, { data: monthHolidayRows }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("user_id, date, clock_in, clock_out, break_start, break_end, users!inner(name)")
      .gte("date", monthStart)
      .lt("date", monthEnd),
    supabase
      .from("holidays")
      .select("date")
      .gte("date", monthStart)
      .lt("date", monthEnd),
  ]);

  const monthHolidaySet = new Set<string>((monthHolidayRows ?? []).map((h: { date: string }) => h.date));

  const currentMonthMap = calcOvertimeMinutesByUser(
    (monthRecords ?? []) as Record<string, unknown>[],
    monthHolidaySet
  );

  // ── 年間残業計算（4月始まりの会計年度）─────────────────────
  // 4月〜3月の会計年度で集計
  const fiscalYearStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fiscalStart = `${fiscalYearStart}-04-01`;
  const fiscalEnd = `${fiscalYearStart + 1}-04-01`;

  const [{ data: annualRecords }, { data: annualHolidayRows }] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("user_id, date, clock_in, clock_out, break_start, break_end, users!inner(name)")
      .gte("date", fiscalStart)
      .lt("date", fiscalEnd),
    supabase
      .from("holidays")
      .select("date")
      .gte("date", fiscalStart)
      .lt("date", fiscalEnd),
  ]);

  const annualHolidaySet = new Set<string>((annualHolidayRows ?? []).map((h: { date: string }) => h.date));

  const annualMap = calcOvertimeMinutesByUser(
    (annualRecords ?? []) as Record<string, unknown>[],
    annualHolidaySet
  );

  // ── 直近6か月の月次データ（複数月平均チェック用）──────────
  // 各月の残業分を収集
  const monthlyOvertimeByUser = new Map<
    string,
    { name: string; monthlyMinutes: number[] }
  >();

  for (let i = 0; i < 6; i++) {
    let m = currentMonth - i;
    let y = currentYear;
    if (m <= 0) { m += 12; y -= 1; }
    const { start, end } = monthRange(y, m);
    const { data: mRecords } = await supabase
      .from("attendance_records")
      .select("user_id, clock_in, clock_out, break_start, break_end, users!inner(name)")
      .gte("date", start)
      .lt("date", end);

    const mMap = calcOvertimeMinutesByUser(
      (mRecords ?? []) as Record<string, unknown>[]
    );

    mMap.forEach((v, userId) => {
      const existing = monthlyOvertimeByUser.get(userId);
      if (existing) {
        existing.monthlyMinutes.push(v.minutes);
      } else {
        monthlyOvertimeByUser.set(userId, {
          name: v.name,
          monthlyMinutes: [v.minutes],
        });
      }
    });
  }

  // ── overtimeRanking の組み立て ──────────────────────────────
  // 今月データがあるユーザーを基準に、年間・複数月平均を付与
  const allUserIds = new Set([
    ...currentMonthMap.keys(),
    ...annualMap.keys(),
  ]);

  const overtimeRanking = Array.from(allUserIds)
    .map((userId) => {
      const current = currentMonthMap.get(userId);
      const annual = annualMap.get(userId);
      const multiMonthData = monthlyOvertimeByUser.get(userId);

      const currentHours = current
        ? Math.round((current.minutes / 60) * 10) / 10
        : 0;
      const annualHours = annual
        ? Math.round((annual.minutes / 60) * 10) / 10
        : 0;

      // 2〜6か月分のデータがある場合のみ平均を計算
      const monthlyMinutes = multiMonthData?.monthlyMinutes ?? [];
      const multiMonthAvgHours =
        monthlyMinutes.length >= 2
          ? Math.round(
              (monthlyMinutes.reduce((s, m) => s + m, 0) /
                monthlyMinutes.length /
                60) *
                10
            ) / 10
          : null;

      return {
        name: current?.name ?? annual?.name ?? "不明",
        hours: currentHours,
        // 旧フィールド（後方互換）
        alert: currentHours >= 45,
        // 新フィールド
        annualHours,
        multiMonthAvgHours,
        annualProgressPercent: Math.min(100, Math.round((annualHours / 360) * 100)),
      };
    })
    .sort((a, b) => b.hours - a.hours);

  // ── アラートメンバーリスト ────────────────────────────────
  // 今月30h+
  const approachingMonthly = overtimeRanking.filter((u) => u.hours >= 30);
  // 複数月平均60h+
  const approachingMultiMonth = overtimeRanking.filter(
    (u) => u.multiMonthAvgHours !== null && u.multiMonthAvgHours >= 60
  );

  return {
    totalUsers: totalUsers ?? 0,
    clockedIn,
    todayMembers,
    pendingRequests: pendingRequests ?? 0,
    overtimeRanking,
    approachingMonthly,
    approachingMultiMonth,
  };
}

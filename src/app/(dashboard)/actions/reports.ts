"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";

export async function getMonthlyReport(year: number, month: number) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  const supabase = await createClient();

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // 全社員取得
  const { data: users } = await supabase.from("users").select("id, name, email, work_type");

  // 当月の勤怠データ
  const { data: records } = await supabase
    .from("attendance_records")
    .select("*")
    .gte("date", monthStart)
    .lt("date", monthEnd);

  // 当月の break_records を一括取得（attendance_id で JOIN）
  const attendanceIds = (records ?? []).map((r: { id: string }) => r.id);
  const { data: allBreaks } = attendanceIds.length > 0
    ? await supabase
        .from("break_records")
        .select("*")
        .in("attendance_id", attendanceIds)
        .not("break_end", "is", null)
    : { data: [] };

  // attendance_id -> 休憩合計分数 のマップを構築
  const breakMinMap = new Map<string, number>();
  (allBreaks ?? []).forEach((b: { attendance_id: string; break_start: string; break_end: string | null }) => {
    if (!b.break_end) return;
    const min = Math.floor(
      (new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000
    );
    breakMinMap.set(b.attendance_id, (breakMinMap.get(b.attendance_id) ?? 0) + min);
  });

  // 当月の休暇取得
  const { data: leaves } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("status", "approved")
    .gte("start_date", monthStart)
    .lt("start_date", monthEnd);

  // ユーザーごとに集計
  const report = (users ?? []).map((u: { id: string; name: string; email: string; work_type: string }) => {
    const userRecords = (records ?? []).filter((r: { user_id: string }) => r.user_id === u.id);
    const userLeaves = (leaves ?? []).filter((l: { user_id: string }) => l.user_id === u.id);

    let totalWorkMin = 0;
    let totalBreakMin = 0;
    let workDays = 0;

    userRecords.forEach((r: { id: string; clock_in: string | null; clock_out: string | null; break_start: string | null; break_end: string | null }) => {
      if (!r.clock_in || !r.clock_out) return;
      workDays++;
      const diff = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();

      // break_records が存在すればそちらを優先、なければ attendance_records の値を使用
      let bMin = 0;
      if (breakMinMap.has(r.id)) {
        bMin = breakMinMap.get(r.id)! * 60000;
      } else if (r.break_start && r.break_end) {
        // フォールバック: break_records 移行前の旧データ
        bMin = new Date(r.break_end).getTime() - new Date(r.break_start).getTime();
      }

      totalBreakMin += Math.floor(bMin / 60000);
      totalWorkMin += Math.floor((diff - bMin) / 60000);
    });

    const standardMin = workDays * 8 * 60;
    const overtimeMin = Math.max(0, totalWorkMin - standardMin);
    const overtimeHours = Math.round(overtimeMin / 60 * 10) / 10;
    const leaveDays = userLeaves.reduce((sum: number, l: { days: number }) => sum + l.days, 0);

    return {
      name: u.name,
      email: u.email,
      workDays,
      totalWorkHours: Math.round(totalWorkMin / 60 * 10) / 10,
      totalBreakHours: Math.round(totalBreakMin / 60 * 10) / 10,
      overtimeHours,
      leaveDays,
      // 後方互換: 45h超でtrue
      overtimeAlert: overtimeHours >= 45,
      // 段階的アラート: "normal" | "warning" | "caution" | "danger"
      overtimeLevel:
        overtimeHours >= 45 ? "danger" as const :
        overtimeHours >= 40 ? "caution" as const :
        overtimeHours >= 30 ? "warning" as const : "normal" as const,
    };
  });

  return report;
}

export async function generateCSV(year: number, month: number): Promise<string> {
  const report = await getMonthlyReport(year, month);
  if (!report) return "";

  const header = "名前,メール,出勤日数,勤務時間(h),休憩時間(h),残業時間(h),休暇日数,残業アラート";
  const rows = report.map((r) =>
    `${r.name},${r.email},${r.workDays},${r.totalWorkHours},${r.totalBreakHours},${r.overtimeHours},${r.leaveDays},${r.overtimeAlert ? "⚠" : ""}`
  );

  return [header, ...rows].join("\n");
}

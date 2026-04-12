"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** タイムスタンプを JST の HH:MM 形式に変換 */
function toJstHHMM(ts: string): string {
  const d = new Date(new Date(ts).getTime() + JST_OFFSET_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** date 文字列 (YYYY-MM-DD) の曜日が土日か判定 */
function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6;
}

/**
 * 深夜時間（22:00〜05:00）の重複時間を時間単位（小数）で返す
 * clock_in / clock_out は UTC タイムスタンプ文字列
 */
function calcDeepNightHours(clockIn: string, clockOut: string): number {
  const inMs = new Date(clockIn).getTime();
  const outMs = new Date(clockOut).getTime();
  if (outMs <= inMs) return 0;

  // 深夜ウィンドウ: 22:00〜翌05:00 (JST) = 13:00〜20:00 (UTC)
  // 勤務が複数日にまたがる可能性があるため、日付ループで確認
  let totalMs = 0;

  // 起算日 (UTC 0:00) を勤務開始の前日から2日後まで走査
  const startDay = new Date(inMs);
  startDay.setUTCHours(0, 0, 0, 0);
  startDay.setUTCDate(startDay.getUTCDate() - 1);

  for (let i = 0; i < 4; i++) {
    const base = startDay.getTime() + i * 86400000;
    // JST 22:00 = UTC 13:00 の当日
    const nightStart = base + 13 * 3600000;
    // JST 翌05:00 = UTC 20:00 の当日
    const nightEnd = base + 20 * 3600000;

    const overlapStart = Math.max(inMs, nightStart);
    const overlapEnd = Math.min(outMs, nightEnd);
    if (overlapEnd > overlapStart) {
      totalMs += overlapEnd - overlapStart;
    }
  }

  return Math.round((totalMs / 3600000) * 10) / 10;
}

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

    userRecords.forEach((r: { clock_in: string | null; clock_out: string | null; break_start: string | null; break_end: string | null }) => {
      if (!r.clock_in || !r.clock_out) return;
      workDays++;
      const diff = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
      let bMin = 0;
      if (r.break_start && r.break_end) {
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

export async function generateDetailCSV(year: number, month: number): Promise<string> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return "";

  const supabase = await createClient();

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data: users } = await supabase.from("users").select("id, name");

  const { data: records } = await supabase
    .from("attendance_records")
    .select("user_id, date, clock_in, clock_out, break_start, break_end, work_location, note")
    .gte("date", monthStart)
    .lt("date", monthEnd)
    .order("date", { ascending: true });

  const userMap = new Map<string, string>(
    (users ?? []).map((u: { id: string; name: string }) => [u.id, u.name])
  );

  const header = "社員名,日付,出勤時刻,退勤時刻,休憩時間(h),実労働時間(h),残業時間(h),深夜時間(h),休日労働フラグ,勤務場所,備考";

  const rows = (records ?? []).map((r: {
    user_id: string;
    date: string;
    clock_in: string | null;
    clock_out: string | null;
    break_start: string | null;
    break_end: string | null;
    work_location: string;
    note: string | null;
  }) => {
    const name = userMap.get(r.user_id) ?? "";
    const clockInStr = r.clock_in ? toJstHHMM(r.clock_in) : "";
    const clockOutStr = r.clock_out ? toJstHHMM(r.clock_out) : "";

    let breakHours = 0;
    if (r.break_start && r.break_end) {
      const bMs = new Date(r.break_end).getTime() - new Date(r.break_start).getTime();
      breakHours = Math.round((bMs / 3600000) * 10) / 10;
    }

    let workHours = 0;
    let overtimeHours = 0;
    let deepNightHours = 0;
    if (r.clock_in && r.clock_out) {
      const totalMs = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
      const breakMs = breakHours * 3600000;
      workHours = Math.round(((totalMs - breakMs) / 3600000) * 10) / 10;
      overtimeHours = Math.round(Math.max(0, workHours - 8) * 10) / 10;
      deepNightHours = calcDeepNightHours(r.clock_in, r.clock_out);
    }

    const holidayFlag = isWeekend(r.date) ? "○" : "";
    const location = r.work_location === "remote" ? "リモート" : "オフィス";
    const note = (r.note ?? "").replace(/,/g, "、");

    return `${name},${r.date},${clockInStr},${clockOutStr},${breakHours},${workHours},${overtimeHours},${deepNightHours},${holidayFlag},${location},${note}`;
  });

  return [header, ...rows].join("\n");
}

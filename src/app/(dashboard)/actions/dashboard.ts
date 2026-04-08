"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";

export async function getDashboardData() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;

  const supabase = await createClient();
  const today = new Date().toLocaleDateString("en-CA");
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

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

  // 今月の残業ランキング（月45h超チェック）
  const monthStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
  const monthEnd = currentMonth === 12
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-01`;

  const { data: monthRecords } = await supabase
    .from("attendance_records")
    .select("user_id, clock_in, clock_out, break_start, break_end, users!inner(name)")
    .gte("date", monthStart)
    .lt("date", monthEnd);

  // ユーザーごとの月間勤務時間を計算
  const userWorkHours = new Map<string, { name: string; minutes: number }>();
  (monthRecords ?? []).forEach((r: Record<string, unknown>) => {
    if (!r.clock_in || !r.clock_out) return;
    const diff = new Date(r.clock_out as string).getTime() - new Date(r.clock_in as string).getTime();
    let breakMin = 0;
    if (r.break_start && r.break_end) {
      breakMin = new Date(r.break_end as string).getTime() - new Date(r.break_start as string).getTime();
    }
    const workMin = Math.floor((diff - breakMin) / 60000);
    const standardMin = 8 * 60; // 8時間を標準とする
    const overtimeMin = Math.max(0, workMin - standardMin);

    const userId = r.user_id as string;
    const existing = userWorkHours.get(userId);
    if (existing) {
      existing.minutes += overtimeMin;
    } else {
      userWorkHours.set(userId, {
        name: (r.users as { name: string })?.name ?? "不明",
        minutes: overtimeMin,
      });
    }
  });

  const overtimeRanking = Array.from(userWorkHours.values())
    .sort((a, b) => b.minutes - a.minutes)
    .map((u) => ({
      name: u.name,
      hours: Math.round(u.minutes / 60 * 10) / 10,
      alert: u.minutes > 45 * 60,
    }));

  return {
    totalUsers: totalUsers ?? 0,
    clockedIn,
    todayMembers,
    pendingRequests: pendingRequests ?? 0,
    overtimeRanking,
  };
}

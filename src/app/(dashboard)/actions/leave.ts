"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { revalidatePath } from "next/cache";
import type { LeaveRequest, LeaveBalance, LeaveUnit } from "@/types/database";

export async function getLeaveBalance(): Promise<LeaveBalance | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const currentYear = new Date().getFullYear();

  const { data } = await supabase
    .from("leave_balances")
    .select("*")
    .eq("user_id", user.id)
    .eq("fiscal_year", currentYear)
    .single();

  return data as LeaveBalance | null;
}

export async function getMyLeaveRequests(): Promise<LeaveRequest[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();

  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (data as LeaveRequest[]) ?? [];
}

export async function submitLeaveRequest(formData: {
  leave_type: string;
  leave_unit: LeaveUnit;
  start_date: string;
  end_date: string;
  days: number;
  hours?: number | null;
  reason: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const { leave_unit, hours } = formData;

  // leave_unit に基づいて days を計算
  let calculatedDays: number;
  if (leave_unit === "half_am" || leave_unit === "half_pm") {
    calculatedDays = 0.5;
  } else if (leave_unit === "hourly") {
    if (!hours || hours <= 0 || hours > 8) {
      return { error: "時間単位の場合、1〜8時間を指定してください" };
    }
    calculatedDays = hours / 8;
  } else {
    calculatedDays = formData.days;
  }

  // 半日・時間単位は start_date = end_date に強制
  const endDate = (leave_unit === "half_am" || leave_unit === "half_pm" || leave_unit === "hourly")
    ? formData.start_date
    : (formData.end_date || formData.start_date);

  // 時間単位の残時間バリデーション
  if (leave_unit === "hourly" && formData.leave_type === "paid") {
    const supabase = await createClient();
    const currentYear = new Date().getFullYear();
    const { data: balance } = await supabase
      .from("leave_balances")
      .select("hourly_used_hours, hourly_max_hours")
      .eq("user_id", user.id)
      .eq("fiscal_year", currentYear)
      .single();

    if (balance) {
      const remaining = (balance.hourly_max_hours ?? 40) - (balance.hourly_used_hours ?? 0);
      if ((hours ?? 0) > remaining) {
        return { error: `時間単位有給の残時間が不足しています（残: ${remaining}時間）` };
      }
    }
  }

  const supabase = await createClient();

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    leave_type: formData.leave_type,
    leave_unit,
    start_date: formData.start_date,
    end_date: endDate,
    days: calculatedDays,
    hours: leave_unit === "hourly" ? hours : null,
    reason: formData.reason,
  });

  if (error) return { error: error.message };

  revalidatePath("/leave");
  return { success: true };
}

// 管理者用: 全員の申請を取得
export async function getAllLeaveRequests(): Promise<(LeaveRequest & { user_name?: string })[]> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return [];

  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("leave_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (!requests) return [];

  // ユーザー名を付与
  const { data: users } = await supabase.from("users").select("id, name");
  const userMap = new Map((users ?? []).map((u: { id: string; name: string }) => [u.id, u.name]));

  return requests.map((r: LeaveRequest) => ({
    ...r,
    user_name: userMap.get(r.user_id) ?? "不明",
  }));
}

// 管理者用: 承認/却下
export async function approveLeaveRequest(requestId: string, action: "approved" | "rejected") {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "権限がありません" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("leave_requests")
    .update({
      status: action,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) return { error: error.message };

  // 承認時は有給残日数を更新
  if (action === "approved") {
    const { data: req } = await supabase
      .from("leave_requests")
      .select("user_id, days, hours, leave_type, leave_unit")
      .eq("id", requestId)
      .single();

    if (req && req.leave_type === "paid") {
      const currentYear = new Date().getFullYear();

      await supabase.rpc("increment_used_days", {
        p_user_id: req.user_id,
        p_fiscal_year: currentYear,
        p_days: req.days,
      });

      // 時間単位の場合は hourly_used_hours も更新
      if (req.leave_unit === "hourly" && req.hours) {
        const { data: balance } = await supabase
          .from("leave_balances")
          .select("id, hourly_used_hours")
          .eq("user_id", req.user_id)
          .eq("fiscal_year", currentYear)
          .single();

        if (balance) {
          await supabase
            .from("leave_balances")
            .update({ hourly_used_hours: (balance.hourly_used_hours ?? 0) + req.hours })
            .eq("id", balance.id);
        }
      }
    }
  }

  revalidatePath("/admin/approvals");
  revalidatePath("/leave");
  return { success: true };
}

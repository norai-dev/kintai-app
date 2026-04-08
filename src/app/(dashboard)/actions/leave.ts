"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { revalidatePath } from "next/cache";
import type { LeaveRequest, LeaveBalance } from "@/types/database";

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
  start_date: string;
  end_date: string;
  days: number;
  reason: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const supabase = await createClient();

  const { error } = await supabase.from("leave_requests").insert({
    user_id: user.id,
    leave_type: formData.leave_type,
    start_date: formData.start_date,
    end_date: formData.end_date,
    days: formData.days,
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
      .select("user_id, days, leave_type")
      .eq("id", requestId)
      .single();

    if (req && req.leave_type === "paid") {
      const currentYear = new Date().getFullYear();
      await supabase.rpc("increment_used_days", {
        p_user_id: req.user_id,
        p_fiscal_year: currentYear,
        p_days: req.days,
      });
    }
  }

  revalidatePath("/admin/approvals");
  revalidatePath("/leave");
  return { success: true };
}

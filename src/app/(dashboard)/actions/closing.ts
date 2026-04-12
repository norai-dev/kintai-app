"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { revalidatePath } from "next/cache";
import type { MonthlyClosing } from "@/types/database";

export async function getClosingStatus(
  year: number,
  month: number
): Promise<MonthlyClosing | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("monthly_closings")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .single();

  return data as MonthlyClosing | null;
}

export async function isMonthClosed(year: number, month: number): Promise<boolean> {
  const closing = await getClosingStatus(year, month);
  if (!closing) return false;
  // reopened_at があれば再オープン済み → 締め解除状態
  return closing.reopened_at === null;
}

export async function closeMonth(
  year: number,
  month: number
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };
  if (user.role !== "admin") return { error: "管理者のみ実行できます" };

  // 既に締め済みかチェック
  const alreadyClosed = await isMonthClosed(year, month);
  if (alreadyClosed) return { error: "この月はすでに締め済みです" };

  const supabase = await createClient();

  // 既存レコード（再オープン済み）があればupsert、なければinsert
  const existing = await getClosingStatus(year, month);

  if (existing) {
    // 再締め: reopened_at をリセットして再度確定
    const { error } = await supabase
      .from("monthly_closings")
      .update({
        closed_at: new Date().toISOString(),
        closed_by: user.id,
        reopened_at: null,
        reopened_by: null,
        reopen_reason: null,
      })
      .eq("year", year)
      .eq("month", month);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("monthly_closings").insert({
      year,
      month,
      closed_by: user.id,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/admin/reports");
  revalidatePath("/calendar");
  return { success: true };
}

export async function reopenMonth(
  year: number,
  month: number,
  reason: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };
  if (user.role !== "admin") return { error: "管理者のみ実行できます" };

  if (!reason.trim()) return { error: "解除理由を入力してください" };

  const closed = await isMonthClosed(year, month);
  if (!closed) return { error: "この月は締め済みではありません" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("monthly_closings")
    .update({
      reopened_at: new Date().toISOString(),
      reopened_by: user.id,
      reopen_reason: reason.trim(),
    })
    .eq("year", year)
    .eq("month", month);

  if (error) return { error: error.message };

  revalidatePath("/admin/reports");
  revalidatePath("/calendar");
  return { success: true };
}

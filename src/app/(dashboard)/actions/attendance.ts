"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { revalidatePath } from "next/cache";

function todayDate() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export async function clockIn(workLocation: "office" | "remote" = "remote") {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase.from("attendance_records").insert({
    user_id: user.id,
    date: todayDate(),
    clock_in: now,
    work_location: workLocation,
    source: "web",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "本日は既に出勤済みです" };
    }
    return { error: error.message };
  }

  revalidatePath("/");
  return { success: true };
}

export async function clockOut() {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("attendance_records")
    .update({ clock_out: now })
    .eq("user_id", user.id)
    .eq("date", todayDate())
    .is("clock_out", null);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function startBreak() {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("attendance_records")
    .update({ break_start: now })
    .eq("user_id", user.id)
    .eq("date", todayDate());

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function endBreak() {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("attendance_records")
    .update({ break_end: now })
    .eq("user_id", user.id)
    .eq("date", todayDate());

  if (error) return { error: error.message };

  revalidatePath("/");
  return { success: true };
}

export async function getTodayAttendance() {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", todayDate())
    .single();

  return data;
}

export async function upsertAttendance(formData: {
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  work_location: "office" | "remote";
  note: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const supabase = await createClient();

  // 既存レコードを確認
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", formData.date)
    .single();

  // 時刻文字列（HH:MM）をISO文字列に変換
  const toISO = (date: string, time: string | null) => {
    if (!time) return null;
    return new Date(`${date}T${time}:00+09:00`).toISOString();
  };

  const record = {
    user_id: user.id,
    date: formData.date,
    clock_in: toISO(formData.date, formData.clock_in),
    clock_out: toISO(formData.date, formData.clock_out),
    break_start: toISO(formData.date, formData.break_start),
    break_end: toISO(formData.date, formData.break_end),
    work_location: formData.work_location,
    source: "web" as const,
    note: formData.note || null,
  };

  if (existing) {
    const { error } = await supabase
      .from("attendance_records")
      .update(record)
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("attendance_records")
      .insert(record);
    if (error) return { error: error.message };
  }

  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteAttendance(date: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "認証されていません" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date);

  if (error) return { error: error.message };

  revalidatePath("/calendar");
  return { success: true };
}

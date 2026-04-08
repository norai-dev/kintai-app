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

"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import { revalidatePath } from "next/cache";
import type { Holiday } from "@/types/database";

// 2024〜2026年 日本国民の祝日
const NATIONAL_HOLIDAYS: { date: string; name: string }[] = [
  // 2024
  { date: "2024-01-01", name: "元日" },
  { date: "2024-01-08", name: "成人の日" },
  { date: "2024-02-11", name: "建国記念の日" },
  { date: "2024-02-12", name: "建国記念の日 振替休日" },
  { date: "2024-02-23", name: "天皇誕生日" },
  { date: "2024-03-20", name: "春分の日" },
  { date: "2024-04-29", name: "昭和の日" },
  { date: "2024-05-03", name: "憲法記念日" },
  { date: "2024-05-04", name: "みどりの日" },
  { date: "2024-05-05", name: "こどもの日" },
  { date: "2024-05-06", name: "こどもの日 振替休日" },
  { date: "2024-07-15", name: "海の日" },
  { date: "2024-08-11", name: "山の日" },
  { date: "2024-08-12", name: "山の日 振替休日" },
  { date: "2024-09-16", name: "敬老の日" },
  { date: "2024-09-22", name: "秋分の日" },
  { date: "2024-09-23", name: "秋分の日 振替休日" },
  { date: "2024-10-14", name: "スポーツの日" },
  { date: "2024-11-03", name: "文化の日" },
  { date: "2024-11-04", name: "文化の日 振替休日" },
  { date: "2024-11-23", name: "勤労感謝の日" },
  // 2025
  { date: "2025-01-01", name: "元日" },
  { date: "2025-01-13", name: "成人の日" },
  { date: "2025-02-11", name: "建国記念の日" },
  { date: "2025-02-23", name: "天皇誕生日" },
  { date: "2025-02-24", name: "天皇誕生日 振替休日" },
  { date: "2025-03-20", name: "春分の日" },
  { date: "2025-04-29", name: "昭和の日" },
  { date: "2025-05-03", name: "憲法記念日" },
  { date: "2025-05-04", name: "みどりの日" },
  { date: "2025-05-05", name: "こどもの日" },
  { date: "2025-05-06", name: "こどもの日 振替休日" },
  { date: "2025-07-21", name: "海の日" },
  { date: "2025-08-11", name: "山の日" },
  { date: "2025-09-15", name: "敬老の日" },
  { date: "2025-09-23", name: "秋分の日" },
  { date: "2025-10-13", name: "スポーツの日" },
  { date: "2025-11-03", name: "文化の日" },
  { date: "2025-11-23", name: "勤労感謝の日" },
  { date: "2025-11-24", name: "勤労感謝の日 振替休日" },
  // 2026
  { date: "2026-01-01", name: "元日" },
  { date: "2026-01-12", name: "成人の日" },
  { date: "2026-02-11", name: "建国記念の日" },
  { date: "2026-02-23", name: "天皇誕生日" },
  { date: "2026-03-20", name: "春分の日" },
  { date: "2026-04-29", name: "昭和の日" },
  { date: "2026-05-03", name: "憲法記念日" },
  { date: "2026-05-04", name: "みどりの日" },
  { date: "2026-05-05", name: "こどもの日" },
  { date: "2026-05-06", name: "こどもの日 振替休日" },
  { date: "2026-07-20", name: "海の日" },
  { date: "2026-08-11", name: "山の日" },
  { date: "2026-09-21", name: "敬老の日" },
  { date: "2026-09-22", name: "国民の休日" },
  { date: "2026-09-23", name: "秋分の日" },
  { date: "2026-10-12", name: "スポーツの日" },
  { date: "2026-11-03", name: "文化の日" },
  { date: "2026-11-23", name: "勤労感謝の日" },
];

export async function getHolidays(year: number): Promise<Holiday[]> {
  const supabase = await createClient();

  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  if (error) return [];
  return (data as Holiday[]) ?? [];
}

export async function getHolidaysInRange(
  startDate: string,
  endDate: string
): Promise<Holiday[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("holidays")
    .select("*")
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  if (error) return [];
  return (data as Holiday[]) ?? [];
}

export async function upsertHoliday(formData: {
  date: string;
  name: string;
  type: "national" | "company";
}): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "権限がありません" };

  if (!formData.date || !formData.name) {
    return { error: "日付と名称は必須です" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("holidays")
    .upsert(
      { date: formData.date, name: formData.name, type: formData.type },
      { onConflict: "date" }
    );

  if (error) return { error: error.message };

  revalidatePath("/admin/holidays");
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteHoliday(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "権限がありません" };

  const supabase = await createClient();

  const { error } = await supabase.from("holidays").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/holidays");
  revalidatePath("/calendar");
  return { success: true };
}

export async function importNationalHolidays(
  year: number
): Promise<{ success?: boolean; count?: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "権限がありません" };

  const targets = NATIONAL_HOLIDAYS.filter((h) =>
    h.date.startsWith(String(year))
  );

  if (targets.length === 0) {
    return { error: `${year}年の祝日データがありません` };
  }

  const supabase = await createClient();

  const records = targets.map((h) => ({
    date: h.date,
    name: h.name,
    type: "national" as const,
  }));

  const { error } = await supabase
    .from("holidays")
    .upsert(records, { onConflict: "date" });

  if (error) return { error: error.message };

  revalidatePath("/admin/holidays");
  revalidatePath("/calendar");
  return { success: true, count: targets.length };
}

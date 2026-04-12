"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/get-current-user";
import type { AttendanceRecord, LeaveRequest } from "@/types/database";

export async function getMonthlyAttendance(year: number, month: number): Promise<AttendanceRecord[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDate)
    .lt("date", endDate)
    .order("date", { ascending: true });

  return (data as AttendanceRecord[]) ?? [];
}

export async function getMonthlyLeaveRequests(year: number, month: number): Promise<LeaveRequest[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "approved")
    .gte("start_date", startDate)
    .lt("start_date", endDate)
    .order("start_date", { ascending: true });

  return (data as LeaveRequest[]) ?? [];
}

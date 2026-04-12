export type UserRole = "admin" | "member";
export type WorkType = "fixed" | "flex";
export type WorkLocation = "office" | "remote";
export type AttendanceSource = "web" | "slack" | "line";
export type LeaveType = "paid" | "sick" | "special";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type CorrectionField = "clock_in" | "clock_out" | "break_start" | "break_end";

export interface User {
  id: string;
  auth_id: string;
  email: string;
  name: string;
  role: UserRole;
  work_type: WorkType;
  fixed_start_time: string | null;
  fixed_end_time: string | null;
  flex_core_start: string | null;
  flex_core_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  work_location: WorkLocation;
  source: AttendanceSource;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  user_id: string;
  fiscal_year: number;
  grant_date: string;
  total_days: number;
  used_days: number;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface AttendanceCorrection {
  id: string;
  attendance_id: string;
  user_id: string;
  field: CorrectionField;
  old_value: string | null;
  new_value: string;
  reason: string;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface OvertimeRequest {
  id: string;
  user_id: string;
  date: string;
  expected_hours: number;
  reason: string;
  status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export type HolidayType = 'national' | 'company';

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  created_at: string;
  updated_at: string;
}

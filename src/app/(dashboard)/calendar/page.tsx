"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getMonthlyAttendance, getMonthlyLeaveRequests } from "../actions/calendar";
import { upsertAttendance, deleteAttendance, getBreakRecords } from "../actions/attendance";
import { getTotalBreakMinutes } from "@/lib/break-utils";
import { getHolidaysInRange } from "../actions/holidays";
import { getClosingStatus } from "../actions/closing";
import type { AttendanceRecord, BreakRecord, Holiday, MonthlyClosing, LeaveRequest } from "@/types/database";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatHM(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
}

function isoToTimeInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo" });
}

function calcWorkMinutes(record: AttendanceRecord, breakMinutes?: number): number {
  if (!record.clock_in || !record.clock_out) return 0;
  const diff = new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime();
  let breakMin = 0;
  if (breakMinutes !== undefined) {
    breakMin = breakMinutes * 60000;
  } else if (record.break_start && record.break_end) {
    breakMin = new Date(record.break_end).getTime() - new Date(record.break_start).getTime();
  }
  return Math.max(0, Math.floor((diff - breakMin) / 60000));
}

function formatDuration(minutes: number): string {
  if (minutes === 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [closing, setClosing] = useState<MonthlyClosing | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  // Map from attendance_id to BreakRecord[]
  const [breakMap, setBreakMap] = useState<Map<string, BreakRecord[]>>(new Map());
  const [editBreakRecords, setEditBreakRecords] = useState<BreakRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editBreakStart, setEditBreakStart] = useState("");
  const [editBreakEnd, setEditBreakEnd] = useState("");
  const [editLocation, setEditLocation] = useState<"office" | "remote">("remote");
  const [editNote, setEditNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadData = () => {
    setLoading(true);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    Promise.all([
      getMonthlyAttendance(year, month),
      getHolidaysInRange(startDate, endDate),
      getClosingStatus(year, month),
      getMonthlyLeaveRequests(year, month),
    ]).then(async ([attendanceData, holidayData, closingData, leaveData]) => {
      setRecords(attendanceData);
      setHolidays(holidayData);
      setClosing(closingData);
      setLeaveRequests(leaveData);

      // 各 attendance に対して break_records を取得
      const entries = await Promise.all(
        attendanceData.map(async (r) => {
          const breaks = await getBreakRecords(r.id);
          return [r.id, breaks] as [string, BreakRecord[]];
        })
      );
      setBreakMap(new Map(entries));
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [year, month]);

  // 締め済み: closing レコードが存在し、かつ reopened_at がない
  const isClosed = closing !== null && closing.reopened_at === null;

  const daysInMonth = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const recordMap = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    recordMap.set(r.date, r);
  });

  const holidayMap = new Map<string, Holiday>();
  holidays.forEach((h) => {
    holidayMap.set(h.date, h);
  });

  const leaveMap = new Map<string, LeaveRequest[]>();
  leaveRequests.forEach((lr) => {
    const existing = leaveMap.get(lr.start_date) ?? [];
    leaveMap.set(lr.start_date, [...existing, lr]);
  });

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const openEdit = async (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const record = recordMap.get(dateStr);
    setEditDate(dateStr);
    setEditClockIn(record ? isoToTimeInput(record.clock_in) : "");
    setEditClockOut(record ? isoToTimeInput(record.clock_out) : "");
    setEditBreakStart(record ? isoToTimeInput(record.break_start) : "");
    setEditBreakEnd(record ? isoToTimeInput(record.break_end) : "");
    setEditLocation(record?.work_location === "office" ? "office" : "remote");
    setEditNote(record?.note || "");

    if (record) {
      const breaks = breakMap.get(record.id) ?? [];
      setEditBreakRecords(breaks);
    } else {
      setEditBreakRecords([]);
    }

    setEditOpen(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertAttendance({
        date: editDate,
        clock_in: editClockIn || null,
        clock_out: editClockOut || null,
        break_start: editBreakStart || null,
        break_end: editBreakEnd || null,
        work_location: editLocation,
        note: editNote,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("勤怠を保存しました");
        setEditOpen(false);
        loadData();
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteAttendance(editDate);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("勤怠を削除しました");
        setEditOpen(false);
        loadData();
      }
    });
  };

  const getBreakMinutesForRecord = (record: AttendanceRecord): number => {
    const breaks = breakMap.get(record.id);
    if (breaks && breaks.length > 0) {
      return breaks
        .filter((b) => b.break_end)
        .reduce((sum, b) => sum + Math.floor(
          (new Date(b.break_end!).getTime() - new Date(b.break_start).getTime()) / 60000
        ), 0);
    }
    if (record.break_start && record.break_end) {
      return Math.floor(
        (new Date(record.break_end).getTime() - new Date(record.break_start).getTime()) / 60000
      );
    }
    return 0;
  };

  const totalWorkMinutes = records.reduce((sum, r) => {
    const breakMin = getBreakMinutesForRecord(r);
    return sum + calcWorkMinutes(r, breakMin);
  }, 0);
  const totalWorkDays = records.filter((r) => r.clock_in).length;

  const editDateLabel = editDate
    ? new Date(editDate + "T00:00:00").toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "long" })
    : "";

  const editDateHoliday = editDate ? holidayMap.get(editDate) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">勤怠一覧</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>←</Button>
          <span className="text-lg font-medium w-32 text-center">{year}年{month}月</span>
          <Button variant="outline" size="sm" onClick={nextMonth}>→</Button>
          {isClosed && (
            <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800">
              確定済
            </Badge>
          )}
        </div>
      </div>

      {/* 月次確定バナー */}
      {isClosed && (
        <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          この月は月次確定済みです。勤怠データの編集・削除はできません。
          {closing?.closed_at && (
            <span className="ml-2 text-blue-600">
              （確定日時: {new Date(closing.closed_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}）
            </span>
          )}
        </div>
      )}

      {/* サマリー */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">出勤日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalWorkDays}日</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">総勤務時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatDuration(totalWorkMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">平均勤務時間</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {totalWorkDays > 0 ? formatDuration(Math.floor(totalWorkMinutes / totalWorkDays)) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 勤怠テーブル */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">日付</TableHead>
                <TableHead className="w-12">曜日</TableHead>
                <TableHead className="w-28">祝日</TableHead>
                <TableHead>出勤</TableHead>
                <TableHead>退勤</TableHead>
                <TableHead>休憩</TableHead>
                <TableHead>勤務時間</TableHead>
                <TableHead>場所</TableHead>
                <TableHead className="w-16">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : (
                allDays.map((day) => {
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const record = recordMap.get(dateStr);
                  const holiday = holidayMap.get(dateStr);
                  const dayOfWeek = new Date(year, month - 1, day).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                  const isHoliday = !!holiday;
                  // 祝日に出勤している場合は「休日出勤」フラグ
                  const isHolidayWork = isHoliday && !!record?.clock_in;

                  const rowBg = isHoliday
                    ? "bg-red-50 hover:bg-red-100/70"
                    : isWeekend
                    ? "bg-muted/50 hover:bg-muted/70"
                    : "hover:bg-muted/30";

                  return (
                    <TableRow
                      key={day}
                      className={`${rowBg} ${isClosed ? "cursor-default" : "cursor-pointer"}`}
                      onClick={() => { if (!isClosed) openEdit(day); }}
                    >
                      <TableCell className="font-medium">{month}/{day}</TableCell>
                      <TableCell className={dayOfWeek === 0 || isHoliday ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""}>
                        {WEEKDAYS[dayOfWeek]}
                      </TableCell>
                      <TableCell>
                        {holiday && (
                          <span className="text-xs text-red-600 font-medium leading-tight block">
                            {holiday.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{record ? formatHM(record.clock_in) : ""}</TableCell>
                      <TableCell>{record ? formatHM(record.clock_out) : ""}</TableCell>
                      <TableCell>
                        {(() => {
                          if (!record) return "";
                          const breaks = breakMap.get(record.id) ?? [];
                          const hasOpenBreak = breaks.some((b) => !b.break_end);
                          if (hasOpenBreak) return "休憩中";
                          const breakMin = getBreakMinutesForRecord(record);
                          const breakCount = breaks.filter((b) => b.break_end).length;
                          if (breakCount > 1) return `${breakMin}分 (${breakCount}回)`;
                          if (breakMin > 0) return `${breakMin}分`;
                          if (record.break_start && record.break_end) {
                            const m = Math.floor(
                              (new Date(record.break_end).getTime() - new Date(record.break_start).getTime()) / 60000
                            );
                            return `${m}分`;
                          }
                          if (record.break_start) return "休憩中";
                          return "";
                        })()}
                      </TableCell>
                      <TableCell>{record ? formatDuration(calcWorkMinutes(record, getBreakMinutesForRecord(record))) : ""}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {record && (
                            <Badge variant={record.work_location === "remote" ? "outline" : "secondary"} className="text-xs">
                              {record.work_location === "remote" ? "リモート" : "出社"}
                            </Badge>
                          )}
                          {isHolidayWork && (
                            <Badge variant="destructive" className="text-xs">
                              休日出勤
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isClosed ? (
                          <span className="text-xs text-muted-foreground">確定済</span>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-xs" onClick={(e) => { e.stopPropagation(); openEdit(day); }}>
                            編集
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 編集ダイアログ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editDateLabel}の勤怠
              {editDateHoliday && (
                <span className="ml-2 text-sm font-normal text-red-600">
                  ({editDateHoliday.name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editDateHoliday && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                この日は祝日です。出勤した場合は休日出勤として扱われます。
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>出勤時刻</Label>
                <Input type="time" value={editClockIn} onChange={(e) => setEditClockIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>退勤時刻</Label>
                <Input type="time" value={editClockOut} onChange={(e) => setEditClockOut(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>休憩開始 (1回目)</Label>
                <Input type="time" value={editBreakStart} onChange={(e) => setEditBreakStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>休憩終了 (1回目)</Label>
                <Input type="time" value={editBreakEnd} onChange={(e) => setEditBreakEnd(e.target.value)} />
              </div>
            </div>

            {/* 複数回休憩の一覧（2回目以降・読み取り専用） */}
            {editBreakRecords.length > 1 && (
              <div className="space-y-2">
                <Label>
                  休憩履歴（全{editBreakRecords.length}回 / 計{getTotalBreakMinutes(editBreakRecords.filter((b) => !!b.break_end))}分）
                </Label>
                <div className="rounded-md border divide-y text-sm">
                  {editBreakRecords.map((b, i) => (
                    <div key={b.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground">{i + 1}回目</span>
                      <span>
                        {formatHM(b.break_start)} 〜 {b.break_end ? formatHM(b.break_end) : "休憩中"}
                        {b.break_end && (
                          <span className="ml-2 text-muted-foreground">
                            ({Math.floor((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000)}分)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>勤務場所</Label>
              <Select value={editLocation} onValueChange={(v) => v && setEditLocation(v as "office" | "remote")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="remote">リモート</SelectItem>
                  <SelectItem value="office">出社</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>メモ</Label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="任意" />
            </div>
            <div className="flex justify-between">
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
                削除
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditOpen(false)}>キャンセル</Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? "保存中..." : "保存"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

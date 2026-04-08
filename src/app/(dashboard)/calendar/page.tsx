"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getMonthlyAttendance } from "../actions/calendar";
import type { AttendanceRecord } from "@/types/database";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatHM(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function calcWorkMinutes(record: AttendanceRecord): number {
  if (!record.clock_in || !record.clock_out) return 0;
  const diff = new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime();
  let breakMin = 0;
  if (record.break_start && record.break_end) {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMonthlyAttendance(year, month).then((data) => {
      setRecords(data);
      setLoading(false);
    });
  }, [year, month]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const recordMap = new Map<string, AttendanceRecord>();
  records.forEach((r) => {
    recordMap.set(r.date, r);
  });

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const totalWorkMinutes = records.reduce((sum, r) => sum + calcWorkMinutes(r), 0);
  const totalWorkDays = records.filter((r) => r.clock_in).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">勤怠一覧</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>←</Button>
          <span className="text-lg font-medium w-32 text-center">{year}年{month}月</span>
          <Button variant="outline" size="sm" onClick={nextMonth}>→</Button>
        </div>
      </div>

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
                <TableHead>出勤</TableHead>
                <TableHead>退勤</TableHead>
                <TableHead>休憩</TableHead>
                <TableHead>勤務時間</TableHead>
                <TableHead>場所</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : (
                allDays.map((day) => {
                  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const record = recordMap.get(dateStr);
                  const dayOfWeek = new Date(year, month - 1, day).getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <TableRow key={day} className={isWeekend ? "bg-muted/50" : ""}>
                      <TableCell className="font-medium">{month}/{day}</TableCell>
                      <TableCell className={dayOfWeek === 0 ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : ""}>
                        {WEEKDAYS[dayOfWeek]}
                      </TableCell>
                      <TableCell>{record ? formatHM(record.clock_in) : ""}</TableCell>
                      <TableCell>{record ? formatHM(record.clock_out) : ""}</TableCell>
                      <TableCell>
                        {record?.break_start && record?.break_end
                          ? `${Math.floor((new Date(record.break_end).getTime() - new Date(record.break_start).getTime()) / 60000)}分`
                          : record?.break_start ? "休憩中" : ""}
                      </TableCell>
                      <TableCell>{record ? formatDuration(calcWorkMinutes(record)) : ""}</TableCell>
                      <TableCell>
                        {record && (
                          <Badge variant={record.work_location === "remote" ? "outline" : "secondary"} className="text-xs">
                            {record.work_location === "remote" ? "リモート" : "出社"}
                          </Badge>
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
    </div>
  );
}

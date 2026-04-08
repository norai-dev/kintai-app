"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clockIn, clockOut, startBreak, endBreak, getTodayAttendance } from "./actions/attendance";
import { toast } from "sonner";

type ClockStatus = "not_started" | "working" | "on_break" | "finished";

export default function ClockPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<ClockStatus>("not_started");
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockOutTime, setClockOutTime] = useState<string | null>(null);
  const [breakStartTime, setBreakStartTime] = useState<string | null>(null);
  const [breakEndTime, setBreakEndTime] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 現在時刻の更新
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 初期ロード: 今日の打刻状況を取得
  useEffect(() => {
    getTodayAttendance().then((record) => {
      if (!record) return;
      setClockInTime(record.clock_in);
      setClockOutTime(record.clock_out);
      setBreakStartTime(record.break_start);
      setBreakEndTime(record.break_end);

      if (record.clock_out) {
        setStatus("finished");
      } else if (record.break_start && !record.break_end) {
        setStatus("on_break");
      } else if (record.clock_in) {
        setStatus("working");
      }
    });
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatHM = (iso: string) =>
    new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const getWorkingMinutes = () => {
    if (!clockInTime) return 0;
    const start = new Date(clockInTime).getTime();
    const end = clockOutTime ? new Date(clockOutTime).getTime() : Date.now();
    const totalMin = Math.floor((end - start) / 60000);

    let breakMin = 0;
    if (breakStartTime) {
      const bEnd = breakEndTime ? new Date(breakEndTime).getTime() : Date.now();
      breakMin = Math.floor((bEnd - new Date(breakStartTime).getTime()) / 60000);
    }
    return Math.max(0, totalMin - breakMin);
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}時間${m.toString().padStart(2, "0")}分`;
  };

  const handleClockIn = () => {
    startTransition(async () => {
      const result = await clockIn("remote");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setClockInTime(new Date().toISOString());
      setStatus("working");
      toast.success("出勤しました");
    });
  };

  const handleClockOut = () => {
    startTransition(async () => {
      const result = await clockOut();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setClockOutTime(new Date().toISOString());
      setStatus("finished");
      toast.success("退勤しました");
    });
  };

  const handleBreakToggle = () => {
    startTransition(async () => {
      if (status === "working") {
        const result = await startBreak();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setBreakStartTime(new Date().toISOString());
        setStatus("on_break");
        toast("休憩開始");
      } else if (status === "on_break") {
        const result = await endBreak();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        setBreakEndTime(new Date().toISOString());
        setStatus("working");
        toast("休憩終了");
      }
    });
  };

  const statusLabel: Record<ClockStatus, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    not_started: { text: "未出勤", variant: "secondary" },
    working: { text: "勤務中", variant: "default" },
    on_break: { text: "休憩中", variant: "outline" },
    finished: { text: "退勤済", variant: "secondary" },
  };

  const getBreakMinutes = () => {
    if (!breakStartTime) return 0;
    const bEnd = breakEndTime ? new Date(breakEndTime).getTime() : Date.now();
    return Math.floor((bEnd - new Date(breakStartTime).getTime()) / 60000);
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* 現在時刻 */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {currentTime.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </p>
        <p className="text-5xl font-bold tracking-tight tabular-nums mt-1">
          {formatTime(currentTime)}
        </p>
      </div>

      {/* ステータス */}
      <div className="flex justify-center">
        <Badge variant={statusLabel[status].variant} className="text-sm px-4 py-1">
          {statusLabel[status].text}
        </Badge>
      </div>

      {/* 打刻ボタン */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">打刻</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "not_started" && (
            <Button
              onClick={handleClockIn}
              className="w-full h-16 text-lg"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "処理中..." : "出勤"}
            </Button>
          )}

          {(status === "working" || status === "on_break") && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleBreakToggle}
                variant="outline"
                className="h-16 text-base"
                disabled={isPending}
              >
                {status === "on_break" ? "休憩終了" : "休憩開始"}
              </Button>
              <Button
                onClick={handleClockOut}
                variant="destructive"
                className="h-16 text-base"
                disabled={isPending || status === "on_break"}
              >
                退勤
              </Button>
            </div>
          )}

          {status === "finished" && (
            <p className="text-center text-muted-foreground py-4">
              本日の勤務は終了しました
            </p>
          )}
        </CardContent>
      </Card>

      {/* 今日のサマリー */}
      {clockInTime && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">本日の勤務</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">出勤</p>
                <p className="text-lg font-semibold">{formatHM(clockInTime)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">休憩</p>
                <p className="text-lg font-semibold">{getBreakMinutes()}分</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">勤務時間</p>
                <p className="text-lg font-semibold">{formatDuration(getWorkingMinutes())}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ClockStatus = "not_started" | "working" | "on_break" | "finished";

export default function ClockPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [status, setStatus] = useState<ClockStatus>("not_started");
  const [clockIn, setClockIn] = useState<Date | null>(null);
  const [breakStart, setBreakStart] = useState<Date | null>(null);
  const [totalBreak, setTotalBreak] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const formatHM = (date: Date) =>
    date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const getWorkingMinutes = () => {
    if (!clockIn) return 0;
    const now = new Date();
    const diff = Math.floor((now.getTime() - clockIn.getTime()) / 60000);
    const breakMin = status === "on_break" && breakStart
      ? totalBreak + Math.floor((now.getTime() - breakStart.getTime()) / 60000)
      : totalBreak;
    return Math.max(0, diff - breakMin);
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}時間${m.toString().padStart(2, "0")}分`;
  };

  const handleClockIn = () => {
    setClockIn(new Date());
    setStatus("working");
    setTotalBreak(0);
  };

  const handleClockOut = () => {
    setStatus("finished");
  };

  const handleBreakToggle = () => {
    if (status === "working") {
      setBreakStart(new Date());
      setStatus("on_break");
    } else if (status === "on_break" && breakStart) {
      const breakMin = Math.floor((new Date().getTime() - breakStart.getTime()) / 60000);
      setTotalBreak((prev) => prev + breakMin);
      setBreakStart(null);
      setStatus("working");
    }
  };

  const statusLabel: Record<ClockStatus, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    not_started: { text: "未出勤", variant: "secondary" },
    working: { text: "勤務中", variant: "default" },
    on_break: { text: "休憩中", variant: "outline" },
    finished: { text: "退勤済", variant: "secondary" },
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
            <Button onClick={handleClockIn} className="w-full h-16 text-lg" size="lg">
              出勤
            </Button>
          )}

          {(status === "working" || status === "on_break") && (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={handleBreakToggle}
                variant="outline"
                className="h-16 text-base"
              >
                {status === "on_break" ? "休憩終了" : "休憩開始"}
              </Button>
              <Button
                onClick={handleClockOut}
                variant="destructive"
                className="h-16 text-base"
                disabled={status === "on_break"}
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
      {clockIn && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">本日の勤務</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">出勤</p>
                <p className="text-lg font-semibold">{formatHM(clockIn)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">休憩</p>
                <p className="text-lg font-semibold">{totalBreak}分</p>
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

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDashboardData } from "../../actions/dashboard";
import { getMonthlyOvertimeLevel, getAnnualOvertimeLevel } from "@/lib/overtime-utils";

type OvertimeEntry = {
  name: string;
  hours: number;
  alert: boolean;
  annualHours: number;
  multiMonthAvgHours: number | null;
  annualProgressPercent: number;
};

type DashboardData = {
  totalUsers: number;
  clockedIn: number;
  todayMembers: { name: string; clock_in: string; clock_out: string | null }[];
  pendingRequests: number;
  overtimeRanking: OvertimeEntry[];
  approachingMonthly: OvertimeEntry[];
  approachingMultiMonth: OvertimeEntry[];
};

function formatHM(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

/** 月間残業時間に応じた Badge を返す */
function OvertimeBadge({ hours }: { hours: number }) {
  const level = getMonthlyOvertimeLevel(hours);
  return (
    <Badge
      variant={level.badgeVariant}
      className={level.badgeClassName || undefined}
    >
      {level.label}
    </Badge>
  );
}

/** 年間残業進捗バー */
function AnnualProgressBar({ hours, percent }: { hours: number; percent: number }) {
  const level = getAnnualOvertimeLevel(hours);
  const barColor =
    level.level === "danger" ? "bg-red-500" :
    level.level === "caution" ? "bg-orange-400" :
    level.level === "warning" ? "bg-yellow-400" : "bg-green-400";

  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{hours}h</span>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    getDashboardData().then(setData);
  }, []);

  if (!data) {
    return <p className="text-muted-foreground">読み込み中...</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">ダッシュボード</h2>

      {/* KPI カード */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">本日の出勤</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.clockedIn} / {data.totalUsers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">未承認申請</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${data.pendingRequests > 0 ? "text-destructive" : ""}`}>
              {data.pendingRequests}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">社員数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalUsers}</p>
          </CardContent>
        </Card>
      </div>

      {/* 36協定アラート一覧 */}
      {(data.approachingMonthly.length > 0 || data.approachingMultiMonth.length > 0) && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader>
            <CardTitle className="text-base text-orange-700">36協定アラート</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.approachingMonthly.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  今月の残業 30h 以上のメンバー
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.approachingMonthly.map((u, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-md border px-2 py-1 bg-white text-sm">
                      <span className="font-medium">{u.name}</span>
                      <OvertimeBadge hours={u.hours} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {data.approachingMultiMonth.length > 0 && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  複数月平均 60h 以上のメンバー（過労死ライン 80h に注意）
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.approachingMultiMonth.map((u, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-md border px-2 py-1 bg-white text-sm">
                      <span className="font-medium">{u.name}</span>
                      <Badge
                        variant="outline"
                        className="border-orange-400 text-orange-600 bg-orange-50"
                      >
                        平均{u.multiMonthAvgHours}h
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 本日の出勤状況 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">本日の出勤状況</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>出勤</TableHead>
                <TableHead>退勤</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.todayMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    本日の出勤者はいません
                  </TableCell>
                </TableRow>
              ) : (
                data.todayMembers.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{formatHM(m.clock_in)}</TableCell>
                    <TableCell>{m.clock_out ? formatHM(m.clock_out) : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={m.clock_out ? "secondary" : "default"}>
                        {m.clock_out ? "退勤済" : "勤務中"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 残業ランキング（今月・年間・複数月平均） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">今月の残業時間</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>今月</TableHead>
                <TableHead>年間累計 / 360h</TableHead>
                <TableHead>複数月平均</TableHead>
                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.overtimeRanking.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    今月の勤務データはありません
                  </TableCell>
                </TableRow>
              ) : (
                data.overtimeRanking.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.hours}h</TableCell>
                    <TableCell>
                      <AnnualProgressBar
                        hours={u.annualHours}
                        percent={u.annualProgressPercent}
                      />
                    </TableCell>
                    <TableCell>
                      {u.multiMonthAvgHours !== null ? (
                        <span className={
                          u.multiMonthAvgHours >= 80 ? "text-destructive font-medium" :
                          u.multiMonthAvgHours >= 60 ? "text-orange-600 font-medium" :
                          "text-muted-foreground"
                        }>
                          {u.multiMonthAvgHours}h
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OvertimeBadge hours={u.hours} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

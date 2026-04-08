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

type DashboardData = {
  totalUsers: number;
  clockedIn: number;
  todayMembers: { name: string; clock_in: string; clock_out: string | null }[];
  pendingRequests: number;
  overtimeRanking: { name: string; hours: number; alert: boolean }[];
};

function formatHM(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
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

      {/* 残業ランキング */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">今月の残業時間</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>残業時間</TableHead>
                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.overtimeRanking.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    今月の勤務データはありません
                  </TableCell>
                </TableRow>
              ) : (
                data.overtimeRanking.map((u, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.hours}h</TableCell>
                    <TableCell>
                      {u.alert ? (
                        <Badge variant="destructive">45h超過</Badge>
                      ) : u.hours > 30 ? (
                        <Badge variant="outline">注意</Badge>
                      ) : (
                        <Badge variant="secondary">正常</Badge>
                      )}
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

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMonthlyReport, generateCSV } from "../../actions/reports";

type ReportRow = {
  name: string;
  email: string;
  workDays: number;
  totalWorkHours: number;
  totalBreakHours: number;
  overtimeHours: number;
  leaveDays: number;
  overtimeAlert: boolean;
};

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getMonthlyReport(year, month).then((data) => {
      setReport(data);
      setLoading(false);
    });
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1); }
    else setMonth(month + 1);
  };

  const handleDownloadCSV = async () => {
    const csv = await generateCSV(year, month);
    if (!csv) return;
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `勤怠レポート_${year}年${month}月.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">月次レポート</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevMonth}>←</Button>
          <span className="text-lg font-medium w-32 text-center">{year}年{month}月</span>
          <Button variant="outline" size="sm" onClick={nextMonth}>→</Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleDownloadCSV} disabled={loading || !report}>
          CSVダウンロード
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>出勤日数</TableHead>
                <TableHead>勤務時間</TableHead>
                <TableHead>休憩時間</TableHead>
                <TableHead>残業時間</TableHead>
                <TableHead>休暇</TableHead>
                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : !report || report.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    データがありません
                  </TableCell>
                </TableRow>
              ) : (
                report.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.workDays}日</TableCell>
                    <TableCell>{r.totalWorkHours}h</TableCell>
                    <TableCell>{r.totalBreakHours}h</TableCell>
                    <TableCell>{r.overtimeHours}h</TableCell>
                    <TableCell>{r.leaveDays}日</TableCell>
                    <TableCell>
                      {r.overtimeAlert ? (
                        <Badge variant="destructive">45h超過</Badge>
                      ) : r.overtimeHours > 30 ? (
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

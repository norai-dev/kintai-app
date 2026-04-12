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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getMonthlyReport, generateCSV } from "../../actions/reports";
import { getClosingStatus, closeMonth, reopenMonth } from "../../actions/closing";
import { getMonthlyOvertimeLevel } from "@/lib/overtime-utils";
import type { MonthlyClosing } from "@/types/database";

type ReportRow = {
  name: string;
  email: string;
  workDays: number;
  totalWorkHours: number;
  totalBreakHours: number;
  overtimeHours: number;
  leaveDays: number;
  overtimeAlert: boolean;
  overtimeLevel?: "normal" | "warning" | "caution" | "danger";
};

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<MonthlyClosing | null>(null);
  const [closingLoading, setClosingLoading] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");

  const isClosed = closing !== null && closing.reopened_at === null;

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getMonthlyReport(year, month),
      getClosingStatus(year, month),
    ]).then(([reportData, closingData]) => {
      setReport(reportData);
      setClosing(closingData);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
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

  const handleCloseMonth = async () => {
    if (!confirm(`${year}年${month}月を月次確定しますか？\n確定後はメンバーの勤怠データを編集できなくなります。`)) return;
    setClosingLoading(true);
    const result = await closeMonth(year, month);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${year}年${month}月を月次確定しました`);
      const updated = await getClosingStatus(year, month);
      setClosing(updated);
    }
    setClosingLoading(false);
  };

  const handleReopenMonth = async () => {
    if (!reopenReason.trim()) {
      toast.error("解除理由を入力してください");
      return;
    }
    setClosingLoading(true);
    const result = await reopenMonth(year, month, reopenReason);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`${year}年${month}月の月次確定を解除しました`);
      setReopenDialogOpen(false);
      setReopenReason("");
      const updated = await getClosingStatus(year, month);
      setClosing(updated);
    }
    setClosingLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">月次レポート</h2>
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

      {/* 月次締め状態パネル */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">月次確定状態</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          {isClosed ? (
            <div className="text-sm text-blue-800">
              <span className="font-medium">確定済み</span>
              {closing?.closed_at && (
                <span className="ml-2 text-muted-foreground">
                  {new Date(closing.closed_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })} 確定
                </span>
              )}
              {closing?.reopen_reason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  前回解除理由: {closing.reopen_reason}
                </p>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">未確定</div>
          )}
          <div className="flex gap-2">
            {isClosed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReopenDialogOpen(true)}
                disabled={closingLoading}
              >
                確定解除
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleCloseMonth}
                disabled={closingLoading || loading}
              >
                {closingLoading ? "処理中..." : "月次確定"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
                      {(() => {
                        const level = getMonthlyOvertimeLevel(r.overtimeHours);
                        return (
                          <Badge
                            variant={level.badgeVariant}
                            className={level.badgeClassName || undefined}
                          >
                            {level.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 確定解除ダイアログ */}
      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{year}年{month}月の月次確定を解除</DialogTitle>
            <DialogDescription>
              解除後はメンバーが勤怠データを編集できるようになります。解除理由を入力してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>解除理由</Label>
              <Textarea
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="例: 〇〇さんの勤怠漏れを修正するため"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setReopenDialogOpen(false); setReopenReason(""); }}>
                キャンセル
              </Button>
              <Button
                variant="destructive"
                onClick={handleReopenMonth}
                disabled={closingLoading || !reopenReason.trim()}
              >
                {closingLoading ? "処理中..." : "確定解除"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

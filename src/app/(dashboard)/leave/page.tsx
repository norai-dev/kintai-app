"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { getLeaveBalance, getMyLeaveRequests, submitLeaveRequest } from "../actions/leave";
import type { LeaveRequest, LeaveBalance } from "@/types/database";

const statusLabel: Record<string, { text: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { text: "申請中", variant: "outline" },
  approved: { text: "承認済", variant: "default" },
  rejected: { text: "却下", variant: "destructive" },
};

const leaveTypeLabel: Record<string, string> = {
  paid: "有給休暇",
  sick: "病欠",
  special: "特別休暇",
};

export default function LeavePage() {
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveType, setLeaveType] = useState("paid");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState("1");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getLeaveBalance().then(setBalance);
    getMyLeaveRequests().then(setRequests);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await submitLeaveRequest({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate || startDate,
        days: parseFloat(days),
        reason,
      });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("休暇申請を送信しました");
        setStartDate("");
        setEndDate("");
        setDays("1");
        setReason("");
        getMyLeaveRequests().then(setRequests);
      }
    });
  };

  const remaining = balance ? balance.total_days - balance.used_days : null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">休暇申請</h2>

      {/* 有給残日数 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">付与日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{balance ? `${balance.total_days}日` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">取得済み</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{balance ? `${balance.used_days}日` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">残日数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${remaining !== null && remaining <= 5 ? "text-destructive" : ""}`}>
              {remaining !== null ? `${remaining}日` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 申請フォーム */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">新規申請</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>休暇種類</Label>
                <Select value={leaveType} onValueChange={(v) => v && setLeaveType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">有給休暇</SelectItem>
                    <SelectItem value="sick">病欠</SelectItem>
                    <SelectItem value="special">特別休暇</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>日数</Label>
                <Select value={days} onValueChange={(v) => v && setDays(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5日（半休）</SelectItem>
                    <SelectItem value="1">1日</SelectItem>
                    <SelectItem value="2">2日</SelectItem>
                    <SelectItem value="3">3日</SelectItem>
                    <SelectItem value="5">5日</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>開始日</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>終了日</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>理由</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="任意" />
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "送信中..." : "申請する"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 申請履歴 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">申請履歴</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>種類</TableHead>
                <TableHead>期間</TableHead>
                <TableHead>日数</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    申請履歴はありません
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{leaveTypeLabel[req.leave_type] ?? req.leave_type}</TableCell>
                    <TableCell>{req.start_date}{req.end_date !== req.start_date ? ` 〜 ${req.end_date}` : ""}</TableCell>
                    <TableCell>{req.days}日</TableCell>
                    <TableCell className="max-w-48 truncate">{req.reason || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={statusLabel[req.status]?.variant ?? "secondary"}>
                        {statusLabel[req.status]?.text ?? req.status}
                      </Badge>
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

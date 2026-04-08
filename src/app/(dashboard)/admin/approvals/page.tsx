"use client";

import { useState, useEffect, useTransition } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getAllLeaveRequests, approveLeaveRequest } from "../../actions/leave";
import type { LeaveRequest } from "@/types/database";

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

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<(LeaveRequest & { user_name?: string })[]>([]);
  const [isPending, startTransition] = useTransition();

  const loadRequests = () => {
    getAllLeaveRequests().then(setRequests);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = (id: string, action: "approved" | "rejected") => {
    startTransition(async () => {
      const result = await approveLeaveRequest(id, action);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(action === "approved" ? "承認しました" : "却下しました");
        loadRequests();
      }
    });
  };

  const pending = requests.filter((r) => r.status === "pending");
  const processed = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">承認</h2>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            未承認 {pending.length > 0 && `(${pending.length})`}
          </TabsTrigger>
          <TabsTrigger value="processed">処理済み</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請者</TableHead>
                    <TableHead>種類</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>日数</TableHead>
                    <TableHead>理由</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pending.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        未承認の申請はありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    pending.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.user_name}</TableCell>
                        <TableCell>{leaveTypeLabel[req.leave_type] ?? req.leave_type}</TableCell>
                        <TableCell>{req.start_date}{req.end_date !== req.start_date ? ` 〜 ${req.end_date}` : ""}</TableCell>
                        <TableCell>{req.days}日</TableCell>
                        <TableCell className="max-w-32 truncate">{req.reason || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(req.id, "approved")}
                              disabled={isPending}
                            >
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApprove(req.id, "rejected")}
                              disabled={isPending}
                            >
                              却下
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processed" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請者</TableHead>
                    <TableHead>種類</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>日数</TableHead>
                    <TableHead>ステータス</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processed.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        処理済みの申請はありません
                      </TableCell>
                    </TableRow>
                  ) : (
                    processed.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.user_name}</TableCell>
                        <TableCell>{leaveTypeLabel[req.leave_type] ?? req.leave_type}</TableCell>
                        <TableCell>{req.start_date}{req.end_date !== req.start_date ? ` 〜 ${req.end_date}` : ""}</TableCell>
                        <TableCell>{req.days}日</TableCell>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

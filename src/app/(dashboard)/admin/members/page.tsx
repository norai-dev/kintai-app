"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllMembers } from "../../actions/members";

type Member = {
  id: string;
  name: string;
  email: string;
  role: string;
  work_type: string;
  created_at: string;
};

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    getAllMembers().then(setMembers);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">メンバー管理</h2>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>メール</TableHead>
                <TableHead>ロール</TableHead>
                <TableHead>勤務形態</TableHead>
                <TableHead>登録日</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    メンバーがいません
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>
                      <Badge variant={m.role === "admin" ? "default" : "secondary"}>
                        {m.role === "admin" ? "管理者" : "メンバー"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.work_type === "fixed" ? "固定時間制" : "フレックス"}
                    </TableCell>
                    <TableCell>
                      {new Date(m.created_at).toLocaleDateString("ja-JP")}
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

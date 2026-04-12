"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getHolidays,
  upsertHoliday,
  deleteHoliday,
  importNationalHolidays,
} from "../../actions/holidays";
import type { Holiday } from "@/types/database";

export default function AdminHolidaysPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // 追加フォーム
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"national" | "company">("company");

  const loadHolidays = () => {
    setLoading(true);
    getHolidays(year).then((data) => {
      setHolidays(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadHolidays();
  }, [year]);

  const handleImport = () => {
    startTransition(async () => {
      const result = await importNationalHolidays(year);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`${result.count}件の祝日をインポートしました`);
        loadHolidays();
      }
    });
  };

  const handleAdd = () => {
    if (!newDate || !newName) {
      toast.error("日付と名称を入力してください");
      return;
    }
    startTransition(async () => {
      const result = await upsertHoliday({ date: newDate, name: newName, type: newType });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("祝日を追加しました");
        setNewDate("");
        setNewName("");
        setNewType("company");
        loadHolidays();
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    startTransition(async () => {
      const result = await deleteHoliday(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`「${name}」を削除しました`);
        loadHolidays();
      }
    });
  };

  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">祝日・会社カレンダー管理</h2>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleImport} disabled={isPending} variant="outline">
            {isPending ? "処理中..." : "祝日インポート"}
          </Button>
        </div>
      </div>

      {/* 会社休日追加フォーム */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">会社休日を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>日付</Label>
              <Input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="例: 創立記念日"
                className="w-52"
              />
            </div>
            <div className="space-y-2">
              <Label>種別</Label>
              <Select value={newType} onValueChange={(v) => v && setNewType(v as "national" | "company")}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">会社休日</SelectItem>
                  <SelectItem value="national">国民の祝日</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={isPending}>
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 祝日一覧テーブル */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{year}年 祝日一覧（{holidays.length}件）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>曜日</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>種別</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    読み込み中...
                  </TableCell>
                </TableRow>
              ) : holidays.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {year}年の祝日データはありません。「祝日インポート」で国民の祝日を追加できます。
                  </TableCell>
                </TableRow>
              ) : (
                holidays.map((h) => {
                  const d = new Date(h.date + "T00:00:00");
                  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
                  const dow = d.getDay();
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        {d.toLocaleDateString("ja-JP", { month: "long", day: "numeric" })}
                      </TableCell>
                      <TableCell className={dow === 0 ? "text-red-500" : dow === 6 ? "text-blue-500" : ""}>
                        {weekdays[dow]}
                      </TableCell>
                      <TableCell>{h.name}</TableCell>
                      <TableCell>
                        <Badge variant={h.type === "national" ? "default" : "secondary"}>
                          {h.type === "national" ? "国民の祝日" : "会社休日"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDelete(h.id, h.name)}
                          disabled={isPending}
                        >
                          削除
                        </Button>
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

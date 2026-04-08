import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MembersPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">メンバー管理</h2>
      <Card>
        <CardHeader>
          <CardTitle>社員一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">メンバー管理はPhase 3で実装予定</p>
        </CardContent>
      </Card>
    </div>
  );
}

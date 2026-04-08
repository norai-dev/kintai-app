import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">承認</h2>
      <Card>
        <CardHeader>
          <CardTitle>申請一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">承認フローはPhase 3で実装予定</p>
        </CardContent>
      </Card>
    </div>
  );
}

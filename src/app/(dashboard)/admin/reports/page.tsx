import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">月次レポート</h2>
      <Card>
        <CardHeader>
          <CardTitle>勤怠集計</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">月次レポートはPhase 4で実装予定</p>
        </CardContent>
      </Card>
    </div>
  );
}

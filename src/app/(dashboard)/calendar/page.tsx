import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">勤怠一覧</h2>
      <Card>
        <CardHeader>
          <CardTitle>月次カレンダー</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">勤怠カレンダーはPhase 2で実装予定</p>
        </CardContent>
      </Card>
    </div>
  );
}

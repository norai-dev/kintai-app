import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LeavePage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">休暇申請</h2>
      <Card>
        <CardHeader>
          <CardTitle>有給休暇</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">休暇申請はPhase 3で実装予定</p>
        </CardContent>
      </Card>
    </div>
  );
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role clientを使用（RLSバイパス）
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function todayDate() {
  return new Date().toLocaleDateString("en-CA");
}

async function getUserBySlackEmail(supabase: ReturnType<typeof getAdminClient>, email: string) {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();
  return data;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const token = formData.get("token") as string;
  const command = formData.get("command") as string;
  const text = (formData.get("text") as string || "").trim();
  const userId = formData.get("user_id") as string;
  const userName = formData.get("user_name") as string;

  // Slack署名検証（本番ではSigning Secretで検証すべき）
  if (!process.env.SLACK_VERIFICATION_TOKEN || token !== process.env.SLACK_VERIFICATION_TOKEN) {
    // 開発中はスキップ可能
  }

  const supabase = getAdminClient();

  // SlackユーザーのメールからDBユーザーを特定
  // Slack APIでメール取得が必要だが、簡易版としてSlack user_idで検索
  // まずはSlackのuser_nameベースでユーザーを検索
  const { data: users } = await supabase.from("users").select("*");

  // Slack連携用: emailまたはnameでマッチ（本番ではSlack user_idをDBに保存すべき）
  const user = users?.find((u: { email: string; name: string }) =>
    u.name === userName || u.email.split("@")[0] === userName
  );

  if (!user) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: `ユーザーが見つかりません。勤怠管理アプリに登録されているか確認してください。（Slack: ${userName}）`,
    });
  }

  const subCommand = text.split(" ")[0]?.toLowerCase();

  switch (subCommand) {
    case "in":
    case "出勤": {
      const now = new Date().toISOString();
      const { error } = await supabase.from("attendance_records").insert({
        user_id: user.id,
        date: todayDate(),
        clock_in: now,
        work_location: "remote",
        source: "slack",
      });
      if (error?.code === "23505") {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "既に本日は出勤済みです。",
        });
      }
      if (error) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: `エラー: ${error.message}`,
        });
      }
      return NextResponse.json({
        response_type: "in_channel",
        text: `${user.name} が出勤しました 🟢`,
      });
    }

    case "out":
    case "退勤": {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("attendance_records")
        .update({ clock_out: now })
        .eq("user_id", user.id)
        .eq("date", todayDate())
        .is("clock_out", null);
      if (error) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: `エラー: ${error.message}`,
        });
      }
      return NextResponse.json({
        response_type: "in_channel",
        text: `${user.name} が退勤しました 🔴`,
      });
    }

    case "break":
    case "休憩": {
      // 休憩開始/終了をトグル
      const { data: record } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayDate())
        .single();

      if (!record || !record.clock_in) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "まだ出勤していません。先に `/kintai in` で出勤してください。",
        });
      }

      const now = new Date().toISOString();
      if (!record.break_start) {
        await supabase
          .from("attendance_records")
          .update({ break_start: now })
          .eq("id", record.id);
        return NextResponse.json({
          response_type: "in_channel",
          text: `${user.name} が休憩に入りました ☕`,
        });
      } else if (!record.break_end) {
        await supabase
          .from("attendance_records")
          .update({ break_end: now })
          .eq("id", record.id);
        return NextResponse.json({
          response_type: "in_channel",
          text: `${user.name} が休憩から戻りました 💪`,
        });
      } else {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "本日の休憩は既に記録済みです。",
        });
      }
    }

    case "status":
    case "確認": {
      const { data: record } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", todayDate())
        .single();

      if (!record) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "本日はまだ出勤していません。",
        });
      }

      const clockIn = new Date(record.clock_in).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      const clockOut = record.clock_out
        ? new Date(record.clock_out).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
        : "—";
      const status = record.clock_out ? "退勤済" : record.break_start && !record.break_end ? "休憩中" : "勤務中";

      return NextResponse.json({
        response_type: "ephemeral",
        text: `📋 *${user.name}の本日の勤怠*\n• 出勤: ${clockIn}\n• 退勤: ${clockOut}\n• ステータス: ${status}`,
      });
    }

    default:
      return NextResponse.json({
        response_type: "ephemeral",
        text: [
          "📖 *使い方*",
          "`/kintai in` — 出勤",
          "`/kintai out` — 退勤",
          "`/kintai break` — 休憩開始/終了",
          "`/kintai status` — 本日の勤怠確認",
        ].join("\n"),
      });
  }
}

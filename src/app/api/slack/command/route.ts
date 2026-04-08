import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function todayDate() {
  const now = new Date();
  // 日本時間で日付を取得
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);

    const text = (params.get("text") ?? "").trim().toLowerCase();
    const userName = params.get("user_name") ?? "";
    const slackUserId = params.get("user_id") ?? "";

    console.log("Slack command:", { text, userName, slackUserId });

    const supabase = getAdminClient();

    // ユーザーを検索
    const { data: users } = await supabase.from("users").select("*");
    const user = users?.find((u: { email: string; name: string }) =>
      u.name === userName ||
      u.email.split("@")[0] === userName ||
      u.name.toLowerCase() === userName.toLowerCase()
    );

    // ユーザーが見つからない場合、最初のユーザーを使う（小規模チーム向け暫定対応）
    const targetUser = user || (users && users.length > 0 ? users[0] : null);

    if (!targetUser) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: `ユーザーが見つかりません。勤怠管理アプリに登録してください。`,
      });
    }

    const subCommand = text.split(" ")[0];

    switch (subCommand) {
      case "in":
      case "出勤": {
        const now = new Date().toISOString();
        const { error } = await supabase.from("attendance_records").insert({
          user_id: targetUser.id,
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
          text: `${targetUser.name} が出勤しました 🟢`,
        });
      }

      case "out":
      case "退勤": {
        const now = new Date().toISOString();
        const { error } = await supabase
          .from("attendance_records")
          .update({ clock_out: now })
          .eq("user_id", targetUser.id)
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
          text: `${targetUser.name} が退勤しました 🔴`,
        });
      }

      case "break":
      case "休憩": {
        const { data: record } = await supabase
          .from("attendance_records")
          .select("*")
          .eq("user_id", targetUser.id)
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
            text: `${targetUser.name} が休憩に入りました ☕`,
          });
        } else if (!record.break_end) {
          await supabase
            .from("attendance_records")
            .update({ break_end: now })
            .eq("id", record.id);
          return NextResponse.json({
            response_type: "in_channel",
            text: `${targetUser.name} が休憩から戻りました 💪`,
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
          .eq("user_id", targetUser.id)
          .eq("date", todayDate())
          .single();

        if (!record) {
          return NextResponse.json({
            response_type: "ephemeral",
            text: "本日はまだ出勤していません。",
          });
        }

        const clockIn = new Date(record.clock_in).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
        const clockOut = record.clock_out
          ? new Date(record.clock_out).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })
          : "—";
        const status = record.clock_out ? "退勤済" : record.break_start && !record.break_end ? "休憩中" : "勤務中";

        return NextResponse.json({
          response_type: "ephemeral",
          text: `📋 *${targetUser.name}の本日の勤怠*\n• 出勤: ${clockIn}\n• 退勤: ${clockOut}\n• ステータス: ${status}`,
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
  } catch (err) {
    console.error("Slack command error:", err);
    return NextResponse.json({
      response_type: "ephemeral",
      text: "内部エラーが発生しました。管理者に連絡してください。",
    });
  }
}

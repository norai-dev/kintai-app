# Kintai - 社内勤怠管理アプリ

社内メンバーの勤怠を管理するWebアプリ。Web画面とSlackから打刻できる。

## 本番URL

- Web: https://kintai.norainu.co.jp
- Slack: `/kintai in` `/kintai out` `/kintai break` `/kintai status`

## 機能一覧

| 機能 | 説明 |
|------|------|
| Web打刻 | 出勤/退勤/休憩をワンクリックで記録 |
| Slack打刻 | `/kintai in` でSlackから打刻 |
| 勤怠カレンダー | 月次の勤怠一覧を表示。出勤日数・勤務時間のサマリー付き |
| 休暇申請 | 有給残日数の確認、休暇申請フォーム |
| 承認フロー | 管理者が休暇申請を承認/却下 |
| 管理者ダッシュボード | 本日の出勤状況、未承認申請数、残業ランキング |
| 月次レポート | 全員の勤怠集計テーブル + CSVダウンロード |
| メンバー管理 | 社員一覧の確認 |
| 残業アラート | 月45h超過を赤バッジで警告 |

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 16 (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| バックエンド/DB | Supabase (PostgreSQL) |
| 認証 | Supabase Auth |
| Slack連携 | Slash Command + API Route |
| ホスティング | Vercel |

## プロジェクト構成

```
src/
├── app/
│   ├── layout.tsx                  # ルートレイアウト
│   ├── login/page.tsx              # ログイン画面
│   ├── auth/callback/route.ts      # 認証コールバック
│   ├── api/slack/command/route.ts  # Slackスラッシュコマンド
│   └── (dashboard)/
│       ├── layout.tsx              # サイドバー付きレイアウト
│       ├── page.tsx                # 打刻画面（ホーム）
│       ├── calendar/page.tsx       # 勤怠カレンダー
│       ├── leave/page.tsx          # 休暇申請
│       ├── actions/                # Server Actions
│       │   ├── attendance.ts       # 打刻API
│       │   ├── calendar.ts         # カレンダーデータ取得
│       │   ├── leave.ts            # 休暇申請・承認
│       │   ├── dashboard.ts        # ダッシュボードデータ
│       │   ├── reports.ts          # 月次レポート・CSV
│       │   ├── members.ts          # メンバー一覧
│       │   └── auth.ts             # ログアウト
│       └── admin/
│           ├── dashboard/page.tsx  # 管理者ダッシュボード
│           ├── approvals/page.tsx  # 承認一覧
│           ├── members/page.tsx    # メンバー管理
│           └── reports/page.tsx    # 月次レポート
├── components/
│   ├── app-sidebar.tsx             # サイドバーナビ
│   ├── logout-button.tsx           # ログアウトボタン
│   └── ui/                         # shadcn/uiコンポーネント
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # ブラウザ用Supabaseクライアント
│   │   ├── server.ts               # サーバー用Supabaseクライアント
│   │   └── middleware.ts            # 認証ミドルウェア
│   ├── get-current-user.ts         # 現在のユーザー取得
│   └── utils.ts                    # ユーティリティ
├── types/
│   └── database.ts                 # DB型定義
└── proxy.ts                        # Next.js Proxy（認証チェック）

supabase/
└── migrations/
    └── 00001_initial_schema.sql    # DBスキーマ（6テーブル + RLS）
```

## データベース

| テーブル | 用途 |
|---------|------|
| users | 社員情報（ロール、勤務形態） |
| attendance_records | 打刻データ（出退勤、休憩、勤務場所） |
| leave_balances | 有給残日数（年度ごと） |
| leave_requests | 休暇申請（承認ステータス付き） |
| attendance_corrections | 勤怠修正申請 |
| overtime_requests | 残業申請 |

## ローカル開発

```bash
# 依存パッケージインストール
npm install

# 環境変数を設定
cp .env.local.example .env.local
# .env.local にSupabaseのURLとキーを設定

# 開発サーバー起動
npm run dev
```

http://localhost:3000 でアクセス。

## 環境変数

| 変数名 | 用途 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名キー |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスロールキー（Slack連携用） |
| `SLACK_VERIFICATION_TOKEN` | Slack App検証トークン |

## Slack連携

| コマンド | 動作 |
|---------|------|
| `/kintai in` | 出勤打刻 |
| `/kintai out` | 退勤打刻 |
| `/kintai break` | 休憩開始/終了 |
| `/kintai status` | 本日の勤怠確認 |

## ユーザーロール

| ロール | 権限 |
|--------|------|
| admin | 全機能（ダッシュボード、承認、レポート、メンバー管理） |
| member | 打刻、勤怠カレンダー、休暇申請 |

最初に登録したユーザーが自動的にadminになる。

# Agentia

Claude Codeがコードを読み、調査し、実装し、テストし、コマンドを実行している様子を、**バーチャルオフィスで働くAI社員**としてリアルタイムに可視化するWebアプリです。

単なるログビューアではなく、Claude Codeが「今何をしているか」が空間的・視覚的に直感で分かり、眺めていて楽しいダッシュボードを目指しています。

> **現在のステータス: 設計フェーズ完了、実装未着手**
> このリポジトリには現時点でアプリケーションコードは含まれていません。`docs/`配下に、要件定義からMVPタスク分解までの設計ドキュメント一式があります。

## コンセプト

- Read / Grep / Glob → 調査スペースへ移動
- Edit / Write → 開発デスクでコーディング
- Bash → ターミナルルーム(test/lint系はQAルーム、deploy系はデプロイエリア)
- Sub Agent(Task) → 新しいAI社員がオフィスに出現
- エラー発生 → 警告アイコン表示
- ユーザー入力待ち → キャラクターが待機状態に

Claude Code Hooksを用いてイベントを取得し、ローカルのイベントサーバー経由でWebSocketによりフロントエンドへリアルタイム配信します。

## ドキュメント

設計の全体像は [`docs/00_MASTER_PLAN.md`](./docs/00_MASTER_PLAN.md) から辿れます。特に、Claude Codeから「実際に取得できる情報」と「理想的な可視化仕様」のギャップは [`docs/04_CLAUDE_CODE_INTEGRATION.md`](./docs/04_CLAUDE_CODE_INTEGRATION.md) にまとめています。

| # | ドキュメント |
|---|---|
| 00 | [マスタープラン](./docs/00_MASTER_PLAN.md) |
| 01 | [プロジェクト憲章](./docs/01_PROJECT_CHARTER.md) |
| 02 | [要求仕様](./docs/02_REQUIREMENTS.md) |
| 03 | [システムアーキテクチャ](./docs/03_SYSTEM_ARCHITECTURE.md) |
| 04 | [Claude Code連携設計](./docs/04_CLAUDE_CODE_INTEGRATION.md) |
| 05 | [イベント設計](./docs/05_EVENT_DESIGN.md) |
| 06 | [リアルタイム通信設計](./docs/06_REALTIME_COMMUNICATION.md) |
| 07 | [UI/UXデザイン](./docs/07_UI_UX_DESIGN.md) |
| 08 | [画面設計](./docs/08_SCREEN_DESIGN.md) |
| 09 | [キャラクターシステム](./docs/09_CHARACTER_SYSTEM.md) |
| 10 | [オフィスシステム](./docs/10_OFFICE_SYSTEM.md) |
| 11 | [データベース設計](./docs/11_DATABASE_DESIGN.md) |
| 12 | [API設計](./docs/12_API_DESIGN.md) |
| 13 | [フロントエンド設計](./docs/13_FRONTEND_DESIGN.md) |
| 14 | [バックエンド設計](./docs/14_BACKEND_DESIGN.md) |
| 15 | [セキュリティ設計](./docs/15_SECURITY_DESIGN.md) |
| 16 | [テスト方針](./docs/16_TEST_PLAN.md) |
| 17 | [MVP計画](./docs/17_MVP_PLAN.md) |
| 18 | [ロードマップ](./docs/18_ROADMAP.md) |

## 推奨プロジェクト構成(実装時、`03_SYSTEM_ARCHITECTURE.md`/`13`/`14`章参照)

```
agentia/
├── apps/
│   ├── web/                 # Next.js フロントエンド(バーチャルオフィスUI)
│   └── server/              # Fastify Ingest/REST/WebSocketサーバー
├── packages/
│   ├── hook-forwarder/      # Claude Code Hooksからの受信・転送CLI(agentia-hook)
│   ├── shared-types/        # イベントスキーマ・APIの型(Zod)をフロント/バック共有
│   └── db/                  # (Phase3〜) Prisma schema・マイグレーション
├── tools/
│   └── pixel-art/           # ドット絵スプライト生成パイプライン(pngjs、apps/web/public/spritesへ出力)
├── docs/                    # 本設計ドキュメント一式
├── turbo.json
└── package.json
```

- `apps/web`: 画面・キャラクター描画・状態管理。詳細は`13_FRONTEND_DESIGN.md`。
- `apps/server`: Hookイベントの正規化・相関・WebSocket配信。詳細は`14_BACKEND_DESIGN.md`。
- `tools/pixel-art`: キャラクター・什器・床/壁のドット絵を手続き生成しPNG化するスクリプト(`node tools/pixel-art/generate.mjs`で再生成)。詳細は`07_UI_UX_DESIGN.md` 2.1節。
- `packages/hook-forwarder`: `.claude/settings.json`から呼び出される転送用CLI。詳細は`04_CLAUDE_CODE_INTEGRATION.md`。
- `packages/shared-types`: `05_EVENT_DESIGN.md`のイベントスキーマ、`12_API_DESIGN.md`のAPI型をZodで定義し両アプリから参照する。

## 開発方針

TypeScript strict mode / any禁止 / 責務分離 / マジックナンバー禁止 / 環境変数管理 / ESLint・Prettier / テスト可能な設計 / エラーハンドリングとログ設計を徹底します(詳細は各設計書、特に`13`〜`16`章)。

## 次のアクション

[`docs/17_MVP_PLAN.md`](./docs/17_MVP_PLAN.md) の Track A(Hook連携基盤)から実装を開始します。

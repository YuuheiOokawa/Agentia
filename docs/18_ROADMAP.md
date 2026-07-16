# 18. ロードマップ

## 1. フェーズ概要

| フェーズ | 主な内容 |
|---|---|
| MVP | `17_MVP_PLAN.md`参照。単一エージェント・5エリア・DBレス |
| Phase 2 | 複数Sub Agent同時可視化、全12エリア、ダッシュボード/履歴/プロジェクト/統計画面、プロジェクト切替 |
| Phase 3 | PostgreSQL+Prisma導入、セッション履歴・統計の永続化、GitHub連携(Webhook受信・可視化)、OTel連携によるトークン/コスト表示 |
| Phase 4 | ゲーム要素(会社経験値・レベル・オフィス拡張)、実績システム |

## 2. Phase 2 詳細(実装済み)

- Sub Agent相関(`SubagentStart`/`SubagentStop`、`agent_id`)を実装し、`09_CHARACTER_SYSTEM.md`の動的役職判定を有効化。
- オフィスエリアを12種へ拡張(会議室、個人デスクの分離、デプロイエリア、サーバールーム、GitHub連携スペース、PM スペース等、`10_OFFICE_SYSTEM.md`参照)。カイロソフト風の実ドット絵アセット(`tools/pixel-art/`生成)で床・壁・什器・キャラクターを描画するよう刷新済み(`07_UI_UX_DESIGN.md` 2.1節)。
- ダッシュボード/セッション履歴(一覧・詳細)/プロジェクト一覧・詳細/統計画面を実装(`08_SCREEN_DESIGN.md`)。永続化はまだJSONLベースの簡易集計(`apps/server/src/persistence/session-history.ts`が`~/.agentia/logs/*.jsonl`を都度スキャン)。
- プロジェクト切替UI(`ProjectSwitcher`)と、サーバー再起動をまたいで永続化するプロジェクトレジストリ(`apps/server/src/persistence/project-registry.ts`、`~/.agentia/data/projects.json`)を実装。WebSocket自体は`projectId`単位のブロードキャストのまま(接続自体は`AppShell`が画面横断で1本を共有)。

## 3. Phase 3 詳細(実装済み)

- `packages/db`に`11_DATABASE_DESIGN.md`のスキーマをPrismaで実装(PostgreSQL)。`ProjectRegistry`・`session-history.ts`・`session-manager.ts`をJSONLファイルベースからPrisma経由の読み書きへ全面移行(`apps/server/src/persistence/db-writer.ts`)。FK整合性は「セッション行の存在を保証するPromise(`dbReady`)にEvent/Agent書き込みを連鎖させる」方式で、Ingest応答をブロックせずに担保している。
  - 既存ローカルログを失わない移行用に`scripts/import-jsonl.ts`(`npm run import-jsonl`)を用意。JSONL+`projects.json`からPostgresへ冪等にバックフィル可能。
- `POST /webhooks/github`(署名検証: `X-Hub-Signature-256` + `AGENTIA_GITHUB_WEBHOOK_SECRET`)を追加し、push/pull_request/issues/pull_request_reviewを`GithubEvent`テーブルへ正規化・保存。プロジェクトと連携先リポジトリの紐付けは`PUT /api/projects/:projectId/github-repo`とプロジェクト詳細画面のUIから設定可能。同画面に直近アクティビティ一覧を表示(`GET /api/projects/:projectId/github-events`)。
- `POST /v1/metrics`でOTLP/HTTP JSONメトリクスを受信し、`claude_code.token.usage`/`claude_code.cost.usage`を`session.id`属性でセッションに紐付けて集計(`04_CLAUDE_CODE_INTEGRATION.md`のC分類項目を解消)。ダッシュボード・プロジェクト詳細・セッション詳細・統計画面にトークン数/推定コストを表示。

未着手(Phase3スコープ外に後送り): レイテンシのOTelスパンからの正確な取得、GitHub連携イベントの office 上でのライブなキャラクター表現(現状はプロジェクト詳細画面のテキスト一覧のみ)。

## 4. Phase 4 詳細(ゲーム要素、設計のみ先行)

### 4.1 データモデル拡張(`11_DATABASE_DESIGN.md`の`CompanyState`を活用)

```typescript
interface CompanyState {
  projectId: string;
  level: number;
  experiencePoints: number;
  unlockedFeatures: string[]; // "meeting_room" | "server_room" | "cafe" | ...
}
```

### 4.2 経験値獲得ルール(例、実装時に調整)

| アクション | EXP |
|---|---|
| コード編集(Edit/Write成功) | +2 |
| コミット(将来のGitHub連携経由) | +10 |
| テスト成功 | +5 |
| プロジェクト完了(ユーザーが明示マーク、または一定期間の連続稼働) | +100 |
| Sub Agent活用 | +3 |

### 4.3 レベルアップ時の解放要素

- Lv2: 会議室拡張、個人デスク増設
- Lv5: サーバールーム、デプロイエリア高度化(演出強化)
- Lv10: カフェ(休憩スペース拡張)、AI社員用の装飾バリエーション追加
- Lv20+: 新フロア(複数フロア切替、`10_OFFICE_SYSTEM.md` 6章の`unlockLevel`拡張ポイントを利用)

### 4.4 設計上の備え(MVP〜Phase3で先行確保しておく拡張ポイント)

- `OfficeArea.unlockLevel`フィールド(10章)
- `CompanyState`テーブル(11章)
- イベント設計における`eventType`の追加余地(経験値付与イベント`exp_gain`を将来追加してもWebSocketプロトコル・フロントの`applyEvent`パターンをそのまま再利用できる)

## 5. 技術的リスクと対応

| リスク | 内容 | 対応方針 |
|---|---|---|
| Hooks仕様のバージョン差異 | Claude Codeのアップデートでフィールド名・イベント種別が変わる可能性 | `normalizer.ts`をアダプタパターン化し、バージョン判定またはフィールド欠損への耐性(オプショナルチェイニング+デフォルト値)を持たせる |
| Sub Agent識別精度 | `agent_type`が汎用値の場合、役職推測が誤る可能性 | 動的再評価ロジック(09章)+ユーザーが手動で役職名を編集できるUIをPhase2で検討 |
| リアルタイム性とキャラクター移動演出の両立 | 高頻度イベントで移動が不自然になる可能性 | 移動キューの優先度・間引きロジック(10章4.2節)で吸収、負荷テスト(D3)で継続検証 |
| OTel連携の複雑さ | Collectorセットアップの学習コストがユーザーに発生 | Phase3ではオプトイン機能とし、未設定でも他機能に影響しないよう分離 |
| ゲーム要素による「作業の道具」から「ゲーム化」への体験の変質 | 過度なゲーミフィケーションが本来の可視化価値を損なう懸念 | Phase4導入時もコア画面(バーチャルオフィス)の情報密度・実用性を優先し、ゲーム要素はオプトアウト可能にする |

## 6. まとめ

| 項目 | 内容 |
|---|---|
| **推奨技術スタック** | Next.js(App Router) + TypeScript(strict) + PixiJS + Zustand + Fastify + WebSocket(ws) + (Phase3〜)PostgreSQL/Prisma |
| **MVP構成** | 単一エージェント・5エリア・DBレス・Hooks(command型)→Forwarder→Fastify Ingest→WebSocket→Next.js |
| **システム構成** | `03_SYSTEM_ARCHITECTURE.md`参照。Claude Code→Hook Forwarder→Ingest API→Correlator→WebSocket Hub→フロントエンド |
| **最大の技術的リスク** | Hooksペイロードの情報粒度(タイムスタンプ・Bash終了コード・思考状態が取得不可)とClaude Codeのバージョン差異への追従 |
| **最初に実装すべき機能** | Hook Forwarder→Ingest API→WebSocket Hubの最小疎通(ダミーイベントがブラウザに届くこと)。次いでtool-classificationとキャラクター移動 |
| **MVP完成までの開発ステップ** | `17_MVP_PLAN.md`の Track A(Hook連携)→Track B(配信基盤)→Track C(フロント/オフィス表現)→Track D(品質保証) |

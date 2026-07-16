# 00. マスタープラン

本ドキュメントは設計書群全体の索引であり、横断的な意思決定のサマリである。各詳細は個別ドキュメントを参照。

## 1. ドキュメント索引

| # | ドキュメント | 内容 |
|---|---|---|
| 01 | [PROJECT_CHARTER](./01_PROJECT_CHARTER.md) | ビジョン、ゴール、スコープ、KPI |
| 02 | [REQUIREMENTS](./02_REQUIREMENTS.md) | 機能要求・非機能要求 |
| 03 | [SYSTEM_ARCHITECTURE](./03_SYSTEM_ARCHITECTURE.md) | 全体構成図、技術スタック採用理由 |
| 04 | [CLAUDE_CODE_INTEGRATION](./04_CLAUDE_CODE_INTEGRATION.md) | Hooks連携方式、取得可否分類(最重要) |
| 05 | [EVENT_DESIGN](./05_EVENT_DESIGN.md) | 内部イベントスキーマ、イベント一覧 |
| 06 | [REALTIME_COMMUNICATION](./06_REALTIME_COMMUNICATION.md) | WebSocket設計、再接続・重複・順序保証 |
| 07 | [UI_UX_DESIGN](./07_UI_UX_DESIGN.md) | デザインコンセプト、ビジュアルトーン |
| 08 | [SCREEN_DESIGN](./08_SCREEN_DESIGN.md) | 8画面のワイヤーフレーム・遷移 |
| 09 | [CHARACTER_SYSTEM](./09_CHARACTER_SYSTEM.md) | AI社員モデル、状態遷移図 |
| 10 | [OFFICE_SYSTEM](./10_OFFICE_SYSTEM.md) | オフィスマップ、座標管理、移動キュー |
| 11 | [DATABASE_DESIGN](./11_DATABASE_DESIGN.md) | ER図、テーブル定義、DBレスMVP方針 |
| 12 | [API_DESIGN](./12_API_DESIGN.md) | REST API一覧、WSメッセージ |
| 13 | [FRONTEND_DESIGN](./13_FRONTEND_DESIGN.md) | コンポーネント構成、状態管理 |
| 14 | [BACKEND_DESIGN](./14_BACKEND_DESIGN.md) | サーバー内部構成、エラー処理 |
| 15 | [SECURITY_DESIGN](./15_SECURITY_DESIGN.md) | 脅威モデル、プライバシー配慮 |
| 16 | [TEST_PLAN](./16_TEST_PLAN.md) | テスト方針・CI |
| 17 | [MVP_PLAN](./17_MVP_PLAN.md) | MVPスコープ、タスク分解 |
| 18 | [ROADMAP](./18_ROADMAP.md) | Phase2〜4、リスク、まとめ |

## 2. 理想の可視化仕様 vs 実際に取得可能な情報(最重要な差分)

要求仕様で挙げられた理想的な可視化要素のうち、Claude Code Hooksの現行仕様で**そのまま取得できないもの**を先に明示する(詳細は`04_CLAUDE_CODE_INTEGRATION.md` 3章)。

- **現時点では取得困難(D)**: Bashの終了コード、コマンド実行のレイテンシ/タイムスタンプ(標準構成)、Plan/思考モードそのものの開始・終了、トークン使用量・コスト(CLI単体構成では取得不可)。
- **Hooksで取得可能だが追加設定が必要(C)**: トークン/コスト(OTel連携)、ファイル変更検知、設定変更検知、Worktree操作、MCP Elicitation。
- **推測可能(B)**: Sub Agentの役職(agent_typeが汎用値の場合はツール利用傾向から推測)、Planモードの間接検知(ExitPlanMode呼び出しやagent_type=Plan検知経由)。
- **直接取得可能(A)**: ツール名・対象・成功/失敗、Sub Agentの識別(agent_id/agent_type)、ユーザー入力待ち状態、セッション開始/終了。

この分類を前提に、UIは「取得できない情報を推測で断定表示しない」(例: Bash終了コードを表示せず成功/失敗の二値のみ表示、思考中は`waiting`寄りの一般的な演出に留め専用の`thinking`状態は将来検討とする)という原則で設計している。

## 3. 主要意思決定サマリ

1. **推奨技術スタック**: Next.js(TypeScript strict) + PixiJS + Zustand(フロント)/ Fastify + WebSocket(ws)(バックエンド)/ PostgreSQL + Prisma(Phase3〜の永続化)。
2. **MVP構成**: 単一エージェント・5エリア(開発デスク/調査/ターミナル/テスト/休憩)・DBレス・Hooks(command型)→Forwarder→Ingest API→WebSocket→フロントエンド。
3. **システム構成**: Claude Code Hooks → Hook Forwarder(非同期POST) → Ingest API(正規化・相関) → WebSocket Hub → Next.jsフロントエンド。GitHub連携は別Webhookチャネルとして将来合流。
4. **最大の技術的リスク**: Hookペイロードにタイムスタンプ・Bash終了コード・思考状態が含まれないこと、およびClaude Codeのバージョンアップによる仕様変化への追従。
5. **最初に実装すべき機能**: Hook Forwarder→Ingest API→WebSocket Hubの最小疎通(ダミーイベントがブラウザに届くこと)。
6. **MVP完成までの開発ステップ**: `17_MVP_PLAN.md`の Track A(Hook連携基盤)→B(リアルタイム配信基盤)→C(フロントエンド/オフィス表現)→D(品質保証)の順。

## 4. 実行ステップの記録(本設計フェーズ)

| STEP | 内容 | 状態 |
|---|---|---|
| 1 | プロジェクト全体分析・技術構成決定 | 完了(本ドキュメント3章、`03_SYSTEM_ARCHITECTURE.md`) |
| 2 | docsディレクトリ作成 | 完了 |
| 3 | 設計ドキュメント一式作成 | 完了(01〜18) |
| 4 | 設計内容の横断レビュー | 完了(用語・状態名・イベント名の整合性確認済み) |
| 5 | 不足設計の追加 | 完了(本ファイルで理想/現実ギャップを明示) |
| 6 | MVP実装タスク細分化 | 完了(`17_MVP_PLAN.md`) |
| 7 | 実装順序決定 | 完了(`17_MVP_PLAN.md` 3章) |
| 8 | README.md作成 | `README.md`参照 |

## 5. 未実装であることの明示

本フェーズでは設計のみを行い、アプリケーションコードの実装は開始していない。次のアクションは`17_MVP_PLAN.md`のTrack Aからの着手である。

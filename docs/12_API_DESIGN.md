# 12. API設計

## 1. API全体像

Ingest Server(Fastify)が公開するAPIは大きく3種類:

1. **Hook受信API**(Hook Forwarder専用、内部利用)
2. **フロントエンド向けREST API**(履歴・統計・設定など非リアルタイム情報)
3. **WebSocket API**(`06_REALTIME_COMMUNICATION.md`で定義済み)

## 2. Hook受信API

### `POST /internal/events`

Hook Forwarderからのイベント受信専用。

**リクエスト**:
```jsonc
{
  "clientEventId": "uuid-v4",
  "hookEventName": "PreToolUse",
  "payload": { /* Claude Code Hookの生JSON */ }
}
```

**レスポンス**: `202 Accepted` (常に即時応答、処理は非同期)

**認証**: `localhost`バインド前提のためMVPでは認証なし。外部公開設定時は`X-Agentia-Token`ヘッダ必須(`15_SECURITY_DESIGN.md`)。

## 3. フロントエンド向けREST API

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/projects` | プロジェクト一覧取得 |
| POST | `/api/projects` | プロジェクト登録(rootPath指定) |
| GET | `/api/projects/:projectId` | プロジェクト詳細・累計統計 |
| GET | `/api/projects/:projectId/sessions` | セッション履歴一覧(ページング: `?cursor=&limit=`) |
| GET | `/api/sessions/:sessionId` | セッション詳細(サマリ統計) |
| GET | `/api/sessions/:sessionId/events` | イベントログ取得(リプレイ/履歴閲覧用、`?afterSeq=`) |
| GET | `/api/sessions/:sessionId/replay` | ログ再生用の圧縮イベント列(タイムスタンプ間引き無し) |
| GET | `/api/stats?range=week&projectId=` | 統計集計(利用時間推移・ツール内訳・成功率) |
| GET | `/api/settings` | アプリ設定取得 |
| PUT | `/api/settings` | アプリ設定更新 |
| GET | `/api/connection/status` | Ingest Server稼働状態、Hooks設定検出状況 |
| POST | `/api/connection/setup` | `.claude/settings.json`へのHooks自動追記 |
| POST | `/api/connection/test` | ダミーイベント送出→WS到達確認用エンドポイント |

### 3.1 レスポンス例: `GET /api/projects/:projectId`

```jsonc
{
  "projectId": "proj_agentia",
  "name": "agentia",
  "rootPath": "/home/user/Agentia",
  "defaultBranch": "main",
  "stats": {
    "totalActiveTime": "18h40m",
    "sessionCount": 24,
    "editCount": 210,
    "readCount": 480,
    "bashCount": 96,
    "testCount": 40,
    "testSuccessCount": 37,
    "testFailureCount": 3,
    "subAgentCount": 58
  },
  "hooksStatus": "configured"
}
```

### 3.2 エラーレスポンス形式(共通)

```jsonc
{
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "指定されたプロジェクトが見つかりません",
    "details": null
  }
}
```

## 4. WebSocket API

`06_REALTIME_COMMUNICATION.md`参照。エンドポイント: `ws://localhost:4317/ws?projectId=<id>&lastSeq=<n>`

## 5. API設計原則

- 全レスポンスはJSON、日時はISO 8601(UTC)。
- ページングは`cursor`ベース(オフセットベースは大量イベントで非効率なため不採用)。
- `any`型を使わず、リクエスト/レスポンスは`packages/shared-types`のZodスキーマで検証・型生成する(フロント/バック共有)。
- 冪等性が求められるPOST(`/api/connection/setup`等)は複数回実行しても安全なように設計する(既存Hooks設定のマージ、重複キー追加をしない)。

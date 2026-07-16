# 04. Claude Code 連携設計

本ドキュメントは、Claude Code Hooksを中心とした実際の取得可能情報を基準に設計する。**「取得できたら理想」ではなく「実際に取得できる」ことを起点に**、UI要件とのギャップを明示する。

## 1. 採用する連携方式

```
Claude Code (hooks設定) --stdin JSON--> forwarder script (Node/sh)
                                             │ HTTP POST (fire-and-forget, async)
                                             ▼
                                  Agentia Event Ingest Server (ローカル常駐)
                                             │ 正規化 → 内部イベント化 → 順序付け
                                             ▼
                                     WebSocket Hub (per session/project)
                                             │
                                             ▼
                                Next.js フロントエンド (バーチャルオフィス)
```

- Hookタイプは `"type": "command"` を採用する(全バージョンで安定して利用可能な方式)。設定した外部URLに直接POSTする `"type": "http"` フックが利用可能な環境では、フォワーダースクリプトを省略して直接HTTP POSTする構成に切り替え可能(`06_REALTIME_COMMUNICATION.md` 8章参照)。ただし本設計はcommand方式を主経路として書く。
- フォワーダーは同梱の軽量Node.jsスクリプト(`packages/hook-forwarder`)。stdinからJSONを受け取り、`asyncTimeout`内で即時にAgentiaサーバーへPOSTし、Claude Code側の応答は`{"async": true}`即返却でブロッキングを避ける(PreToolUse等、応答待ちが実行を止めうるイベントでは特に重要)。
- Agentiaサーバーはローカル(`localhost:4317`のような専用ポート)で常駐し、Hookからのイベントを受信・正規化してWebSocketで配信する。DBなしのMVPではメモリ内リングバッファ+ファイルへの追記ログのみ。

## 2. 使用するHookイベントと設定

`.claude/settings.json`(プロジェクトスコープ推奨。ユーザースコープにも設置可能)に以下を設定する。

```json
{
  "hooks": {
    "SessionStart":  [{ "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 10 }] }],
    "SessionEnd":    [{ "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 10 }] }],
    "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "PreToolUse":    [{ "matcher": "*", "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "PostToolUse":   [{ "matcher": "*", "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "PostToolUseFailure": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "SubagentStart": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "SubagentStop":  [{ "matcher": "*", "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "Notification":  [{ "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "Stop":          [{ "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }],
    "PreCompact":    [{ "hooks": [{ "type": "command", "command": "agentia-hook", "timeout": 5 }] }]
  }
}
```

`agentia-hook` はPATHに配置された転送用CLI(`packages/hook-forwarder/bin.js` をラップ)。全てのhookで**必ず `async: true` 相当のfire-and-forgetにし、Claude Codeの実行をブロックしない**ことを設計原則とする(可視化ツールが本体の動作速度に影響してはならない)。

### 2.1 イベント⇄UI用途マッピング

| Hookイベント | 用途 | 備考 |
|---|---|---|
| `SessionStart` | メインAI社員(Claude)を出社させる。プロジェクト名/ブランチ表示初期化 | matcher: startup/resume/clear/compact |
| `SessionEnd` | 退勤演出、セッション統計の確定 | |
| `UserPromptSubmit` | `waiting`状態解除→`moving`へ。activityログに「指示受信」 | ユーザー入力そのもの(プロンプト文面)はプライバシー上、既定では要約せず「ユーザーから指示を受信」とのみ表示。設定でオンにすれば先頭N文字を表示可 |
| `PreToolUse` | ツール名から目的地/状態を決定し移動開始 | tool_name, tool_inputを使用 |
| `PostToolUse` | 到着済みなら作業完了→次イベント待ちor `idle` | tool_output(成功結果) |
| `PostToolUseFailure` | `error`状態へ遷移、警告アイコン表示 | tool_output(エラーメッセージ)をログ表示 |
| `SubagentStart` | 新しいAI社員をSpawnさせ会議室から登場 | agent_id, agent_typeで識別 |
| `SubagentStop` | 対象AI社員を完了→退勤演出 | |
| `Notification`(matcher=`permission_prompt`,`idle_prompt`,`agent_needs_input`) | `waiting`状態、「?」アイコン表示 | ユーザー操作が必要な旨をダッシュボードに強調表示 |
| `Stop` | メインエージェントの応答完了、完了演出 | |
| `PreCompact` | 「記憶を整理中」の一時演出(任意) | UI必須ではない、演出のみ |

## 3. 取得可否の分類(要件との突合)

ユーザーが要求する理想的な可視化要素ごとに、以下の4分類で整理する。

- **A. 直接取得可能**: Hookペイロードにそのまま含まれる
- **B. 推測可能**: 直接のフィールドはないが、他の情報から高い精度で導出可能
- **C. Hooksで取得可能(要追加設定)**: 標準構成では出ないが、追加のHook/設定/OTel等で取得可能
- **D. 現時点では取得困難**: 現行のHooks/公開の仕組みでは実質的に取得できない

| 理想的な可視化要素 | 分類 | 詳細 |
|---|---|---|
| どのツールが呼ばれたか(Read/Edit/Bash等) | **A** | `PreToolUse.tool_name` |
| 対象ファイルパス・コマンド文字列 | **A** | `tool_input`(Read→file_path, Edit→file_path, Bash→command 等) |
| ツール成功/失敗 | **A** | `PostToolUse` vs `PostToolUseFailure` の発火イベントで判別 |
| Bashの標準出力 | **A(一部)** | `tool_output`に**stdout/stderr結合済みテキスト**として含まれる |
| Bashの終了コード | **D** | ペイロードに終了コードフィールドは無い。`PostToolUseFailure`発火の有無で成否のみ判定し、コード自体は「不明」として扱う |
| コマンド実行時間・レイテンシ | **D(標準)/C(OTel)** | Hookペイロードにtimestamp/durationは無い。イベント受信時刻をサーバー側で付与し疑似計測するか、`OTEL_EXPORTER_OTLP_ENDPOINT`等を設定してOTelスパン(`claude_code.tool`のduration属性)を別途取り込めば正確な値を取得可能。MVPでは受信時刻ベースの疑似計測(サーバー側で受信時刻の差分)で代替し、Phase3以降でOTel連携をオプション提供 |
| Sub Agentの識別・並行数 | **A** | `agent_id`/`agent_type`が対象イベントに付与される(メインエージェントでは省略/null) |
| Sub Agentの役職(Explore/Plan等) | **A(部分)/B** | `agent_type`が付与される場合はそのまま利用。値が汎用(`general-purpose`等)の場合は、直近のツール利用傾向から役職を推測(`09_CHARACTER_SYSTEM.md` 2.2節) |
| ユーザー入力待ち状態 | **A** | `Notification`のmatcher(`permission_prompt`/`idle_prompt`/`agent_needs_input`) |
| Planモードの開始/終了そのもの | **D** | Plan/Thinking自体の開始・終了を示す専用Hookは無い。`SubagentStart`でagent_type=`Plan`のSub Agentが検知された場合、またはExitPlanModeツール呼び出しの`PreToolUse`で間接的に推測(**B**) |
| 思考中(Extended Thinking)の可視化 | **D** | 内部の思考トークン生成状態を示す公開Hookは無い。「応答待ち」の一括表現(`waiting`とは別の`thinking`表現は将来検討)にとどめる |
| トークン使用量・コスト | **C** | Hookペイロードには無い。Agent SDK経由で実行している場合は`AssistantMessage.usage`/`ResultMessage.total_cost_usd`から取得可能。CLI単体運用時はOTelメトリクス(`claude_code.token.usage`, `claude_code.cost.usage`)経由でのみ取得可能なため、**MVPでは非対応、Phase3でOTel連携を追加** |
| ユーザープロンプトの内容 | **A(取得は可能/表示は設定次第)** | `UserPromptSubmit.user_input`。プライバシー上デフォルトは非表示要約に留め、設定でオプトイン表示 |
| ファイル変更(外部エディタ等)検知 | **C** | `FileChanged`フックで対応可能(監視対象ファイルのmatcher設定が必要)。MVP範囲外 |
| 設定変更の検知 | **C** | `ConfigChange`フックで対応可能。MVP範囲外 |
| Worktree作成/削除 | **C** | `WorktreeCreate`/`WorktreeRemove`。Phase3以降、複数プロジェクト/並行開発の可視化に活用余地 |
| MCPツール経由の外部確認(Elicitation) | **C** | `Elicitation`/`ElicitationResult`。MCP多用プロジェクト向けの拡張として整理 |
| コンパクション(記憶整理)発生 | **A** | `PreCompact`/`PostCompact`。matcherで`manual`/`auto`を区別可能 |
| GitHubのcommit/push/PRイベント | **D(Hooks経由)/別チャネル** | Claude Code Hooksの対象外。GitHub Webhook(別経路)で取得する設計とする(`13章相当、将来のGitHub連携`は別ドキュメント`04`内5章、詳細は将来のPhase3設計で拡張) |

> 上記の分類は、`claude-code-guide`エージェントによる公式ドキュメント調査結果(2026年時点)に基づく。Claude Codeのバージョンアップにより仕様が変わる可能性があるため、`06_REALTIME_COMMUNICATION.md`のバージョン差異吸収層(アダプタパターン)で追従する。

## 4. Hookペイロード共通仕様(観測された実際のフィールド)

全Hookイベント共通:

```json
{
  "session_id": "string",
  "transcript_path": "string",
  "cwd": "string",
  "hook_event_name": "PreToolUse",
  "permission_mode": "string"
}
```

イベント別の主な追加フィールド:

| イベント | 追加フィールド |
|---|---|
| `PreToolUse` | `tool_name`, `tool_input` |
| `PostToolUse` | `tool_name`, `tool_input`, `tool_output` |
| `PostToolUseFailure` | `tool_name`, `tool_input`, `tool_output`(エラー内容) |
| `UserPromptSubmit` | `user_input` |
| `Notification` | `notification_type`, `message` |
| `SubagentStart` / `SubagentStop` / サブエージェント発の各種イベント | `agent_id`, `agent_type` (メインエージェントでは省略/null) |

**重要**: いずれのイベントにも**タイムスタンプフィールドは含まれない**。Agentiaのイベント正規化層(Ingest Server)が受信時刻を`timestamp`として付与する。これは「Claude Code内部での発生時刻」ではなく「Agentiaが検知した時刻」であることに留意し、`05_EVENT_DESIGN.md`ではこれを明記する。

## 5. Claude Code停止・異常終了時の扱い

| ケース | 検知方法 | UI挙動 |
|---|---|---|
| 正常終了(`Stop`受信) | Hook | 完了演出→休憩スペースへ |
| セッション終了(`SessionEnd`) | Hook | 退勤演出、セッションを「終了」として確定 |
| Claude Codeプロセスのクラッシュ・強制終了 | Hookが来ない=一定時間(既定30秒)イベント途絶を検知 | 全AI社員を`idle`から`waiting`寄りの「オフライン」状態に変更し、UIに「Claude Codeとの接続が途絶えました」バナー表示 |
| フォワーダースクリプト自体の失敗 | HTTP POST失敗をローカルログに記録 | Ingest Server側では検知不可のため、`session-start-hook`スキル等でのセットアップ検証を別途推奨(セットアップ時のヘルスチェック) |

## 6. GitHub連携(将来)の位置付け

GitHubのcommit/push/PR/merge/issue/reviewはClaude Code Hooksの対象外であるため、**別チャネル(GitHub Webhook → Agentiaサーバーの別エンドポイント)**として設計する。イベント形式は内部イベントスキーマに正規化した上で同じWebSocketハブに流し込み、フロントエンドからは「Claude Codeイベント」と区別なく扱えるようにする(`eventSource: "claude_code" | "github"`で区別)。詳細は将来のPhase3設計で拡張するが、スキーマの拡張ポイントは`05_EVENT_DESIGN.md`で先に確保する。

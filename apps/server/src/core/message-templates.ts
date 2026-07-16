import type { EventType } from "@agentia/shared-types";

/** docs/05_EVENT_DESIGN.md #6 message templates. */
export function buildMessage(
  eventType: EventType,
  params: { toolName?: string | null; target?: string | null; displayName?: string | null }
): string {
  const target = params.target ?? "";
  const toolName = params.toolName ?? "";

  switch (eventType) {
    case "session_start":
      return "セッションを開始しました";
    case "session_end":
      return "セッションを終了しました";
    case "user_prompt_submit":
      return "ユーザーから指示を受信しました";
    case "tool_use":
      if (toolName === "Read") return `${target}を読み込み中`;
      if (toolName === "Grep" || toolName === "Glob") return `「${target}」を検索中`;
      if (toolName === "Bash") return `${target}を実行中`;
      if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") return `${target}を編集中`;
      return `${toolName}を実行中`;
    case "tool_result":
      if (toolName === "Edit" || toolName === "Write" || toolName === "MultiEdit") return `${target}を編集しました`;
      if (toolName === "Bash") return `${target}の実行が完了しました`;
      return `${toolName}が完了しました`;
    case "tool_error":
      return `${toolName}の実行中にエラーが発生しました`;
    case "agent_spawn":
      return `${params.displayName ?? "新しいAI社員"}が作業を開始しました`;
    case "agent_stop":
      return `${params.displayName ?? "AI社員"}が作業を完了しました`;
    case "waiting_input":
      return "ユーザーの入力を待っています";
    case "turn_complete":
      return "応答が完了しました";
    case "context_compact":
      return "記憶を整理しています";
    case "claude_code_offline":
      return "Claude Codeとの接続が途絶えました";
    default:
      return "";
  }
}

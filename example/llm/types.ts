/**
 * LLM Provider Abstraction Types
 */

// ツール定義（プロバイダー非依存）
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

// ツール使用（プロバイダー非依存）
export interface ToolUse {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// ツール結果（プロバイダー非依存）
export interface ToolResult {
  toolUseId: string;
  content: string;
}

// コンテンツブロック
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; toolUse: ToolUse };

// 停止理由
export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";

// LLM応答（プロバイダー非依存）
export interface LLMResponse {
  content: ContentBlock[];
  stopReason: StopReason;
}

// メッセージロール
export type MessageRole = "user" | "assistant";

// 基本メッセージ（プロバイダー非依存）
export interface BaseMessage {
  role: MessageRole;
  content: string | ContentBlock[] | ToolResult[];
}

// ストリームイベント
export interface StreamEvent {
  type: "text" | "tool_use_start" | "done";
  text?: string;
  toolName?: string;
}

// ストリームコールバック
export type StreamCallback = (event: StreamEvent) => void;

// LLMプロバイダーインターフェース
export interface LLMProvider {
  readonly name: string;

  // ツール定義をプロバイダー固有の形式に変換
  formatTools(tools: ToolSchema[]): unknown[];

  // メッセージをプロバイダー固有の形式に変換
  formatMessages(messages: BaseMessage[]): unknown[];

  // ツール結果をプロバイダー固有の形式に変換
  formatToolResults(results: ToolResult[]): unknown;

  // LLM呼び出し（ストリーミング対応）
  call(
    messages: BaseMessage[],
    tools: ToolSchema[],
    onStream?: StreamCallback
  ): Promise<LLMResponse>;
}

// LLMプロバイダー設定
export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

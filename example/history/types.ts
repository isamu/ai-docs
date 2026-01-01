/**
 * Message History Types with Labels for Context Management
 */

import { BaseMessage, ContentBlock, ToolResult } from "../llm/types";

// Re-export for use in interface
export type { ToolResult };

// メッセージラベル（コンテキスト管理用）
export type MessageLabel =
  | "user_input" // ユーザーからの入力
  | "assistant_response" // アシスタントの応答
  | "tool_call" // ツール呼び出し
  | "tool_result" // ツール結果
  | "system_context" // システムコンテキスト
  | "task_completion" // タスク完了
  | "error"; // エラー

// メッセージの優先度（コンテキスト圧縮時の判断用）
export type MessagePriority = "critical" | "high" | "medium" | "low";

// メッセージメタデータ
export interface MessageMetadata {
  label: MessageLabel;
  priority: MessagePriority;
  timestamp: Date;
  toolName?: string; // ツール関連の場合のツール名
  toolUseId?: string; // ツール使用ID
  tags?: string[]; // カスタムタグ
  tokenCount?: number; // トークン数（推定）
  parentMessageId?: string; // 親メッセージID（関連付け用）
}

// ラベル付きメッセージ
export interface LabeledMessage extends BaseMessage {
  id: string;
  metadata: MessageMetadata;
}

// 履歴フィルターオプション
export interface HistoryFilterOptions {
  labels?: MessageLabel[];
  priorities?: MessagePriority[];
  tags?: string[];
  afterTimestamp?: Date;
  beforeTimestamp?: Date;
  limit?: number;
  excludeIds?: string[];
}

// 履歴サマリーオプション
export interface HistorySummaryOptions {
  maxMessages?: number;
  maxTokens?: number;
  preserveLabels?: MessageLabel[];
  preservePriorities?: MessagePriority[];
}

// メッセージ履歴インターフェース
export interface MessageHistory {
  // メッセージ追加
  addUserMessage(content: string, tags?: string[]): LabeledMessage;
  addAssistantMessage(content: ContentBlock[], tags?: string[]): LabeledMessage;
  addToolCall(toolName: string, toolUseId: string, content: ContentBlock[]): LabeledMessage;
  addToolResult(toolName: string, toolUseId: string, result: string): LabeledMessage;
  addTaskCompletion(result: string): LabeledMessage;
  addError(error: string): LabeledMessage;

  // メッセージ取得
  getAll(): readonly LabeledMessage[];
  getById(id: string): LabeledMessage | undefined;
  getByLabel(label: MessageLabel): readonly LabeledMessage[];
  filter(options: HistoryFilterOptions): readonly LabeledMessage[];

  // コンテキスト管理
  toBaseMessages(): BaseMessage[];
  getTokenCount(): number;
  summarize(options: HistorySummaryOptions): LabeledMessage[];

  // メッセージ操作
  updatePriority(id: string, priority: MessagePriority): void;
  addTag(id: string, tag: string): void;
  removeTag(id: string, tag: string): void;
  remove(id: string): void;
  clear(): void;

  // 永続化
  toJSON(): string;
  fromJSON(json: string): void;
}

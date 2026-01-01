/**
 * Message History Types
 */

import { BaseMessage, ContentBlock, ToolResult } from "../llm/types";

export type { ToolResult };

// メッセージラベル
export type MessageLabel =
  | "user_input"
  | "assistant_response"
  | "tool_result"
  | "task_completion"
  | "error";

// ラベル付きメッセージ
export interface LabeledMessage extends BaseMessage {
  id: string;
  label: MessageLabel;
  timestamp: Date;
}

// メッセージ履歴インターフェース
export interface MessageHistory {
  addUserMessage(content: string): LabeledMessage;
  addAssistantMessage(content: ContentBlock[]): LabeledMessage;
  addToolResult(toolName: string, toolUseId: string, result: string): LabeledMessage;
  addTaskCompletion(result: string): LabeledMessage;
  addError(error: string): LabeledMessage;
  getAll(): readonly LabeledMessage[];
  toBaseMessages(): BaseMessage[];
  clear(): void;
}

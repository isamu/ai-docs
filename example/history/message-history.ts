/**
 * Message History Implementation
 */

import { ContentBlock, ToolResult, BaseMessage } from "../llm/types";
import {
  MessageHistory,
  LabeledMessage,
  MessageLabel,
  MessagePriority,
  MessageMetadata,
  HistoryFilterOptions,
  HistorySummaryOptions,
} from "./types";

// デフォルト優先度マップ
const DEFAULT_PRIORITY_MAP: Record<MessageLabel, MessagePriority> = {
  user_input: "high",
  assistant_response: "medium",
  tool_call: "medium",
  tool_result: "medium",
  system_context: "critical",
  task_completion: "high",
  error: "high",
};

// トークン推定（簡易版：4文字 = 1トークン）
const CHARS_PER_TOKEN = 4;

function estimateTokens(content: string | ContentBlock[] | ToolResult[]): number {
  if (typeof content === "string") {
    return Math.ceil(content.length / CHARS_PER_TOKEN);
  }
  const text = JSON.stringify(content);
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class ConversationHistory implements MessageHistory {
  private messages: LabeledMessage[] = [];

  private createMessage(
    role: "user" | "assistant",
    content: string | ContentBlock[] | ToolResult[],
    label: MessageLabel,
    options?: {
      priority?: MessagePriority;
      toolName?: string;
      toolUseId?: string;
      tags?: string[];
      parentMessageId?: string;
    }
  ): LabeledMessage {
    const id = generateId();
    const metadata: MessageMetadata = {
      label,
      priority: options?.priority ?? DEFAULT_PRIORITY_MAP[label],
      timestamp: new Date(),
      toolName: options?.toolName,
      toolUseId: options?.toolUseId,
      tags: options?.tags ?? [],
      tokenCount: estimateTokens(content),
      parentMessageId: options?.parentMessageId,
    };

    const message: LabeledMessage = { id, role, content, metadata };
    this.messages.push(message);
    return message;
  }

  addUserMessage(content: string, tags?: string[]): LabeledMessage {
    return this.createMessage("user", content, "user_input", { tags });
  }

  addAssistantMessage(content: ContentBlock[], tags?: string[]): LabeledMessage {
    return this.createMessage("assistant", content, "assistant_response", { tags });
  }

  addToolCall(toolName: string, toolUseId: string, content: ContentBlock[]): LabeledMessage {
    return this.createMessage("assistant", content, "tool_call", {
      toolName,
      toolUseId,
    });
  }

  addToolResult(toolName: string, toolUseId: string, result: string): LabeledMessage {
    const toolResults: ToolResult[] = [{ toolUseId, content: result }];
    return this.createMessage("user", toolResults, "tool_result", {
      toolName,
      toolUseId,
    });
  }

  addTaskCompletion(result: string): LabeledMessage {
    return this.createMessage("assistant", [{ type: "text", text: result }], "task_completion", {
      priority: "high",
    });
  }

  addError(error: string): LabeledMessage {
    return this.createMessage("assistant", [{ type: "text", text: error }], "error", {
      priority: "high",
    });
  }

  getAll(): readonly LabeledMessage[] {
    return [...this.messages];
  }

  getById(id: string): LabeledMessage | undefined {
    return this.messages.find((msg) => msg.id === id);
  }

  getByLabel(label: MessageLabel): readonly LabeledMessage[] {
    return this.messages.filter((msg) => msg.metadata.label === label);
  }

  filter(options: HistoryFilterOptions): readonly LabeledMessage[] {
    return this.messages
      .filter((msg) => {
        if (options.labels && !options.labels.includes(msg.metadata.label)) {
          return false;
        }
        if (options.priorities && !options.priorities.includes(msg.metadata.priority)) {
          return false;
        }
        if (options.tags && options.tags.length > 0) {
          const hasTags = options.tags.some((tag) => msg.metadata.tags?.includes(tag));
          if (!hasTags) return false;
        }
        if (options.afterTimestamp && msg.metadata.timestamp < options.afterTimestamp) {
          return false;
        }
        if (options.beforeTimestamp && msg.metadata.timestamp > options.beforeTimestamp) {
          return false;
        }
        if (options.excludeIds && options.excludeIds.includes(msg.id)) {
          return false;
        }
        return true;
      })
      .slice(0, options.limit);
  }

  toBaseMessages(): BaseMessage[] {
    return this.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  getTokenCount(): number {
    return this.messages.reduce((sum, msg) => sum + (msg.metadata.tokenCount ?? 0), 0);
  }

  summarize(options: HistorySummaryOptions): LabeledMessage[] {
    const {
      maxMessages,
      maxTokens,
      preserveLabels = [],
      preservePriorities = ["critical", "high"],
    } = options;

    // 保持すべきメッセージを分離
    const preservedMessages = this.messages.filter(
      (msg) =>
        preserveLabels.includes(msg.metadata.label) ||
        preservePriorities.includes(msg.metadata.priority)
    );

    const otherMessages = this.messages.filter(
      (msg) =>
        !preserveLabels.includes(msg.metadata.label) &&
        !preservePriorities.includes(msg.metadata.priority)
    );

    // 制限に基づいてフィルタリング
    const result: LabeledMessage[] = [...preservedMessages];
    let currentTokens = preservedMessages.reduce(
      (sum, msg) => sum + (msg.metadata.tokenCount ?? 0),
      0
    );

    // 新しいメッセージから追加（逆順でイテレート）
    const reversedOthers = [...otherMessages].reverse();
    for (const msg of reversedOthers) {
      const msgTokens = msg.metadata.tokenCount ?? 0;

      if (maxMessages && result.length >= maxMessages) break;
      if (maxTokens && currentTokens + msgTokens > maxTokens) continue;

      result.push(msg);
      currentTokens += msgTokens;
    }

    // 時系列順に並び替え
    return result.sort((a, b) => a.metadata.timestamp.getTime() - b.metadata.timestamp.getTime());
  }

  updatePriority(id: string, priority: MessagePriority): void {
    const message = this.getById(id);
    if (message) {
      message.metadata.priority = priority;
    }
  }

  addTag(id: string, tag: string): void {
    const message = this.getById(id);
    if (message) {
      message.metadata.tags = message.metadata.tags ?? [];
      if (!message.metadata.tags.includes(tag)) {
        message.metadata.tags.push(tag);
      }
    }
  }

  removeTag(id: string, tag: string): void {
    const message = this.getById(id);
    if (message && message.metadata.tags) {
      message.metadata.tags = message.metadata.tags.filter((t) => t !== tag);
    }
  }

  remove(id: string): void {
    const index = this.messages.findIndex((msg) => msg.id === id);
    if (index !== -1) {
      this.messages.splice(index, 1);
    }
  }

  clear(): void {
    this.messages = [];
  }

  toJSON(): string {
    return JSON.stringify(this.messages, null, 2);
  }

  fromJSON(json: string): void {
    const parsed = JSON.parse(json) as LabeledMessage[];
    this.messages = parsed.map((msg) => ({
      ...msg,
      metadata: {
        ...msg.metadata,
        timestamp: new Date(msg.metadata.timestamp),
      },
    }));
  }
}

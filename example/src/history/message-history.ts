/**
 * Message History Implementation
 */

import { ContentBlock, ToolResult, BaseMessage } from "../llm/types";
import { MessageHistory, LabeledMessage, MessageLabel } from "./types";

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class ConversationHistory implements MessageHistory {
  private messages: LabeledMessage[] = [];

  private createMessage(
    role: "user" | "assistant",
    content: string | ContentBlock[] | ToolResult[],
    label: MessageLabel
  ): LabeledMessage {
    const message: LabeledMessage = {
      id: generateId(),
      role,
      content,
      label,
      timestamp: new Date(),
    };
    this.messages.push(message);
    return message;
  }

  addUserMessage(content: string): LabeledMessage {
    return this.createMessage("user", content, "user_input");
  }

  addAssistantMessage(content: ContentBlock[]): LabeledMessage {
    return this.createMessage("assistant", content, "assistant_response");
  }

  addToolResult(toolName: string, toolUseId: string, result: string): LabeledMessage {
    const toolResults: ToolResult[] = [{ toolUseId, content: result }];
    return this.createMessage("user", toolResults, "tool_result");
  }

  addTaskCompletion(result: string): LabeledMessage {
    return this.createMessage("assistant", [{ type: "text", text: result }], "task_completion");
  }

  addError(error: string): LabeledMessage {
    return this.createMessage("assistant", [{ type: "text", text: error }], "error");
  }

  getAll(): readonly LabeledMessage[] {
    return [...this.messages];
  }

  toBaseMessages(): BaseMessage[] {
    return this.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  clear(): void {
    this.messages = [];
  }
}

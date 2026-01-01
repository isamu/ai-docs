/**
 * Anthropic Claude LLM Provider
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  LLMProvider,
  LLMProviderConfig,
  ToolSchema,
  BaseMessage,
  ToolResult,
  LLMResponse,
  ContentBlock,
  StopReason,
  StreamCallback,
} from "./types";

// Anthropicの停止理由をプロバイダー非依存の形式に変換
const STOP_REASON_MAP: Record<string, StopReason> = {
  end_turn: "end_turn",
  tool_use: "tool_use",
  max_tokens: "max_tokens",
  stop_sequence: "stop_sequence",
};

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(config: LLMProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.maxTokens = config.maxTokens;
  }

  formatTools(tools: ToolSchema[]): Anthropic.Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: tool.inputSchema.type as "object",
        properties: tool.inputSchema.properties as Record<string, unknown>,
        required: tool.inputSchema.required,
      },
    }));
  }

  formatMessages(messages: BaseMessage[]): Anthropic.MessageParam[] {
    return messages.map((msg) => {
      if (typeof msg.content === "string") {
        return {
          role: msg.role,
          content: msg.content,
        };
      }

      // ContentBlock[] の場合
      if (Array.isArray(msg.content) && msg.content.length > 0) {
        const firstItem = msg.content[0];

        // ToolResult[] の場合
        if ("toolUseId" in firstItem) {
          const toolResults = msg.content as ToolResult[];
          return {
            role: msg.role as "user",
            content: toolResults.map((result) => ({
              type: "tool_result" as const,
              tool_use_id: result.toolUseId,
              content: result.content,
            })),
          };
        }

        // ContentBlock[] の場合
        const contentBlocks = msg.content as ContentBlock[];
        return {
          role: msg.role,
          content: contentBlocks.map((block) => {
            if (block.type === "text") {
              return { type: "text" as const, text: block.text };
            }
            return {
              type: "tool_use" as const,
              id: block.toolUse.id,
              name: block.toolUse.name,
              input: block.toolUse.input,
            };
          }),
        };
      }

      return { role: msg.role, content: "" };
    });
  }

  formatToolResults(results: ToolResult[]): Anthropic.ToolResultBlockParam[] {
    return results.map((result) => ({
      type: "tool_result",
      tool_use_id: result.toolUseId,
      content: result.content,
    }));
  }

  async call(
    messages: BaseMessage[],
    tools: ToolSchema[],
    onStream?: StreamCallback,
    systemPrompt?: string
  ): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(messages);
    const formattedTools = this.formatTools(tools);

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: formattedMessages,
      tools: formattedTools,
      ...(systemPrompt && { system: systemPrompt }),
    });

    if (onStream) {
      stream.on("text", (text: string): void => {
        onStream({ type: "text", text });
      });

      stream.on("contentBlock", (block: Anthropic.ContentBlock): void => {
        if (block.type === "tool_use") {
          onStream({ type: "tool_use_start", toolName: block.name });
        }
      });
    }

    const response = await stream.finalMessage();

    if (onStream) {
      onStream({ type: "done" });
    }

    return this.convertResponse(response);
  }

  private convertResponse(response: Anthropic.Message): LLMResponse {
    const content: ContentBlock[] = response.content.map((block) => {
      if (block.type === "text") {
        return { type: "text" as const, text: block.text };
      }
      return {
        type: "tool_use" as const,
        toolUse: {
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        },
      };
    });

    const stopReason = STOP_REASON_MAP[response.stop_reason ?? "end_turn"] ?? "end_turn";

    return { content, stopReason };
  }
}

import Anthropic from "@anthropic-ai/sdk";

export interface ToolDefinition {
  definition: Anthropic.Tool;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

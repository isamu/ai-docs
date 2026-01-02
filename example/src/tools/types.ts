import { ToolSchema } from "../llm/types";
import { AgentContext } from "../context";

export interface ToolDefinition {
  definition: ToolSchema;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

// コンテキストを必要とするツール
export interface ContextAwareToolDefinition {
  definition: ToolSchema;
  execute: (input: Record<string, unknown>, context: AgentContext) => Promise<string>;
}

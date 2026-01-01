import { ToolSchema } from "../llm/types";

export interface ToolDefinition {
  definition: ToolSchema;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

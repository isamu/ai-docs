import { ToolSchema } from "../llm/types";
import { ToolDefinition } from "./types";
import { readFileTool } from "./read_file";
import { writeFileTool } from "./write_file";
import { listFilesTool } from "./list_files";
import { calculatorTool } from "./calculator";
import { getCurrentTimeTool } from "./get_current_time";
import { attemptCompletionTool } from "./attempt_completion";

const ERROR_UNKNOWN_TOOL = (toolName: string): string => `エラー: 不明なツール '${toolName}'`;
const ERROR_GENERIC = (message: string): string => `エラー: ${message}`;

// 全ツールを登録
const toolRegistry: Record<string, ToolDefinition> = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_files: listFilesTool,
  calculator: calculatorTool,
  get_current_time: getCurrentTimeTool,
  attempt_completion: attemptCompletionTool,
};

/**
 * ツール定義の配列を取得
 */
export function getToolDefinitions(): ToolSchema[] {
  return Object.values(toolRegistry).map((tool) => tool.definition);
}

/**
 * ツールを実行
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  console.log(`   入力: ${JSON.stringify(input)}`);

  const tool = toolRegistry[toolName];
  if (!tool) {
    return ERROR_UNKNOWN_TOOL(toolName);
  }

  try {
    return await tool.execute(input);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   エラー: ${errorMessage}`);
    return ERROR_GENERIC(errorMessage);
  }
}

/**
 * ツール名の一覧を取得
 */
export function getToolNames(): string[] {
  return Object.keys(toolRegistry);
}

export type { ToolDefinition } from "./types";

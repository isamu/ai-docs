import { ToolSchema } from "../llm/types";
import { ToolDefinition, ContextAwareToolDefinition } from "./types";
import { AgentContext } from "../context";
import { readFileTool } from "./read_file";
import { writeFileTool } from "./write_file";
import { listFilesTool } from "./list_files";
import { calculatorTool } from "./calculator";
import { getCurrentTimeTool } from "./get_current_time";
import { attemptCompletionTool } from "./attempt_completion";
import { sessionTools } from "./session";

const ERROR_UNKNOWN_TOOL = (toolName: string): string => `エラー: 不明なツール '${toolName}'`;
const ERROR_GENERIC = (message: string): string => `エラー: ${message}`;

// 通常ツールを登録
const toolRegistry: Record<string, ToolDefinition> = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_files: listFilesTool,
  calculator: calculatorTool,
  get_current_time: getCurrentTimeTool,
  attempt_completion: attemptCompletionTool,
};

// コンテキスト対応ツールを登録
const contextAwareToolRegistry: Record<string, ContextAwareToolDefinition> = {};
sessionTools.forEach((tool) => {
  contextAwareToolRegistry[tool.definition.name] = tool;
});

/**
 * ツール定義の配列を取得
 */
export function getToolDefinitions(): ToolSchema[] {
  const regularTools = Object.values(toolRegistry).map((tool) => tool.definition);
  const contextAwareTools = Object.values(contextAwareToolRegistry).map((tool) => tool.definition);
  return [...regularTools, ...contextAwareTools];
}

/**
 * 通常ツールの定義のみ取得
 */
export function getRegularToolDefinitions(): ToolSchema[] {
  return Object.values(toolRegistry).map((tool) => tool.definition);
}

/**
 * コンテキスト対応ツールの定義のみ取得
 */
export function getContextAwareToolDefinitions(): ToolSchema[] {
  return Object.values(contextAwareToolRegistry).map((tool) => tool.definition);
}

/**
 * ツールを実行
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context?: AgentContext
): Promise<string> {
  console.log(`   入力: ${JSON.stringify(input)}`);

  // まず通常ツールを確認
  const tool = toolRegistry[toolName];
  if (tool) {
    try {
      return await tool.execute(input);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   エラー: ${errorMessage}`);
      return ERROR_GENERIC(errorMessage);
    }
  }

  // コンテキスト対応ツールを確認
  const contextAwareTool = contextAwareToolRegistry[toolName];
  if (contextAwareTool) {
    if (!context) {
      return ERROR_GENERIC(`ツール '${toolName}' の実行にはコンテキストが必要です`);
    }
    try {
      return await contextAwareTool.execute(input, context);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   エラー: ${errorMessage}`);
      return ERROR_GENERIC(errorMessage);
    }
  }

  return ERROR_UNKNOWN_TOOL(toolName);
}

/**
 * ツール名の一覧を取得
 */
export function getToolNames(): string[] {
  return [...Object.keys(toolRegistry), ...Object.keys(contextAwareToolRegistry)];
}

/**
 * ツールがコンテキスト対応かどうかを判定
 */
export function isContextAwareTool(toolName: string): boolean {
  return toolName in contextAwareToolRegistry;
}

export type { ToolDefinition } from "./types";

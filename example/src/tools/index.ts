/**
 * Tools Registry
 * ツールの登録と実行
 */

import { ToolSchema } from "../llm/types";
import { ToolDefinition } from "./types";
import { AgentContext } from "../context";
import { getTaskConfigManager } from "../tasks";

// コアツールのインポート
import { readFileTool } from "./read_file";
import { writeFileTool } from "./write_file";
import { listFilesTool } from "./list_files";
import { calculatorTool } from "./calculator";
import { getCurrentTimeTool } from "./get_current_time";
import { attemptCompletionTool } from "./attempt_completion";
import { shellTool } from "./shell";
import { httpFetchTool } from "./http_fetch";
import { sessionTools } from "./session";

const ERROR_UNKNOWN_TOOL = (toolName: string): string => `エラー: 不明なツール '${toolName}'`;
const ERROR_GENERIC = (message: string): string => `エラー: ${message}`;

// コアツールを登録
const coreToolRegistry: Record<string, ToolDefinition> = {
  read_file: readFileTool,
  write_file: writeFileTool,
  list_files: listFilesTool,
  calculator: calculatorTool,
  get_current_time: getCurrentTimeTool,
  attempt_completion: attemptCompletionTool,
  shell: shellTool,
  http_fetch: httpFetchTool,
};

// セッション管理ツールを登録
const sessionToolRegistry: Record<string, ToolDefinition> = {};
sessionTools.forEach((tool) => {
  sessionToolRegistry[tool.definition.name] = tool;
});

/**
 * 全ツール定義を取得（タスク固有ツールを含む）
 */
export function getToolDefinitions(): ToolSchema[] {
  const coreTools = Object.values(coreToolRegistry).map((tool) => tool.definition);
  const sessionToolDefs = Object.values(sessionToolRegistry).map((tool) => tool.definition);

  // タスク固有ツールを追加
  const taskConfigManager = getTaskConfigManager();
  const taskToolDefs: ToolSchema[] = [];
  for (const taskName of taskConfigManager.getTaskNames()) {
    const tools = taskConfigManager.getTaskTools(taskName);
    for (const tool of tools) {
      // 重複を避ける
      if (!taskToolDefs.some((t) => t.name === tool.definition.name)) {
        taskToolDefs.push(tool.definition);
      }
    }
  }

  return [...coreTools, ...sessionToolDefs, ...taskToolDefs];
}

/**
 * コアツールの定義のみ取得
 */
export function getCoreToolDefinitions(): ToolSchema[] {
  return Object.values(coreToolRegistry).map((tool) => tool.definition);
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

  // コアツールを確認
  const coreTool = coreToolRegistry[toolName];
  if (coreTool) {
    try {
      return await coreTool.execute(input, context);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   エラー: ${errorMessage}`);
      return ERROR_GENERIC(errorMessage);
    }
  }

  // セッションツールを確認
  const sessionTool = sessionToolRegistry[toolName];
  if (sessionTool) {
    if (!context) {
      return ERROR_GENERIC(`ツール '${toolName}' の実行にはコンテキストが必要です`);
    }
    try {
      return await sessionTool.execute(input, context);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`   エラー: ${errorMessage}`);
      return ERROR_GENERIC(errorMessage);
    }
  }

  // タスク固有ツールを確認
  const taskConfigManager = getTaskConfigManager();
  for (const taskName of taskConfigManager.getTaskNames()) {
    const tools = taskConfigManager.getTaskTools(taskName);
    const taskTool = tools.find((t) => t.definition.name === toolName);
    if (taskTool) {
      try {
        return await taskTool.execute(input, context);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`   エラー: ${errorMessage}`);
        return ERROR_GENERIC(errorMessage);
      }
    }
  }

  return ERROR_UNKNOWN_TOOL(toolName);
}

/**
 * ツール名の一覧を取得
 */
export function getToolNames(): string[] {
  const coreNames = Object.keys(coreToolRegistry);
  const sessionNames = Object.keys(sessionToolRegistry);

  const taskConfigManager = getTaskConfigManager();
  const taskNames: string[] = [];
  for (const taskName of taskConfigManager.getTaskNames()) {
    const tools = taskConfigManager.getTaskTools(taskName);
    for (const tool of tools) {
      if (!taskNames.includes(tool.definition.name)) {
        taskNames.push(tool.definition.name);
      }
    }
  }

  return [...coreNames, ...sessionNames, ...taskNames];
}

/**
 * ツールがコンテキストを必要とするかどうかを判定
 */
export function isContextRequiredTool(toolName: string): boolean {
  // セッションツールはコンテキスト必須
  if (toolName in sessionToolRegistry) {
    return true;
  }
  // タスク固有ツールもコンテキスト必須
  const taskConfigManager = getTaskConfigManager();
  for (const taskName of taskConfigManager.getTaskNames()) {
    const tools = taskConfigManager.getTaskTools(taskName);
    if (tools.some((t) => t.definition.name === toolName)) {
      return true;
    }
  }
  return false;
}

export type { ToolDefinition } from "./types";

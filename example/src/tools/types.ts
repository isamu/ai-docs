/**
 * Tool Definition Types
 * ツール定義の共通インターフェース
 */

import { ToolSchema } from "../llm/types";
import { AgentContext } from "../context";

/**
 * ツール定義（統一インターフェース）
 *
 * @example シンプルなツール（コンテキスト不要）
 * ```ts
 * export const calculatorTool: ToolDefinition = {
 *   definition: {
 *     name: "calculator",
 *     description: "数式を計算します",
 *     inputSchema: {
 *       type: "object",
 *       properties: {
 *         expression: { type: "string", description: "計算式" }
 *       },
 *       required: ["expression"]
 *     }
 *   },
 *   execute: async (input) => {
 *     return String(eval(input.expression as string));
 *   }
 * };
 * ```
 *
 * @example コンテキスト対応ツール（セッション情報が必要）
 * ```ts
 * export const sessionTool: ToolDefinition = {
 *   definition: { ... },
 *   execute: async (input, context) => {
 *     const session = context?.getActiveSession();
 *     // ...
 *   }
 * };
 * ```
 */
export interface ToolDefinition {
  /** ツールのスキーマ定義（LLMに渡される） */
  definition: ToolSchema;

  /**
   * ツールの実行関数
   * @param input - LLMからの入力パラメータ
   * @param context - AgentContext（オプション）。セッション情報等が必要な場合に使用
   * @returns 実行結果の文字列
   */
  execute: (
    input: Record<string, unknown>,
    context?: AgentContext
  ) => Promise<string>;
}

/**
 * ツール定義のヘルパー関数
 * 型推論を効かせるために使用
 */
export function defineTool(tool: ToolDefinition): ToolDefinition {
  return tool;
}

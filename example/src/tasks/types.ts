/**
 * Task Configuration Types
 * タスク固有の設定を定義
 */

import { AgentMode } from "../context";
import { ToolDefinition } from "../tools/types";

/**
 * タスクフェーズ定義
 *
 * @example
 * ```ts
 * const planningPhase: TaskPhase = {
 *   name: "planning",
 *   description: "要件のヒアリングと計画",
 *   goal: "実装計画の策定",
 *   systemPrompt: "ユーザーの要望を詳しく聞いてください",
 *   requiresApproval: true,
 *   approvalPrompt: "この計画で進めてよろしいですか？",
 *   enabledTools: ["read_file", "list_files"]
 * };
 * ```
 */
export interface TaskPhase {
  /** フェーズ名（一意） */
  name: string;
  /** フェーズの説明 */
  description: string;
  /** このフェーズのゴール */
  goal: string;
  /** このフェーズ用の追加システムプロンプト */
  systemPrompt?: string;
  /** 次のフェーズに進む前にユーザー確認が必要か */
  requiresApproval?: boolean;
  /** 確認時のプロンプト */
  approvalPrompt?: string;
  /** このフェーズで有効なツール名（上書き） */
  enabledTools?: string[];
}

/**
 * タスク設定
 *
 * @example
 * ```ts
 * const myTask: TaskConfig = {
 *   name: "my-task",
 *   displayName: "マイタスク",
 *   description: "カスタムタスクの説明",
 *   goal: "タスクのゴール",
 *   defaultMode: "implementation",
 *   systemPrompt: "あなたは専門家です...",
 *   enabledCoreTools: ["read_file", "write_file"],
 *   enabledTaskTools: ["my_custom_tool"],
 *   phases: [...],
 *   completionCriteria: ["条件1", "条件2"]
 * };
 * ```
 */
export interface TaskConfig {
  /** タスク名（一意、start_sessionで使用） */
  name: string;
  /** 表示名 */
  displayName: string;
  /** タスクの説明 */
  description: string;
  /** タスクのゴール */
  goal: string;

  /** デフォルトのエージェントモード */
  defaultMode: AgentMode;

  /** タスク用のシステムプロンプト */
  systemPrompt: string;

  /** 有効なコアツール名 */
  enabledCoreTools: string[];
  /** 有効なタスク固有ツール名 */
  enabledTaskTools: string[];

  /** フェーズ定義（オプション） */
  phases?: TaskPhase[];

  /** 完了条件のリスト */
  completionCriteria: string[];
}

/**
 * タスクモジュール（タスク定義 + ツール）
 *
 * @example
 * ```ts
 * // src/tasks/definitions/my-task.ts
 * export const myTaskModule: TaskModule = {
 *   config: {
 *     name: "my-task",
 *     displayName: "マイタスク",
 *     // ...
 *   },
 *   tools: [myCustomTool1, myCustomTool2]
 * };
 * ```
 */
export interface TaskModule {
  /** タスク設定 */
  config: TaskConfig;
  /** このタスク用のカスタムツール */
  tools: ToolDefinition[];
}

/**
 * タスク設定ファイルの形式（JSON設定用）
 */
export interface TaskConfigFile {
  version: string;
  tasks: Record<string, TaskConfig>;
}

/**
 * 利用可能なコアツール一覧
 */
export const CORE_TOOLS = [
  "read_file",
  "write_file",
  "list_files",
  "shell",
  "http_fetch",
  "calculator",
  "get_current_time",
  "attempt_completion",
] as const;

export type CoreToolName = (typeof CORE_TOOLS)[number];

/**
 * セッション状態（フェーズ管理用）
 */
export interface TaskSessionState {
  /** タスクの説明 */
  description: string;
  /** 現在のフェーズ名 */
  currentPhase?: string;
  /** フェーズインデックス */
  phaseIndex: number;
  /** フェーズ履歴 */
  phaseHistory: string[];
  /** 生成されたファイルパス */
  artifacts: string[];
}

/**
 * タスクモジュールを定義するヘルパー関数
 */
export function defineTask(module: TaskModule): TaskModule {
  return module;
}

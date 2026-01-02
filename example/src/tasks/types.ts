/**
 * Task Configuration Types
 * タスク固有の設定を定義
 */

import { AgentMode } from "../context";

/**
 * タスクフェーズ定義
 */
export interface TaskPhase {
  name: string;
  description: string;
  goal: string;
  systemPrompt?: string; // このフェーズ用の追加プロンプト
  requiresApproval?: boolean; // ユーザー確認が必要か
  approvalPrompt?: string; // 確認時のプロンプト
  enabledTools?: string[]; // このフェーズで有効なツール（上書き）
}

/**
 * タスク設定
 */
export interface TaskConfig {
  name: string;
  displayName: string;
  description: string;
  goal: string;

  // モード設定
  defaultMode: AgentMode;

  // システムプロンプト（モードのプロンプトに追加）
  systemPrompt: string;

  // 有効なツール
  enabledCoreTools: string[]; // コアツールから選択
  enabledTaskTools: string[]; // タスク固有ツールから選択

  // フェーズ定義（オプション）
  phases?: TaskPhase[];

  // 完了条件
  completionCriteria: string[];
}

/**
 * タスク設定ファイルの形式
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
  description: string;
  currentPhase?: string;
  phaseIndex: number;
  phaseHistory: string[];
  artifacts: string[]; // 生成されたファイルパス
}

/**
 * Agent Mode Types - Inspired by Roo Code / Claude Code
 */

// エージェントモード
export type AgentMode =
  | "exploration" // コードベース探索・理解
  | "planning" // 実装計画の作成
  | "implementation" // コード実装
  | "review" // レビュー・テスト
  | "conversation"; // 通常の会話

// モード設定
export interface ModeConfig {
  name: AgentMode;
  displayName: string;
  description: string;
  systemPrompt: string;
  enabledTools: string[];
  allowFileWrite: boolean;
  maxIterations: number;
}

// デフォルトのモード設定
export const MODE_CONFIGS: Record<AgentMode, ModeConfig> = {
  exploration: {
    name: "exploration",
    displayName: "Exploration",
    description: "コードベースを探索し、構造を理解します",
    systemPrompt: `あなたはコードベースを探索・理解するエージェントです。
- ファイルを読み、コードの構造を把握してください
- 質問に答えるために必要な情報を収集してください
- コードの変更は行わないでください`,
    enabledTools: ["read_file", "list_files", "get_current_time"],
    allowFileWrite: false,
    maxIterations: 50,
  },

  planning: {
    name: "planning",
    displayName: "Planning",
    description: "実装計画を作成します",
    systemPrompt: `あなたは実装計画を作成するエージェントです。
- タスクを分析し、実装手順を計画してください
- 必要なファイルや変更箇所を特定してください
- 実際のコード変更は行わず、計画のみを作成してください`,
    enabledTools: ["read_file", "list_files", "get_current_time", "calculator"],
    allowFileWrite: false,
    maxIterations: 30,
  },

  implementation: {
    name: "implementation",
    displayName: "Implementation",
    description: "コードを実装・変更します",
    systemPrompt: `あなたはコードを実装するエージェントです。
- 計画に基づいてコードを実装してください
- ファイルの読み書きが可能です
- 変更は慎重に行い、既存のコードスタイルに従ってください`,
    enabledTools: ["read_file", "write_file", "list_files", "get_current_time", "calculator"],
    allowFileWrite: true,
    maxIterations: 25,
  },

  review: {
    name: "review",
    displayName: "Review",
    description: "変更をレビューし、テストを実行します",
    systemPrompt: `あなたはコードレビューを行うエージェントです。
- 変更内容を確認してください
- 問題点や改善点を指摘してください
- テストの実行結果を確認してください`,
    enabledTools: ["read_file", "list_files", "get_current_time"],
    allowFileWrite: false,
    maxIterations: 20,
  },

  conversation: {
    name: "conversation",
    displayName: "Conversation",
    description: "通常の会話モード",
    systemPrompt: `あなたはAIアシスタントです。ユーザーの質問に答え、タスクを支援します。

タスク管理:
- ユーザーがタスク（MulmoScript作成、コード生成等）を依頼した場合は start_session でセッションを開始
- 「一旦やめて」「後でやる」と言われたら suspend_session で中断
- 「さっきの続き」と言われたら resume_session で再開
- タスク完了時は complete_session で終了
- list_sessions でセッション状態を確認可能`,
    enabledTools: [
      "read_file",
      "write_file",
      "list_files",
      "calculator",
      "get_current_time",
      "attempt_completion",
      "start_session",
      "suspend_session",
      "resume_session",
      "complete_session",
      "list_sessions",
    ],
    allowFileWrite: true,
    maxIterations: 25,
  },
};

// コンテキスト設定
export interface ContextConfig {
  initialMode?: AgentMode;
}

export const DEFAULT_MODE: AgentMode = "conversation";

// ========== モードスタック ==========

export interface ModeStackEntry {
  mode: AgentMode;
  enteredAt: Date;
  sessionId?: string; // このモードに紐づくタスクセッション
}

// ========== タスクセッション ==========

export type SessionStatus = "active" | "suspended" | "completed" | "discarded";

export interface TaskSession {
  id: string;
  taskType: string; // "mulmo", "codegen", etc.
  status: SessionStatus;
  state: unknown; // タスク固有の状態
  createdAt: Date;
  updatedAt: Date;
  summary?: string; // 完了時のサマリー
}

// セッション完了時のオプション
export interface SessionCompleteOptions {
  summary?: string; // カスタムサマリー（省略時は自動生成）
}

// ========== 状態表示 ==========

export interface ContextStatus {
  currentMode: AgentMode;
  modeStackDepth: number;
  activeTask: { id: string; type: string; status: SessionStatus } | null;
  suspendedTasks: Array<{ id: string; type: string; summary: string }>;
}

/**
 * Agent Context - Manages Mode, Sessions, and History
 * Each session has its own history, with summaries merged to base history
 */

import { ConversationHistory } from "../history";
import { ContentBlock, ToolSchema } from "../llm";
import { getToolDefinitions } from "../tools";
import {
  AgentMode,
  ModeConfig,
  ContextConfig,
  MODE_CONFIGS,
  DEFAULT_MODE,
  ContextStatus,
  TaskSession,
  ModeStackEntry,
  SessionCompleteOptions,
} from "./types";
import { ModeManager } from "./mode-manager";
import { SessionManager } from "./session-manager";
import { getTaskConfigManager, TaskSessionState } from "../tasks";

export class AgentContext {
  readonly baseHistory: ConversationHistory;
  readonly modeManager: ModeManager;
  readonly sessionManager: SessionManager;

  // ターン中の履歴ロック（セッション切り替えがあっても同じ履歴を使用）
  private turnLockedSessionId: string | null | undefined = undefined;

  constructor(config: ContextConfig = {}) {
    this.baseHistory = new ConversationHistory();
    this.modeManager = new ModeManager(config.initialMode ?? DEFAULT_MODE);
    this.sessionManager = new SessionManager();
  }

  // ========== Turn Management ==========

  /**
   * ターン開始時に呼び出し - 現在の履歴をロック
   * セッションツールが実行されても、このターン中は同じ履歴を使用
   */
  beginTurn(): void {
    this.turnLockedSessionId = this.sessionManager.getActiveSession()?.id ?? null;
  }

  /**
   * ターン終了時に呼び出し - 履歴ロックを解除
   * 次のターンでは新しいセッションの履歴を使用
   */
  endTurn(): void {
    this.turnLockedSessionId = undefined;
  }

  /**
   * ターン中かどうかを確認
   */
  isInTurn(): boolean {
    return this.turnLockedSessionId !== undefined;
  }

  // ========== Mode Management ==========

  getMode(): AgentMode {
    return this.modeManager.getCurrentMode();
  }

  getModeConfig(): ModeConfig {
    return MODE_CONFIGS[this.getMode()];
  }

  /**
   * システムプロンプトを取得
   * タスクがアクティブな場合はタスク設定を使用
   */
  getSystemPrompt(): string {
    const session = this.sessionManager.getActiveSession();

    // タスクがアクティブな場合はタスク設定のシステムプロンプトを使用
    if (session) {
      const configManager = getTaskConfigManager();
      const state = session.state as TaskSessionState | undefined;
      const currentPhase = state?.currentPhase;

      const taskPrompt = configManager.getSystemPrompt(session.taskType, currentPhase);
      if (taskPrompt) {
        return taskPrompt;
      }
    }

    // フォールバック: モード設定のプロンプト
    return this.getModeConfig().systemPrompt;
  }

  /**
   * モードをスタックにpush
   */
  pushMode(mode: AgentMode, sessionId?: string): ModeStackEntry {
    return this.modeManager.pushMode(mode, sessionId);
  }

  /**
   * モードをスタックからpop（前のモードに戻る）
   */
  popMode(): ModeStackEntry | undefined {
    return this.modeManager.popMode();
  }

  /**
   * モードスタックを取得
   */
  getModeStack(): readonly ModeStackEntry[] {
    return this.modeManager.getStack();
  }

  // ========== Session Management ==========

  /**
   * 新しいタスクセッションを開始
   */
  startSession(taskType: string, mode: AgentMode, initialState: unknown = {}): TaskSession {
    const session = this.sessionManager.startSession(taskType, initialState);
    this.modeManager.pushMode(mode, session.id);
    return session;
  }

  /**
   * 現在のセッションを中断
   */
  suspendCurrentSession(): void {
    const session = this.sessionManager.getActiveSession();
    if (!session) {
      throw new Error("No active session to suspend");
    }

    this.sessionManager.suspendSession(session.id);
    this.modeManager.popToBase();
  }

  /**
   * セッションを再開
   */
  resumeSession(sessionId: string, mode: AgentMode): TaskSession {
    const session = this.sessionManager.resumeSession(sessionId);
    this.modeManager.pushMode(mode, session.id);
    return session;
  }

  /**
   * 現在のセッションを完了（サマリーをbaseHistoryに追加）
   */
  completeCurrentSession(options: SessionCompleteOptions = {}): string {
    const session = this.sessionManager.getActiveSession();
    if (!session) {
      throw new Error("No active session to complete");
    }

    const summary = this.sessionManager.completeSession(session.id, options);

    // サマリーをbaseHistoryに追加
    this.baseHistory.addTaskCompletion(`[Session ${session.id}] ${summary}`);

    this.modeManager.popToBase();
    return summary;
  }

  /**
   * セッションを破棄
   */
  discardSession(sessionId: string): void {
    this.sessionManager.discardSession(sessionId);
    if (this.modeManager.hasSession(sessionId)) {
      this.modeManager.popToBase();
    }
  }

  /**
   * アクティブなセッションを取得
   */
  getActiveSession(): TaskSession | null {
    return this.sessionManager.getActiveSession();
  }

  /**
   * 中断中のセッション一覧を取得
   */
  getSuspendedSessions(): TaskSession[] {
    return this.sessionManager.getSuspendedSessions();
  }

  /**
   * セッションの状態を更新
   */
  updateSessionState(state: unknown): void {
    const session = this.sessionManager.getActiveSession();
    if (!session) {
      throw new Error("No active session to update");
    }
    this.sessionManager.updateSessionState(session.id, state);
  }

  // ========== History Management ==========

  /**
   * 現在のアクティブな履歴を取得
   * ターン中はロックされた履歴、それ以外はアクティブセッションの履歴
   */
  getCurrentHistory(): ConversationHistory {
    // ターン中は開始時の履歴を維持（セッション切り替えの影響を受けない）
    if (this.turnLockedSessionId !== undefined) {
      if (this.turnLockedSessionId === null) {
        return this.baseHistory;
      }
      return this.sessionManager.getSessionHistory(this.turnLockedSessionId) ?? this.baseHistory;
    }

    // ターン外は現在のアクティブセッションの履歴
    const sessionHistory = this.sessionManager.getActiveSessionHistory();
    return sessionHistory ?? this.baseHistory;
  }

  /**
   * セッションの履歴を取得
   */
  getSessionHistory(sessionId: string): ConversationHistory | undefined {
    return this.sessionManager.getSessionHistory(sessionId);
  }

  addUserMessage(content: string) {
    return this.getCurrentHistory().addUserMessage(content);
  }

  addAssistantMessage(content: ContentBlock[]) {
    return this.getCurrentHistory().addAssistantMessage(content);
  }

  addToolResult(toolName: string, toolUseId: string, result: string) {
    return this.getCurrentHistory().addToolResult(toolName, toolUseId, result);
  }

  addTaskCompletion(result: string) {
    return this.getCurrentHistory().addTaskCompletion(result);
  }

  addError(error: string) {
    return this.getCurrentHistory().addError(error);
  }

  /**
   * 現在のアクティブな履歴のメッセージを取得
   */
  getMessages() {
    return this.getCurrentHistory().getAll();
  }

  /**
   * 現在のアクティブな履歴をLLM用に変換
   */
  toBaseMessages() {
    return this.getCurrentHistory().toBaseMessages();
  }

  // ========== Status ==========

  /**
   * 現在の状態サマリーを取得
   */
  getStatus(): ContextStatus {
    const activeSession = this.sessionManager.getActiveSession();
    const suspendedSessions = this.sessionManager.getSuspendedSessions();

    return {
      currentMode: this.getMode(),
      modeStackDepth: this.modeManager.getDepth(),
      activeTask: activeSession
        ? {
            id: activeSession.id,
            type: activeSession.taskType,
            status: activeSession.status,
          }
        : null,
      suspendedTasks: suspendedSessions.map((s) => ({
        id: s.id,
        type: s.taskType,
        summary: `${s.taskType} - ${s.status}`,
      })),
    };
  }

  // ========== Tool Management ==========

  /**
   * 有効なツールを取得
   * タスクがアクティブな場合はタスク設定を使用
   */
  getEnabledTools(): ToolSchema[] {
    const enabledToolNames = this.getEnabledToolNames();
    const allTools = getToolDefinitions();
    return allTools.filter((tool) => enabledToolNames.includes(tool.name));
  }

  /**
   * 有効なツール名一覧を取得
   */
  private getEnabledToolNames(): string[] {
    const session = this.sessionManager.getActiveSession();

    // タスクがアクティブな場合はタスク設定を使用
    if (session) {
      const configManager = getTaskConfigManager();
      const state = session.state as TaskSessionState | undefined;
      const currentPhase = state?.currentPhase;

      // フェーズ固有またはタスクのツール設定を取得
      const taskTools = configManager.getEnabledTools(session.taskType, currentPhase);
      if (taskTools.length > 0) {
        return taskTools;
      }
    }

    // フォールバック: モード設定のツール
    return this.getModeConfig().enabledTools;
  }

  isToolEnabled(toolName: string): boolean {
    return this.getEnabledToolNames().includes(toolName);
  }

  // ========== Constraints ==========

  canWriteFiles(): boolean {
    return this.getModeConfig().allowFileWrite;
  }

  getMaxIterations(): number {
    return this.getModeConfig().maxIterations;
  }

  // ========== Reset ==========

  reset(): void {
    this.baseHistory.clear();
    this.modeManager.reset(DEFAULT_MODE);
    this.sessionManager.reset();
  }
}

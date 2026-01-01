/**
 * Session Manager - Manages task sessions with suspend/resume capabilities
 * Each session has its own conversation history
 */

import { ConversationHistory } from "../history";
import { TaskSession, SessionCompleteOptions } from "./types";

function generateSessionId(taskType: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${taskType}-${timestamp}-${random}`;
}

export class SessionManager {
  private sessions: Map<string, TaskSession> = new Map();
  private sessionHistories: Map<string, ConversationHistory> = new Map();
  private activeSessionId: string | null = null;

  /**
   * 新しいセッションを開始
   */
  startSession(taskType: string, initialState: unknown = {}): TaskSession {
    // 既にアクティブなセッションがある場合は中断
    if (this.activeSessionId) {
      this.suspendSession(this.activeSessionId);
    }

    const session: TaskSession = {
      id: generateSessionId(taskType),
      taskType,
      status: "active",
      state: initialState,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    this.sessionHistories.set(session.id, new ConversationHistory());
    this.activeSessionId = session.id;

    return session;
  }

  /**
   * セッションを中断
   */
  suspendSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status !== "active") {
      throw new Error(`Cannot suspend session with status: ${session.status}`);
    }

    session.status = "suspended";
    session.updatedAt = new Date();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  /**
   * セッションを再開
   */
  resumeSession(sessionId: string): TaskSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status !== "suspended") {
      throw new Error(`Cannot resume session with status: ${session.status}`);
    }

    // 既にアクティブなセッションがある場合は中断
    if (this.activeSessionId) {
      this.suspendSession(this.activeSessionId);
    }

    session.status = "active";
    session.updatedAt = new Date();
    this.activeSessionId = sessionId;

    return session;
  }

  /**
   * セッションを完了
   */
  completeSession(sessionId: string, options: SessionCompleteOptions = {}): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status !== "active") {
      throw new Error(`Cannot complete session with status: ${session.status}`);
    }

    // サマリーを生成
    const summary = options.summary ?? this.generateSummary(sessionId);
    session.summary = summary;
    session.status = "completed";
    session.updatedAt = new Date();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }

    return summary;
  }

  /**
   * セッションを破棄
   */
  discardSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status === "completed" || session.status === "discarded") {
      throw new Error(`Cannot discard session with status: ${session.status}`);
    }

    session.status = "discarded";
    session.updatedAt = new Date();

    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
  }

  /**
   * セッションの状態を更新
   */
  updateSessionState(sessionId: string, state: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status !== "active") {
      throw new Error(`Cannot update state of session with status: ${session.status}`);
    }

    session.state = state;
    session.updatedAt = new Date();
  }

  /**
   * セッションの履歴を取得
   */
  getSessionHistory(sessionId: string): ConversationHistory | undefined {
    return this.sessionHistories.get(sessionId);
  }

  /**
   * アクティブなセッションの履歴を取得
   */
  getActiveSessionHistory(): ConversationHistory | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.sessionHistories.get(this.activeSessionId) ?? null;
  }

  /**
   * アクティブなセッションを取得
   */
  getActiveSession(): TaskSession | null {
    if (!this.activeSessionId) {
      return null;
    }
    return this.sessions.get(this.activeSessionId) ?? null;
  }

  /**
   * 中断中のセッション一覧を取得
   */
  getSuspendedSessions(): TaskSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status === "suspended");
  }

  /**
   * 全セッションを取得
   */
  getAllSessions(): TaskSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 特定のセッションを取得
   */
  getSession(sessionId: string): TaskSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * セッションが存在するか確認
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * アクティブまたは中断中のセッション数を取得
   */
  getPendingSessionCount(): number {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "active" || s.status === "suspended"
    ).length;
  }

  /**
   * セッションのサマリーを自動生成
   */
  private generateSummary(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    const history = this.sessionHistories.get(sessionId);

    if (!session || !history) {
      return "セッション完了";
    }

    const messages = history.getAll();
    const messageCount = messages.length;

    return `[${session.taskType}] ${messageCount}件のメッセージで完了`;
  }

  /**
   * リセット（全セッションをクリア）
   */
  reset(): void {
    this.sessions.clear();
    this.sessionHistories.clear();
    this.activeSessionId = null;
  }
}

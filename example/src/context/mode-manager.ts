/**
 * Mode Manager - Manages mode stack for push/pop operations
 */

import { AgentMode, ModeStackEntry, DEFAULT_MODE } from "./types";

function generateId(): string {
  return `mode_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export class ModeManager {
  private stack: ModeStackEntry[] = [];

  constructor(initialMode: AgentMode = DEFAULT_MODE) {
    // ベースモードを最初にpush
    this.stack.push({
      mode: initialMode,
      enteredAt: new Date(),
    });
  }

  /**
   * 現在のモードを取得
   */
  getCurrentMode(): AgentMode {
    return this.stack[this.stack.length - 1].mode;
  }

  /**
   * 現在のモードエントリーを取得
   */
  getCurrentEntry(): ModeStackEntry {
    return this.stack[this.stack.length - 1];
  }

  /**
   * モードスタック全体を取得（読み取り専用）
   */
  getStack(): readonly ModeStackEntry[] {
    return [...this.stack];
  }

  /**
   * スタックの深さを取得
   */
  getDepth(): number {
    return this.stack.length;
  }

  /**
   * モードをスタックにpush
   */
  pushMode(mode: AgentMode, sessionId?: string): ModeStackEntry {
    const entry: ModeStackEntry = {
      mode,
      enteredAt: new Date(),
      sessionId,
    };
    this.stack.push(entry);
    return entry;
  }

  /**
   * モードをスタックからpop（ベースモードは削除しない）
   */
  popMode(): ModeStackEntry | undefined {
    // ベースモード（最初の1つ）は削除しない
    if (this.stack.length <= 1) {
      return undefined;
    }
    return this.stack.pop();
  }

  /**
   * 指定したセッションIDに紐づくモードまでpop
   */
  popToSession(sessionId: string): ModeStackEntry[] {
    const popped: ModeStackEntry[] = [];
    while (this.stack.length > 1) {
      const top = this.stack[this.stack.length - 1];
      if (top.sessionId === sessionId) {
        break;
      }
      const entry = this.stack.pop();
      if (entry) {
        popped.push(entry);
      }
    }
    return popped;
  }

  /**
   * ベースモードまでpop（全てのタスクモードを削除）
   */
  popToBase(): ModeStackEntry[] {
    const popped: ModeStackEntry[] = [];
    while (this.stack.length > 1) {
      const entry = this.stack.pop();
      if (entry) {
        popped.push(entry);
      }
    }
    return popped;
  }

  /**
   * 特定のセッションIDがスタック内にあるか確認
   */
  hasSession(sessionId: string): boolean {
    return this.stack.some((entry) => entry.sessionId === sessionId);
  }

  /**
   * リセット（初期状態に戻す）
   */
  reset(initialMode: AgentMode = DEFAULT_MODE): void {
    this.stack = [
      {
        mode: initialMode,
        enteredAt: new Date(),
      },
    ];
  }
}

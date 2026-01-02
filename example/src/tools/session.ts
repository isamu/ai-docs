/**
 * Session Management Tools
 * LLMが自律的にセッション/モードを管理するためのツール
 */

import { ContextAwareToolDefinition } from "./types";
import { getTaskConfigManager, TaskSessionState } from "../tasks";

/**
 * start_session - 新しいタスクセッションを開始
 */
export const startSessionTool: ContextAwareToolDefinition = {
  definition: {
    name: "start_session",
    description: `新しいタスクセッションを開始します。ユーザーがタスクを依頼した時に使用します。
ユーザーの具体的な指示がある場合は user_request に含めてください。`,
    inputSchema: {
      type: "object" as const,
      properties: {
        task_type: {
          type: "string",
          description: "タスクの種類（利用可能なタスクはlist_task_typesで確認）",
        },
        description: {
          type: "string",
          description: "タスクの説明（何を作成するか）",
        },
        user_request: {
          type: "string",
          description: "ユーザーの元のリクエスト（具体的な指示がある場合）。セッション履歴の開始コンテキストとして使用",
        },
      },
      required: ["task_type", "description"],
    },
  },
  execute: async (input, context) => {
    const taskType = input.task_type as string;
    const description = input.description as string;
    const userRequest = input.user_request as string | undefined;

    const configManager = getTaskConfigManager();
    const taskConfig = configManager.getConfig(taskType);

    if (!taskConfig) {
      const availableTasks = configManager.getTaskNames();
      return `エラー: 不明なタスクタイプ '${taskType}'。利用可能: ${availableTasks.join(", ")}`;
    }

    // セッション状態を初期化
    const firstPhase = configManager.getFirstPhase(taskType);
    const initialState: TaskSessionState = {
      description,
      currentPhase: firstPhase?.name,
      phaseIndex: 0,
      phaseHistory: firstPhase ? [firstPhase.name] : [],
      artifacts: [],
    };

    const mode = taskConfig.defaultMode;
    const session = context.startSession(taskType, mode, initialState);

    // ユーザーのリクエストをセッション履歴に追加（ターンロックをバイパス）
    if (userRequest) {
      const sessionHistory = context.getSessionHistory(session.id);
      sessionHistory?.addUserMessage(userRequest);
    }

    let result = `セッション開始: [${session.id}] ${taskConfig.displayName} - ${description}`;
    if (firstPhase) {
      result += `\n現在のフェーズ: ${firstPhase.name} - ${firstPhase.description}`;
      result += `\nゴール: ${firstPhase.goal}`;
    }

    return result;
  },
};

/**
 * advance_phase - 次のフェーズに進む
 */
export const advancePhaseTool: ContextAwareToolDefinition = {
  definition: {
    name: "advance_phase",
    description: `現在のフェーズを完了し、次のフェーズに進みます。
フェーズがrequiresApproval=trueの場合、ユーザーの確認が必要です。`,
    inputSchema: {
      type: "object" as const,
      properties: {
        phase_summary: {
          type: "string",
          description: "現在のフェーズで達成したことのサマリー",
        },
      },
      required: ["phase_summary"],
    },
  },
  execute: async (input, context) => {
    const session = context.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません";
    }

    const phaseSummary = input.phase_summary as string;
    const state = session.state as TaskSessionState;
    const configManager = getTaskConfigManager();

    if (!state.currentPhase) {
      return "エラー: このタスクにはフェーズが定義されていません";
    }

    const currentPhase = configManager.getPhase(session.taskType, state.currentPhase);
    const nextPhase = configManager.getNextPhase(session.taskType, state.currentPhase);

    if (!nextPhase) {
      return `フェーズ '${state.currentPhase}' は最終フェーズです。タスク完了にはcomplete_sessionを使用してください。\n達成: ${phaseSummary}`;
    }

    // 確認が必要な場合
    if (currentPhase?.requiresApproval) {
      return `フェーズ '${state.currentPhase}' は完了しましたが、次に進む前にユーザーの確認が必要です。\n達成: ${phaseSummary}\n\n${currentPhase.approvalPrompt || "このまま次のフェーズに進んでよろしいですか？"}`;
    }

    // 次のフェーズに進む
    const newState: TaskSessionState = {
      ...state,
      currentPhase: nextPhase.name,
      phaseIndex: state.phaseIndex + 1,
      phaseHistory: [...state.phaseHistory, nextPhase.name],
    };
    context.updateSessionState(newState);

    return `フェーズ完了: ${state.currentPhase} → ${nextPhase.name}\n達成: ${phaseSummary}\n\n次のフェーズ: ${nextPhase.name}\n${nextPhase.description}\nゴール: ${nextPhase.goal}`;
  },
};

/**
 * get_phase_status - 現在のフェーズ状態を取得
 */
export const getPhaseStatusTool: ContextAwareToolDefinition = {
  definition: {
    name: "get_phase_status",
    description: "現在のタスクのフェーズ状態を取得します。",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  execute: async (_input, context) => {
    const session = context.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません";
    }

    const state = session.state as TaskSessionState;
    const configManager = getTaskConfigManager();
    const taskConfig = configManager.getConfig(session.taskType);

    if (!taskConfig) {
      return "エラー: タスク設定が見つかりません";
    }

    const lines: string[] = [];
    lines.push(`タスク: ${taskConfig.displayName}`);
    lines.push(`説明: ${state.description}`);
    lines.push(`ゴール: ${taskConfig.goal}`);
    lines.push("");

    if (taskConfig.phases && state.currentPhase) {
      const currentPhase = configManager.getPhase(session.taskType, state.currentPhase);
      lines.push(`現在のフェーズ: ${state.currentPhase} (${state.phaseIndex + 1}/${taskConfig.phases.length})`);
      if (currentPhase) {
        lines.push(`  ${currentPhase.description}`);
        lines.push(`  ゴール: ${currentPhase.goal}`);
      }
      lines.push("");
      lines.push("フェーズ履歴:");
      state.phaseHistory.forEach((phase, i) => {
        const mark = phase === state.currentPhase ? "→" : "✓";
        lines.push(`  ${mark} ${phase}`);
      });
    } else {
      lines.push("フェーズ: 定義なし");
    }

    if (state.artifacts.length > 0) {
      lines.push("");
      lines.push("生成された成果物:");
      state.artifacts.forEach((artifact) => {
        lines.push(`  - ${artifact}`);
      });
    }

    lines.push("");
    lines.push("完了条件:");
    taskConfig.completionCriteria.forEach((criteria) => {
      lines.push(`  - ${criteria}`);
    });

    return lines.join("\n");
  },
};

/**
 * add_artifact - 成果物を記録
 */
export const addArtifactTool: ContextAwareToolDefinition = {
  definition: {
    name: "add_artifact",
    description: "生成した成果物（ファイルパス等）を記録します。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "成果物のパス",
        },
      },
      required: ["path"],
    },
  },
  execute: async (input, context) => {
    const session = context.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません";
    }

    const path = input.path as string;
    const state = session.state as TaskSessionState;

    const newState: TaskSessionState = {
      ...state,
      artifacts: [...state.artifacts, path],
    };
    context.updateSessionState(newState);

    return `成果物を記録: ${path}`;
  },
};

/**
 * list_task_types - 利用可能なタスクタイプを表示
 */
export const listTaskTypesTool: ContextAwareToolDefinition = {
  definition: {
    name: "list_task_types",
    description: "利用可能なタスクタイプの一覧を表示します。",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  execute: async (_input, _context) => {
    const configManager = getTaskConfigManager();
    const taskNames = configManager.getTaskNames();
    const lines: string[] = ["利用可能なタスクタイプ:"];

    for (const name of taskNames) {
      const config = configManager.getConfig(name);
      if (config) {
        lines.push(`\n[${name}] ${config.displayName}`);
        lines.push(`  ${config.description}`);
        lines.push(`  ゴール: ${config.goal}`);
        if (config.phases) {
          lines.push(`  フェーズ: ${config.phases.map((p) => p.name).join(" → ")}`);
        }
      }
    }

    return lines.join("\n");
  },
};

/**
 * suspend_session - 現在のセッションを中断
 */
export const suspendSessionTool: ContextAwareToolDefinition = {
  definition: {
    name: "suspend_session",
    description:
      "現在のタスクセッションを中断します。ユーザーが「一旦やめて」「後でやる」と言った時に使用します。",
    inputSchema: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description: "中断の理由（省略可）",
        },
      },
      required: [],
    },
  },
  execute: async (input, context) => {
    const session = context.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません";
    }

    const reason = (input.reason as string) || "ユーザーの要求";
    const state = session.state as TaskSessionState;
    context.suspendCurrentSession();

    let result = `セッション中断: [${session.id}] ${session.taskType} - ${reason}`;
    if (state.currentPhase) {
      result += `\n中断時のフェーズ: ${state.currentPhase}`;
    }

    return result;
  },
};

/**
 * resume_session - 中断中のセッションを再開
 */
export const resumeSessionTool: ContextAwareToolDefinition = {
  definition: {
    name: "resume_session",
    description:
      "中断中のタスクセッションを再開します。ユーザーが「さっきの続き」「再開して」と言った時に使用します。",
    inputSchema: {
      type: "object" as const,
      properties: {
        session_id: {
          type: "string",
          description: "再開するセッションのID（省略時は最後に中断したセッション）",
        },
      },
      required: [],
    },
  },
  execute: async (input, context) => {
    const sessionId = input.session_id as string | undefined;
    const suspended = context.getSuspendedSessions();

    if (suspended.length === 0) {
      return "エラー: 中断中のセッションがありません";
    }

    let targetSession;
    if (sessionId) {
      targetSession = suspended.find((s) => s.id === sessionId);
      if (!targetSession) {
        return `エラー: セッション '${sessionId}' が見つかりません`;
      }
    } else {
      // 最後に更新されたセッションを選択
      targetSession = suspended.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      )[0];
    }

    const configManager = getTaskConfigManager();
    const taskConfig = configManager.getConfig(targetSession.taskType);
    const mode = taskConfig?.defaultMode || "implementation";
    context.resumeSession(targetSession.id, mode);

    const state = targetSession.state as TaskSessionState;
    let result = `セッション再開: [${targetSession.id}] ${targetSession.taskType}`;
    if (state.currentPhase) {
      const phase = configManager.getPhase(targetSession.taskType, state.currentPhase);
      result += `\n現在のフェーズ: ${state.currentPhase}`;
      if (phase) {
        result += `\n  ${phase.description}`;
        result += `\n  ゴール: ${phase.goal}`;
      }
    }

    return result;
  },
};

/**
 * complete_session - 現在のセッションを完了
 */
export const completeSessionTool: ContextAwareToolDefinition = {
  definition: {
    name: "complete_session",
    description:
      "現在のタスクセッションを完了します。タスクが正常に終了した時に使用します。",
    inputSchema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "タスクの完了サマリー（何を達成したか）",
        },
      },
      required: ["summary"],
    },
  },
  execute: async (input, context) => {
    const session = context.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません";
    }

    const summary = input.summary as string;
    const state = session.state as TaskSessionState;
    context.completeCurrentSession({ summary });

    let result = `セッション完了: [${session.id}] ${summary}`;
    if (state.artifacts.length > 0) {
      result += "\n\n生成された成果物:";
      state.artifacts.forEach((artifact) => {
        result += `\n  - ${artifact}`;
      });
    }

    return result;
  },
};

/**
 * list_sessions - セッション一覧を表示
 */
export const listSessionsTool: ContextAwareToolDefinition = {
  definition: {
    name: "list_sessions",
    description:
      "現在のセッション状態を表示します。アクティブなタスクと中断中のタスクを確認できます。",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  execute: async (_input, context) => {
    const status = context.getStatus();
    const configManager = getTaskConfigManager();
    const lines: string[] = [];

    lines.push(`現在のモード: ${status.currentMode}`);

    if (status.activeTask) {
      const config = configManager.getConfig(status.activeTask.type);
      const session = context.getActiveSession();
      const state = session?.state as TaskSessionState | undefined;

      lines.push(`🎯 アクティブ: [${status.activeTask.id}] ${config?.displayName || status.activeTask.type}`);
      if (state?.currentPhase) {
        lines.push(`   フェーズ: ${state.currentPhase}`);
      }
    } else {
      lines.push("🎯 アクティブなタスクなし");
    }

    if (status.suspendedTasks.length > 0) {
      lines.push("💤 中断中:");
      for (const task of status.suspendedTasks) {
        const config = configManager.getConfig(task.type);
        lines.push(`   [${task.id}] ${config?.displayName || task.type}`);
      }
    }

    return lines.join("\n");
  },
};

// 全セッションツール
export const sessionTools: ContextAwareToolDefinition[] = [
  startSessionTool,
  advancePhaseTool,
  getPhaseStatusTool,
  addArtifactTool,
  listTaskTypesTool,
  suspendSessionTool,
  resumeSessionTool,
  completeSessionTool,
  listSessionsTool,
];

/**
 * Session Management Tools
 * LLMが自律的にセッション/モードを管理するためのツール
 */

import { ContextAwareToolDefinition } from "./types";
import { AgentMode } from "../context";

// 利用可能なタスクタイプ
const TASK_TYPES = ["mulmo", "codegen", "document", "analysis"] as const;
type TaskType = (typeof TASK_TYPES)[number];

// タスクタイプに対応するモード
const TASK_MODE_MAP: Record<TaskType, AgentMode> = {
  mulmo: "implementation",
  codegen: "implementation",
  document: "planning",
  analysis: "exploration",
};

/**
 * start_session - 新しいタスクセッションを開始
 */
export const startSessionTool: ContextAwareToolDefinition = {
  definition: {
    name: "start_session",
    description: `新しいタスクセッションを開始します。ユーザーがタスク（MulmoScript作成、コード生成等）を依頼した時に使用します。
利用可能なタスクタイプ: ${TASK_TYPES.join(", ")}`,
    inputSchema: {
      type: "object" as const,
      properties: {
        task_type: {
          type: "string",
          description: "タスクの種類",
          enum: TASK_TYPES,
        },
        description: {
          type: "string",
          description: "タスクの説明（何を作成するか）",
        },
      },
      required: ["task_type", "description"],
    },
  },
  execute: async (input, context) => {
    const taskType = input.task_type as TaskType;
    const description = input.description as string;

    if (!TASK_TYPES.includes(taskType)) {
      return `エラー: 不明なタスクタイプ '${taskType}'。利用可能: ${TASK_TYPES.join(", ")}`;
    }

    const mode = TASK_MODE_MAP[taskType];
    const session = context.startSession(taskType, mode, { description });

    return `セッション開始: [${session.id}] ${taskType} - ${description}`;
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
    context.suspendCurrentSession();

    return `セッション中断: [${session.id}] ${session.taskType} - ${reason}`;
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

    const mode = TASK_MODE_MAP[targetSession.taskType as TaskType] || "implementation";
    context.resumeSession(targetSession.id, mode);

    return `セッション再開: [${targetSession.id}] ${targetSession.taskType}`;
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
    context.completeCurrentSession({ summary });

    return `セッション完了: [${session.id}] ${summary}`;
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
    const lines: string[] = [];

    lines.push(`現在のモード: ${status.currentMode}`);

    if (status.activeTask) {
      lines.push(`🎯 アクティブ: [${status.activeTask.id}] ${status.activeTask.type}`);
    } else {
      lines.push("🎯 アクティブなタスクなし");
    }

    if (status.suspendedTasks.length > 0) {
      lines.push("💤 中断中:");
      status.suspendedTasks.forEach((task) => {
        lines.push(`   [${task.id}] ${task.type}`);
      });
    }

    return lines.join("\n");
  },
};

// 全セッションツール
export const sessionTools: ContextAwareToolDefinition[] = [
  startSessionTool,
  suspendSessionTool,
  resumeSessionTool,
  completeSessionTool,
  listSessionsTool,
];

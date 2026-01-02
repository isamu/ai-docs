/**
 * Session Tools Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { AgentContext } from "../src/context";
import {
  startSessionTool,
  suspendSessionTool,
  resumeSessionTool,
  completeSessionTool,
  listSessionsTool,
  sessionTools,
} from "../src/tools/session";

describe("Session Tools", () => {
  let context: AgentContext;

  beforeEach(() => {
    context = new AgentContext();
  });

  describe("sessionTools array", () => {
    it("should contain all 9 session tools", () => {
      assert.strictEqual(sessionTools.length, 9);
    });

    it("should have unique tool names", () => {
      const names = sessionTools.map((t) => t.definition.name);
      const uniqueNames = new Set(names);
      assert.strictEqual(uniqueNames.size, names.length);
    });
  });

  describe("start_session", () => {
    it("should have correct definition", () => {
      assert.strictEqual(startSessionTool.definition.name, "start_session");
      assert.ok(startSessionTool.definition.description.includes("新しいタスクセッション"));
    });

    it("should start a mulmo session", async () => {
      const result = await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト動画作成" },
        context
      );

      assert.ok(result.includes("セッション開始"));
      assert.ok(result.includes("mulmo"));
      assert.ok(result.includes("テスト動画作成"));
    });

    it("should switch to implementation mode for mulmo", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      assert.strictEqual(context.getMode(), "implementation");
    });

    it("should switch to implementation mode for codegen", async () => {
      await startSessionTool.execute(
        { task_type: "codegen", description: "test" },
        context
      );

      assert.strictEqual(context.getMode(), "implementation");
    });

    it("should switch to planning mode for document", async () => {
      await startSessionTool.execute(
        { task_type: "document", description: "test" },
        context
      );

      assert.strictEqual(context.getMode(), "planning");
    });

    it("should switch to exploration mode for analysis", async () => {
      await startSessionTool.execute(
        { task_type: "analysis", description: "test" },
        context
      );

      assert.strictEqual(context.getMode(), "exploration");
    });

    it("should return error for unknown task type", async () => {
      const result = await startSessionTool.execute(
        { task_type: "unknown", description: "test" },
        context
      );

      assert.ok(result.includes("エラー"));
      assert.ok(result.includes("unknown"));
    });

    it("should create active session", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      const session = context.getActiveSession();
      assert.ok(session);
      assert.strictEqual(session.taskType, "mulmo");
      assert.strictEqual(session.status, "active");
    });

    it("should store description in session state", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト" },
        context
      );

      const session = context.getActiveSession();
      const state = session?.state as {
        description: string;
        currentPhase: string;
        phaseIndex: number;
        phaseHistory: string[];
        artifacts: string[];
      };
      assert.strictEqual(state.description, "テスト");
      assert.strictEqual(state.currentPhase, "planning");
      assert.strictEqual(state.phaseIndex, 0);
      assert.deepStrictEqual(state.phaseHistory, ["planning"]);
      assert.deepStrictEqual(state.artifacts, []);
    });

    it("should add user_request to session history when provided", async () => {
      await startSessionTool.execute(
        {
          task_type: "mulmo",
          description: "宇宙動画",
          user_request: "宇宙に行く動画を作って。ロケットで月に行くストーリーで。",
        },
        context
      );

      const session = context.getActiveSession();
      const sessionHistory = context.getSessionHistory(session!.id);

      assert.strictEqual(sessionHistory?.getAll().length, 1);
      const firstMessage = sessionHistory?.getAll()[0];
      assert.strictEqual(firstMessage?.role, "user");
      assert.ok((firstMessage?.content as string).includes("ロケットで月に行く"));
    });

    it("should not add anything to session history without user_request", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト" },
        context
      );

      const session = context.getActiveSession();
      const sessionHistory = context.getSessionHistory(session!.id);

      assert.strictEqual(sessionHistory?.getAll().length, 0);
    });
  });

  describe("suspend_session", () => {
    it("should have correct definition", () => {
      assert.strictEqual(suspendSessionTool.definition.name, "suspend_session");
      assert.ok(suspendSessionTool.definition.description.includes("中断"));
    });

    it("should suspend active session", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      const result = await suspendSessionTool.execute({ reason: "ユーザー要求" }, context);

      assert.ok(result.includes("セッション中断"));
      assert.ok(result.includes("mulmo"));
    });

    it("should return to conversation mode after suspend", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      await suspendSessionTool.execute({}, context);

      assert.strictEqual(context.getMode(), "conversation");
    });

    it("should use default reason when not provided", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      const result = await suspendSessionTool.execute({}, context);

      assert.ok(result.includes("ユーザーの要求"));
    });

    it("should return error when no active session", async () => {
      const result = await suspendSessionTool.execute({}, context);

      assert.ok(result.includes("エラー"));
      assert.ok(result.includes("アクティブなセッションがありません"));
    });

    it("should add session to suspended list", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      await suspendSessionTool.execute({}, context);

      const suspended = context.getSuspendedSessions();
      assert.strictEqual(suspended.length, 1);
    });
  });

  describe("resume_session", () => {
    it("should have correct definition", () => {
      assert.strictEqual(resumeSessionTool.definition.name, "resume_session");
      assert.ok(resumeSessionTool.definition.description.includes("再開"));
    });

    it("should resume suspended session", async () => {
      const startResult = await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );
      // Extract session ID from result
      const sessionId = context.getActiveSession()?.id;
      await suspendSessionTool.execute({}, context);

      const result = await resumeSessionTool.execute({ session_id: sessionId }, context);

      assert.ok(result.includes("セッション再開"));
      assert.ok(result.includes("mulmo"));
    });

    it("should resume last suspended session when no id provided", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test1" },
        context
      );
      await suspendSessionTool.execute({}, context);

      await startSessionTool.execute(
        { task_type: "codegen", description: "test2" },
        context
      );
      await suspendSessionTool.execute({}, context);

      const result = await resumeSessionTool.execute({}, context);

      // Should resume the most recently updated session
      assert.ok(result.includes("セッション再開"));
    });

    it("should switch to correct mode on resume", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );
      await suspendSessionTool.execute({}, context);

      await resumeSessionTool.execute({}, context);

      assert.strictEqual(context.getMode(), "implementation");
    });

    it("should return error when no suspended sessions", async () => {
      const result = await resumeSessionTool.execute({}, context);

      assert.ok(result.includes("エラー"));
      assert.ok(result.includes("中断中のセッションがありません"));
    });

    it("should return error for non-existent session id", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );
      await suspendSessionTool.execute({}, context);

      const result = await resumeSessionTool.execute({ session_id: "nonexistent" }, context);

      assert.ok(result.includes("エラー"));
      assert.ok(result.includes("見つかりません"));
    });
  });

  describe("complete_session", () => {
    it("should have correct definition", () => {
      assert.strictEqual(completeSessionTool.definition.name, "complete_session");
      assert.ok(completeSessionTool.definition.description.includes("完了"));
    });

    it("should complete active session", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      const result = await completeSessionTool.execute(
        { summary: "タスク完了しました" },
        context
      );

      assert.ok(result.includes("セッション完了"));
      assert.ok(result.includes("タスク完了しました"));
    });

    it("should return to conversation mode after complete", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      await completeSessionTool.execute({ summary: "done" }, context);

      assert.strictEqual(context.getMode(), "conversation");
    });

    it("should return error when no active session", async () => {
      const result = await completeSessionTool.execute({ summary: "done" }, context);

      assert.ok(result.includes("エラー"));
      assert.ok(result.includes("アクティブなセッションがありません"));
    });

    it("should clear active session", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      await completeSessionTool.execute({ summary: "done" }, context);

      assert.strictEqual(context.getActiveSession(), null);
    });
  });

  describe("list_sessions", () => {
    it("should have correct definition", () => {
      assert.strictEqual(listSessionsTool.definition.name, "list_sessions");
      assert.ok(listSessionsTool.definition.description.includes("セッション状態"));
    });

    it("should show current mode when no sessions", async () => {
      const result = await listSessionsTool.execute({}, context);

      assert.ok(result.includes("現在のモード: conversation"));
      assert.ok(result.includes("アクティブなタスクなし"));
    });

    it("should show active session", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      const result = await listSessionsTool.execute({}, context);

      assert.ok(result.includes("現在のモード: implementation"));
      assert.ok(result.includes("アクティブ"));
      assert.ok(result.includes("mulmo"));
    });

    it("should show suspended sessions", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test1" },
        context
      );
      await suspendSessionTool.execute({}, context);

      const result = await listSessionsTool.execute({}, context);

      assert.ok(result.includes("中断中"));
      assert.ok(result.includes("mulmo"));
    });

    it("should show both active and suspended sessions", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test1" },
        context
      );
      await suspendSessionTool.execute({}, context);

      await startSessionTool.execute(
        { task_type: "codegen", description: "test2" },
        context
      );

      const result = await listSessionsTool.execute({}, context);

      assert.ok(result.includes("アクティブ"));
      assert.ok(result.includes("codegen"));
      assert.ok(result.includes("中断中"));
      assert.ok(result.includes("mulmo"));
    });
  });

  describe("integration", () => {
    it("should handle full workflow: start -> suspend -> resume -> complete", async () => {
      // Start session
      let result = await startSessionTool.execute(
        { task_type: "mulmo", description: "MulmoScript作成" },
        context
      );
      assert.ok(result.includes("セッション開始"));
      const sessionId = context.getActiveSession()?.id;

      // Suspend
      result = await suspendSessionTool.execute({ reason: "ちょっと待って" }, context);
      assert.ok(result.includes("セッション中断"));
      assert.strictEqual(context.getActiveSession(), null);

      // Resume
      result = await resumeSessionTool.execute({ session_id: sessionId }, context);
      assert.ok(result.includes("セッション再開"));
      assert.strictEqual(context.getActiveSession()?.id, sessionId);

      // Complete
      result = await completeSessionTool.execute(
        { summary: "MulmoScript作成完了" },
        context
      );
      assert.ok(result.includes("セッション完了"));
      assert.strictEqual(context.getActiveSession(), null);
    });

    it("should handle multiple sessions", async () => {
      // Start first session
      await startSessionTool.execute(
        { task_type: "mulmo", description: "task1" },
        context
      );
      const session1Id = context.getActiveSession()?.id;

      // Suspend first
      await suspendSessionTool.execute({}, context);

      // Start second session
      await startSessionTool.execute(
        { task_type: "codegen", description: "task2" },
        context
      );
      const session2Id = context.getActiveSession()?.id;

      // Check status
      let result = await listSessionsTool.execute({}, context);
      assert.ok(result.includes("codegen"));
      assert.ok(result.includes("mulmo"));

      // Resume first (auto-suspends second)
      result = await resumeSessionTool.execute({ session_id: session1Id }, context);
      assert.strictEqual(context.getActiveSession()?.id, session1Id);

      // Verify second is now suspended
      const suspended = context.getSuspendedSessions();
      assert.ok(suspended.some((s) => s.id === session2Id));
    });
  });
});

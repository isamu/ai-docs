/**
 * AgentContext Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { AgentContext } from "../src/context/agent-context";
import { ContentBlock } from "../src/llm";

describe("AgentContext", () => {
  let context: AgentContext;

  beforeEach(() => {
    context = new AgentContext();
  });

  describe("constructor", () => {
    it("should start with conversation mode by default", () => {
      assert.strictEqual(context.getMode(), "conversation");
    });

    it("should allow custom initial mode", () => {
      const explorationContext = new AgentContext({ initialMode: "exploration" });
      assert.strictEqual(explorationContext.getMode(), "exploration");
    });

    it("should have empty messages initially", () => {
      assert.strictEqual(context.getMessages().length, 0);
    });
  });

  describe("mode management", () => {
    it("should change mode with pushMode", () => {
      context.pushMode("planning");
      assert.strictEqual(context.getMode(), "planning");
    });

    it("should get mode config", () => {
      const config = context.getModeConfig();
      assert.strictEqual(config.name, "conversation");
      assert.ok(config.displayName);
      assert.ok(config.description);
      assert.ok(config.systemPrompt);
    });

    it("should get system prompt for current mode", () => {
      const prompt = context.getSystemPrompt();
      assert.ok(prompt.length > 0);
    });
  });

  describe("tool management", () => {
    it("should get enabled tools for conversation mode", () => {
      const tools = context.getEnabledTools();
      assert.ok(tools.length > 0);
      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes("read_file"));
      assert.ok(toolNames.includes("write_file"));
    });

    it("should get enabled tools for exploration mode", () => {
      context.pushMode("exploration");
      const tools = context.getEnabledTools();
      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes("read_file"));
      assert.ok(!toolNames.includes("write_file"));
    });

    it("should check if tool is enabled", () => {
      assert.strictEqual(context.isToolEnabled("read_file"), true);
      assert.strictEqual(context.isToolEnabled("write_file"), true);

      context.pushMode("exploration");
      assert.strictEqual(context.isToolEnabled("write_file"), false);
    });
  });

  describe("constraints", () => {
    it("should check file write permission", () => {
      assert.strictEqual(context.canWriteFiles(), true);

      context.pushMode("exploration");
      assert.strictEqual(context.canWriteFiles(), false);
    });

    it("should get max iterations", () => {
      const maxIter = context.getMaxIterations();
      assert.ok(maxIter > 0);
    });
  });

  describe("message management", () => {
    it("should add user message", () => {
      context.addUserMessage("Hello");
      assert.strictEqual(context.getMessages().length, 1);
    });

    it("should add assistant message", () => {
      const content: ContentBlock[] = [{ type: "text", text: "Hi there" }];
      context.addAssistantMessage(content);
      assert.strictEqual(context.getMessages().length, 1);
    });

    it("should add tool result", () => {
      context.addToolResult("calculator", "t1", "8");
      assert.strictEqual(context.getMessages().length, 1);
    });

    it("should add task completion", () => {
      context.addTaskCompletion("Done");
      assert.strictEqual(context.getMessages().length, 1);
    });

    it("should add error", () => {
      context.addError("Something went wrong");
      assert.strictEqual(context.getMessages().length, 1);
    });

    it("should convert to base messages", () => {
      context.addUserMessage("Hello");
      const baseMessages = context.toBaseMessages();
      assert.strictEqual(baseMessages.length, 1);
      assert.strictEqual(baseMessages[0].role, "user");
    });
  });

  describe("reset", () => {
    it("should reset all state", () => {
      context.addUserMessage("test");
      context.pushMode("implementation");

      context.reset();

      assert.strictEqual(context.getMessages().length, 0);
      assert.strictEqual(context.getMode(), "conversation");
    });

    it("should reset sessions", () => {
      context.startSession("mulmo", "implementation");
      context.reset();

      assert.strictEqual(context.getActiveSession(), null);
      assert.strictEqual(context.getSuspendedSessions().length, 0);
    });
  });

  describe("mode stack", () => {
    it("should push mode to stack", () => {
      context.pushMode("exploration");
      assert.strictEqual(context.getMode(), "exploration");
      assert.strictEqual(context.getModeStack().length, 2);
    });

    it("should pop mode from stack", () => {
      context.pushMode("exploration");
      context.pushMode("planning");

      const popped = context.popMode();

      assert.strictEqual(popped?.mode, "planning");
      assert.strictEqual(context.getMode(), "exploration");
    });

    it("should support temporary mode switch", () => {
      context.pushMode("implementation");
      context.pushMode("conversation"); // temporary switch

      assert.strictEqual(context.getMode(), "conversation");

      context.popMode();

      assert.strictEqual(context.getMode(), "implementation");
    });

    it("should not pop base mode", () => {
      const popped = context.popMode();
      assert.strictEqual(popped, undefined);
      assert.strictEqual(context.getMode(), "conversation");
    });
  });

  describe("session management", () => {
    it("should start session and switch mode", () => {
      const session = context.startSession("mulmo", "implementation");

      assert.ok(session.id.startsWith("mulmo-"));
      assert.strictEqual(session.status, "active");
      assert.strictEqual(context.getMode(), "implementation");
    });

    it("should start session with initial state", () => {
      const session = context.startSession("mulmo", "implementation", { phase: 1 });

      assert.deepStrictEqual(session.state, { phase: 1 });
    });

    it("should get active session", () => {
      const session = context.startSession("mulmo", "implementation");
      const active = context.getActiveSession();

      assert.strictEqual(active?.id, session.id);
    });

    it("should suspend current session", () => {
      const session = context.startSession("mulmo", "implementation");
      context.addUserMessage("test message");

      context.suspendCurrentSession();

      assert.strictEqual(context.getActiveSession(), null);
      assert.strictEqual(context.getMode(), "conversation");

      const suspended = context.getSuspendedSessions();
      assert.strictEqual(suspended.length, 1);
      assert.strictEqual(suspended[0].status, "suspended");
    });

    it("should throw when suspending without active session", () => {
      assert.throws(
        () => context.suspendCurrentSession(),
        /No active session to suspend/
      );
    });

    it("should resume session", () => {
      const session = context.startSession("mulmo", "implementation");
      context.suspendCurrentSession();

      const resumed = context.resumeSession(session.id, "implementation");

      assert.strictEqual(resumed.status, "active");
      assert.strictEqual(context.getMode(), "implementation");
      assert.strictEqual(context.getActiveSession()?.id, session.id);
    });

    it("should complete current session", () => {
      const session = context.startSession("mulmo", "implementation");

      context.completeCurrentSession();

      assert.strictEqual(context.getActiveSession(), null);
      assert.strictEqual(context.getMode(), "conversation");
      assert.strictEqual(context.sessionManager.getSession(session.id)?.status, "completed");
    });

    it("should throw when completing without active session", () => {
      assert.throws(
        () => context.completeCurrentSession(),
        /No active session to complete/
      );
    });

    it("should discard session", () => {
      const session = context.startSession("mulmo", "implementation");
      context.suspendCurrentSession();

      context.discardSession(session.id);

      assert.strictEqual(context.sessionManager.getSession(session.id)?.status, "discarded");
    });

    it("should update session state", () => {
      context.startSession("mulmo", "implementation", { phase: 1 });

      context.updateSessionState({ phase: 2, data: ["test"] });

      const session = context.getActiveSession();
      assert.deepStrictEqual(session?.state, { phase: 2, data: ["test"] });
    });

    it("should throw when updating without active session", () => {
      assert.throws(
        () => context.updateSessionState({}),
        /No active session to update/
      );
    });
  });

  describe("status", () => {
    it("should return status with no sessions", () => {
      const status = context.getStatus();

      assert.strictEqual(status.currentMode, "conversation");
      assert.strictEqual(status.modeStackDepth, 1);
      assert.strictEqual(status.activeTask, null);
      assert.strictEqual(status.suspendedTasks.length, 0);
    });

    it("should return status with active session", () => {
      context.startSession("mulmo", "implementation");

      const status = context.getStatus();

      assert.strictEqual(status.currentMode, "implementation");
      assert.strictEqual(status.modeStackDepth, 2);
      assert.ok(status.activeTask);
      assert.strictEqual(status.activeTask?.type, "mulmo");
      assert.strictEqual(status.activeTask?.status, "active");
    });

    it("should return status with suspended sessions", () => {
      const session1 = context.startSession("mulmo", "implementation");
      context.suspendCurrentSession();
      const session2 = context.startSession("codegen", "implementation");
      context.suspendCurrentSession();

      const status = context.getStatus();

      assert.strictEqual(status.activeTask, null);
      assert.strictEqual(status.suspendedTasks.length, 2);
    });
  });

  describe("integration scenario", () => {
    it("should handle typical workflow: start -> temp switch -> resume -> complete", () => {
      // 1. Start task
      const session = context.startSession("mulmo", "implementation", { phase: 1 });
      assert.strictEqual(context.getMode(), "implementation");

      // 2. User asks a question (temporary conversation)
      context.pushMode("conversation");
      assert.strictEqual(context.getMode(), "conversation");

      // 3. Answer and return to task
      context.popMode();
      assert.strictEqual(context.getMode(), "implementation");

      // 4. Update state
      context.updateSessionState({ phase: 2 });
      assert.deepStrictEqual(context.getActiveSession()?.state, { phase: 2 });

      // 5. Complete task
      context.completeCurrentSession();
      assert.strictEqual(context.getMode(), "conversation");
      assert.strictEqual(context.getActiveSession(), null);
    });

    it("should handle suspend -> new task -> resume workflow", () => {
      // 1. Start first task
      const session1 = context.startSession("mulmo", "implementation");
      context.updateSessionState({ phase: 1 });

      // 2. Suspend first task
      context.suspendCurrentSession();
      assert.strictEqual(context.getSuspendedSessions().length, 1);

      // 3. Start second task
      const session2 = context.startSession("codegen", "planning");
      assert.strictEqual(context.getMode(), "planning");

      // 4. Resume first task (auto-suspends second)
      context.resumeSession(session1.id, "implementation");
      assert.strictEqual(context.getActiveSession()?.id, session1.id);
      assert.strictEqual(context.getSuspendedSessions().length, 1);
      assert.strictEqual(context.getSuspendedSessions()[0].id, session2.id);

      // 5. State should be preserved
      assert.deepStrictEqual(context.getActiveSession()?.state, { phase: 1 });
    });
  });

  describe("session history isolation", () => {
    it("should use baseHistory when no session active", () => {
      context.addUserMessage("base message");

      assert.strictEqual(context.baseHistory.getAll().length, 1);
      assert.strictEqual(context.getMessages().length, 1);
    });

    it("should use session history when session is active", () => {
      context.addUserMessage("base message");
      const session = context.startSession("mulmo", "implementation");

      context.addUserMessage("session message");

      // セッション履歴には1件
      assert.strictEqual(context.getMessages().length, 1);
      // ベース履歴には1件のまま
      assert.strictEqual(context.baseHistory.getAll().length, 1);
    });

    it("should isolate history between sessions", () => {
      const session1 = context.startSession("mulmo", "implementation");
      context.addUserMessage("session1 message");
      context.suspendCurrentSession();

      const session2 = context.startSession("codegen", "planning");
      context.addUserMessage("session2 message");

      // 各セッションは独立した履歴
      const history1 = context.getSessionHistory(session1.id);
      const history2 = context.getSessionHistory(session2.id);

      assert.strictEqual(history1?.getAll().length, 1);
      assert.strictEqual(history2?.getAll().length, 1);
    });

    it("should add summary to baseHistory on session complete", () => {
      context.addUserMessage("initial message");
      const session = context.startSession("mulmo", "implementation");
      context.addUserMessage("task message");

      context.completeCurrentSession({ summary: "Task completed successfully" });

      // ベース履歴にサマリーが追加される
      const baseMessages = context.baseHistory.getAll();
      assert.strictEqual(baseMessages.length, 2); // initial + summary
      assert.ok(baseMessages[1].label === "task_completion");
    });

    it("should switch to baseHistory after session complete", () => {
      context.startSession("mulmo", "implementation");
      context.addUserMessage("session message");
      context.completeCurrentSession();

      // セッション完了後はbaseHistoryを使用
      context.addUserMessage("after session");

      assert.strictEqual(context.baseHistory.getAll().length, 2); // summary + after session
    });

    it("should preserve session history after suspend and resume", () => {
      const session = context.startSession("mulmo", "implementation");
      context.addUserMessage("before suspend");
      context.suspendCurrentSession();

      context.addUserMessage("during base");

      context.resumeSession(session.id, "implementation");
      context.addUserMessage("after resume");

      // セッション履歴は継続
      assert.strictEqual(context.getMessages().length, 2);
      // ベース履歴には中断中のメッセージ
      assert.strictEqual(context.baseHistory.getAll().length, 1);
    });
  });
});

/**
 * SessionManager Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { SessionManager } from "../src/context";

describe("SessionManager", () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe("startSession", () => {
    it("should create a new active session", () => {
      const session = manager.startSession("mulmo");

      assert.ok(session.id.startsWith("mulmo-"));
      assert.strictEqual(session.taskType, "mulmo");
      assert.strictEqual(session.status, "active");
      assert.ok(session.createdAt instanceof Date);
      assert.ok(session.updatedAt instanceof Date);
    });

    it("should set initial state", () => {
      const initialState = { phase: 1, data: [] };
      const session = manager.startSession("mulmo", initialState);

      assert.deepStrictEqual(session.state, initialState);
    });

    it("should set as active session", () => {
      const session = manager.startSession("mulmo");
      const active = manager.getActiveSession();

      assert.strictEqual(active?.id, session.id);
    });

    it("should suspend previous active session", () => {
      const session1 = manager.startSession("mulmo");
      const session2 = manager.startSession("codegen");

      assert.strictEqual(manager.getSession(session1.id)?.status, "suspended");
      assert.strictEqual(manager.getActiveSession()?.id, session2.id);
    });

    it("should generate unique ids", () => {
      const session1 = manager.startSession("mulmo");
      const session2 = manager.startSession("mulmo");

      assert.notStrictEqual(session1.id, session2.id);
    });
  });

  describe("suspendSession", () => {
    it("should change status to suspended", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);

      assert.strictEqual(manager.getSession(session.id)?.status, "suspended");
    });

    it("should clear active session", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);

      assert.strictEqual(manager.getActiveSession(), null);
    });

    it("should throw for non-existent session", () => {
      assert.throws(
        () => manager.suspendSession("nonexistent"),
        /Session not found/
      );
    });

    it("should throw for non-active session", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);

      assert.throws(
        () => manager.suspendSession(session.id),
        /Cannot suspend session with status/
      );
    });

    it("should update updatedAt", () => {
      const session = manager.startSession("mulmo");
      const originalUpdatedAt = session.updatedAt;

      // Small delay to ensure time difference
      manager.suspendSession(session.id);

      assert.ok(manager.getSession(session.id)!.updatedAt >= originalUpdatedAt);
    });
  });

  describe("resumeSession", () => {
    it("should change status to active", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);
      manager.resumeSession(session.id);

      assert.strictEqual(manager.getSession(session.id)?.status, "active");
    });

    it("should set as active session", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);
      manager.resumeSession(session.id);

      assert.strictEqual(manager.getActiveSession()?.id, session.id);
    });

    it("should suspend current active session", () => {
      const session1 = manager.startSession("mulmo");
      manager.suspendSession(session1.id);
      const session2 = manager.startSession("codegen");

      manager.resumeSession(session1.id);

      assert.strictEqual(manager.getSession(session2.id)?.status, "suspended");
      assert.strictEqual(manager.getActiveSession()?.id, session1.id);
    });

    it("should return the resumed session", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);
      const resumed = manager.resumeSession(session.id);

      assert.strictEqual(resumed.id, session.id);
      assert.strictEqual(resumed.status, "active");
    });

    it("should throw for non-existent session", () => {
      assert.throws(
        () => manager.resumeSession("nonexistent"),
        /Session not found/
      );
    });

    it("should throw for non-suspended session", () => {
      const session = manager.startSession("mulmo");

      assert.throws(
        () => manager.resumeSession(session.id),
        /Cannot resume session with status/
      );
    });
  });

  describe("completeSession", () => {
    it("should change status to completed", () => {
      const session = manager.startSession("mulmo");
      manager.completeSession(session.id);

      assert.strictEqual(manager.getSession(session.id)?.status, "completed");
    });

    it("should clear active session", () => {
      const session = manager.startSession("mulmo");
      manager.completeSession(session.id);

      assert.strictEqual(manager.getActiveSession(), null);
    });

    it("should throw for non-existent session", () => {
      assert.throws(
        () => manager.completeSession("nonexistent"),
        /Session not found/
      );
    });

    it("should throw for non-active session", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);

      assert.throws(
        () => manager.completeSession(session.id),
        /Cannot complete session with status/
      );
    });
  });

  describe("discardSession", () => {
    it("should change status to discarded", () => {
      const session = manager.startSession("mulmo");
      manager.discardSession(session.id);

      assert.strictEqual(manager.getSession(session.id)?.status, "discarded");
    });

    it("should work for suspended session", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);
      manager.discardSession(session.id);

      assert.strictEqual(manager.getSession(session.id)?.status, "discarded");
    });

    it("should throw for completed session", () => {
      const session = manager.startSession("mulmo");
      manager.completeSession(session.id);

      assert.throws(
        () => manager.discardSession(session.id),
        /Cannot discard session with status/
      );
    });

    it("should throw for already discarded session", () => {
      const session = manager.startSession("mulmo");
      manager.discardSession(session.id);

      assert.throws(
        () => manager.discardSession(session.id),
        /Cannot discard session with status/
      );
    });
  });

  describe("updateSessionState", () => {
    it("should update session state", () => {
      const session = manager.startSession("mulmo", { phase: 1 });
      manager.updateSessionState(session.id, { phase: 2, data: [1, 2, 3] });

      const updated = manager.getSession(session.id);
      assert.deepStrictEqual(updated?.state, { phase: 2, data: [1, 2, 3] });
    });

    it("should throw for non-existent session", () => {
      assert.throws(
        () => manager.updateSessionState("nonexistent", {}),
        /Session not found/
      );
    });

    it("should throw for non-active session", () => {
      const session = manager.startSession("mulmo");
      manager.suspendSession(session.id);

      assert.throws(
        () => manager.updateSessionState(session.id, {}),
        /Cannot update state of session with status/
      );
    });
  });

  describe("getSuspendedSessions", () => {
    it("should return empty array when no suspended sessions", () => {
      assert.deepStrictEqual(manager.getSuspendedSessions(), []);
    });

    it("should return only suspended sessions", () => {
      const session1 = manager.startSession("mulmo");
      manager.suspendSession(session1.id);
      const session2 = manager.startSession("codegen");
      manager.suspendSession(session2.id);
      manager.startSession("doc"); // active

      const suspended = manager.getSuspendedSessions();

      assert.strictEqual(suspended.length, 2);
      assert.ok(suspended.some((s) => s.id === session1.id));
      assert.ok(suspended.some((s) => s.id === session2.id));
    });
  });

  describe("getAllSessions", () => {
    it("should return all sessions regardless of status", () => {
      const session1 = manager.startSession("mulmo");
      manager.completeSession(session1.id);
      const session2 = manager.startSession("codegen");
      manager.suspendSession(session2.id);
      manager.startSession("doc");

      const all = manager.getAllSessions();

      assert.strictEqual(all.length, 3);
    });
  });

  describe("getPendingSessionCount", () => {
    it("should count active and suspended sessions", () => {
      const session1 = manager.startSession("mulmo");
      manager.suspendSession(session1.id);
      manager.startSession("codegen");

      assert.strictEqual(manager.getPendingSessionCount(), 2);
    });

    it("should not count completed or discarded sessions", () => {
      const session1 = manager.startSession("mulmo");
      manager.completeSession(session1.id);
      const session2 = manager.startSession("codegen");
      manager.discardSession(session2.id);

      assert.strictEqual(manager.getPendingSessionCount(), 0);
    });
  });

  describe("hasSession", () => {
    it("should return true for existing session", () => {
      const session = manager.startSession("mulmo");
      assert.strictEqual(manager.hasSession(session.id), true);
    });

    it("should return false for non-existent session", () => {
      assert.strictEqual(manager.hasSession("nonexistent"), false);
    });
  });

  describe("reset", () => {
    it("should clear all sessions", () => {
      manager.startSession("mulmo");
      manager.startSession("codegen");

      manager.reset();

      assert.strictEqual(manager.getAllSessions().length, 0);
      assert.strictEqual(manager.getActiveSession(), null);
    });
  });

  describe("session history", () => {
    it("should create history for each session", () => {
      const session = manager.startSession("mulmo");
      const history = manager.getSessionHistory(session.id);

      assert.ok(history);
      assert.strictEqual(history.getAll().length, 0);
    });

    it("should return active session history", () => {
      const session = manager.startSession("mulmo");
      const activeHistory = manager.getActiveSessionHistory();

      assert.ok(activeHistory);
      assert.strictEqual(activeHistory, manager.getSessionHistory(session.id));
    });

    it("should return null when no active session", () => {
      assert.strictEqual(manager.getActiveSessionHistory(), null);
    });

    it("should isolate history between sessions", () => {
      const session1 = manager.startSession("mulmo");
      const history1 = manager.getSessionHistory(session1.id)!;
      history1.addUserMessage("message for session 1");

      manager.suspendSession(session1.id);

      const session2 = manager.startSession("codegen");
      const history2 = manager.getSessionHistory(session2.id)!;
      history2.addUserMessage("message for session 2");

      assert.strictEqual(history1.getAll().length, 1);
      assert.strictEqual(history2.getAll().length, 1);
      assert.notStrictEqual(history1, history2);
    });

    it("should preserve history when session is suspended and resumed", () => {
      const session = manager.startSession("mulmo");
      const history = manager.getSessionHistory(session.id)!;
      history.addUserMessage("test message");

      manager.suspendSession(session.id);
      manager.resumeSession(session.id);

      const resumedHistory = manager.getSessionHistory(session.id)!;
      assert.strictEqual(resumedHistory.getAll().length, 1);
    });
  });

  describe("session summary", () => {
    it("should generate summary on completion", () => {
      const session = manager.startSession("mulmo");
      const history = manager.getSessionHistory(session.id)!;
      history.addUserMessage("test");
      history.addAssistantMessage([{ type: "text", text: "response" }]);

      const summary = manager.completeSession(session.id);

      assert.ok(summary.includes("mulmo"));
      assert.ok(summary.includes("2"));
    });

    it("should allow custom summary", () => {
      const session = manager.startSession("mulmo");

      const summary = manager.completeSession(session.id, { summary: "Custom summary" });

      assert.strictEqual(summary, "Custom summary");
      assert.strictEqual(manager.getSession(session.id)?.summary, "Custom summary");
    });

    it("should store summary in session", () => {
      const session = manager.startSession("mulmo");
      manager.completeSession(session.id, { summary: "Test summary" });

      assert.strictEqual(manager.getSession(session.id)?.summary, "Test summary");
    });
  });
});

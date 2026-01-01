/**
 * ModeManager Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { ModeManager } from "../src/context";

describe("ModeManager", () => {
  let manager: ModeManager;

  beforeEach(() => {
    manager = new ModeManager();
  });

  describe("constructor", () => {
    it("should start with conversation mode by default", () => {
      assert.strictEqual(manager.getCurrentMode(), "conversation");
    });

    it("should allow custom initial mode", () => {
      const customManager = new ModeManager("exploration");
      assert.strictEqual(customManager.getCurrentMode(), "exploration");
    });

    it("should have stack depth of 1 initially", () => {
      assert.strictEqual(manager.getDepth(), 1);
    });
  });

  describe("pushMode", () => {
    it("should add mode to stack", () => {
      manager.pushMode("exploration");
      assert.strictEqual(manager.getCurrentMode(), "exploration");
      assert.strictEqual(manager.getDepth(), 2);
    });

    it("should return the created entry", () => {
      const entry = manager.pushMode("planning");
      assert.strictEqual(entry.mode, "planning");
      assert.ok(entry.enteredAt instanceof Date);
    });

    it("should allow pushing with sessionId", () => {
      const entry = manager.pushMode("implementation", "session-001");
      assert.strictEqual(entry.sessionId, "session-001");
    });

    it("should allow multiple pushes", () => {
      manager.pushMode("exploration");
      manager.pushMode("planning");
      manager.pushMode("implementation");
      assert.strictEqual(manager.getCurrentMode(), "implementation");
      assert.strictEqual(manager.getDepth(), 4);
    });
  });

  describe("popMode", () => {
    it("should remove top mode and return to previous", () => {
      manager.pushMode("exploration");
      const popped = manager.popMode();

      assert.strictEqual(popped?.mode, "exploration");
      assert.strictEqual(manager.getCurrentMode(), "conversation");
    });

    it("should not pop base mode", () => {
      const popped = manager.popMode();
      assert.strictEqual(popped, undefined);
      assert.strictEqual(manager.getDepth(), 1);
    });

    it("should return undefined when only base mode remains", () => {
      manager.pushMode("exploration");
      manager.popMode();
      const popped = manager.popMode();
      assert.strictEqual(popped, undefined);
    });
  });

  describe("popToBase", () => {
    it("should pop all modes except base", () => {
      manager.pushMode("exploration");
      manager.pushMode("planning");
      manager.pushMode("implementation");

      const popped = manager.popToBase();

      assert.strictEqual(popped.length, 3);
      assert.strictEqual(manager.getDepth(), 1);
      assert.strictEqual(manager.getCurrentMode(), "conversation");
    });

    it("should return empty array when already at base", () => {
      const popped = manager.popToBase();
      assert.strictEqual(popped.length, 0);
    });

    it("should return popped entries in order", () => {
      manager.pushMode("exploration");
      manager.pushMode("planning");

      const popped = manager.popToBase();

      assert.strictEqual(popped[0].mode, "planning");
      assert.strictEqual(popped[1].mode, "exploration");
    });
  });

  describe("popToSession", () => {
    it("should pop modes until reaching the session", () => {
      manager.pushMode("exploration", "session-001");
      manager.pushMode("conversation");
      manager.pushMode("planning");

      const popped = manager.popToSession("session-001");

      assert.strictEqual(popped.length, 2);
      assert.strictEqual(manager.getCurrentMode(), "exploration");
    });

    it("should not pop the session mode itself", () => {
      manager.pushMode("exploration", "session-001");
      manager.pushMode("conversation");

      manager.popToSession("session-001");

      assert.strictEqual(manager.getCurrentMode(), "exploration");
      assert.strictEqual(manager.getDepth(), 2);
    });

    it("should pop all if session not found", () => {
      manager.pushMode("exploration");
      manager.pushMode("planning");

      const popped = manager.popToSession("nonexistent");

      assert.strictEqual(popped.length, 2);
      assert.strictEqual(manager.getDepth(), 1);
    });
  });

  describe("hasSession", () => {
    it("should return true if session exists in stack", () => {
      manager.pushMode("exploration", "session-001");
      assert.strictEqual(manager.hasSession("session-001"), true);
    });

    it("should return false if session does not exist", () => {
      assert.strictEqual(manager.hasSession("nonexistent"), false);
    });

    it("should return false for entry without sessionId", () => {
      manager.pushMode("exploration");
      assert.strictEqual(manager.hasSession("undefined"), false);
    });
  });

  describe("getStack", () => {
    it("should return copy of stack", () => {
      manager.pushMode("exploration");
      const stack1 = manager.getStack();
      const stack2 = manager.getStack();

      assert.notStrictEqual(stack1, stack2);
      assert.deepStrictEqual(stack1, stack2);
    });

    it("should contain all entries in order", () => {
      manager.pushMode("exploration");
      manager.pushMode("planning");

      const stack = manager.getStack();

      assert.strictEqual(stack.length, 3);
      assert.strictEqual(stack[0].mode, "conversation");
      assert.strictEqual(stack[1].mode, "exploration");
      assert.strictEqual(stack[2].mode, "planning");
    });
  });

  describe("getCurrentEntry", () => {
    it("should return the top entry", () => {
      manager.pushMode("exploration", "session-001");
      const entry = manager.getCurrentEntry();

      assert.strictEqual(entry.mode, "exploration");
      assert.strictEqual(entry.sessionId, "session-001");
    });
  });

  describe("reset", () => {
    it("should reset to default mode", () => {
      manager.pushMode("exploration");
      manager.pushMode("planning");

      manager.reset();

      assert.strictEqual(manager.getDepth(), 1);
      assert.strictEqual(manager.getCurrentMode(), "conversation");
    });

    it("should allow reset with custom mode", () => {
      manager.pushMode("exploration");

      manager.reset("planning");

      assert.strictEqual(manager.getDepth(), 1);
      assert.strictEqual(manager.getCurrentMode(), "planning");
    });
  });
});

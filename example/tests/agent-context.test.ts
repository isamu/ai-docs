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
    it("should change mode", () => {
      context.setMode("planning");
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
      context.setMode("exploration");
      const tools = context.getEnabledTools();
      const toolNames = tools.map((t) => t.name);
      assert.ok(toolNames.includes("read_file"));
      assert.ok(!toolNames.includes("write_file"));
    });

    it("should check if tool is enabled", () => {
      assert.strictEqual(context.isToolEnabled("read_file"), true);
      assert.strictEqual(context.isToolEnabled("write_file"), true);

      context.setMode("exploration");
      assert.strictEqual(context.isToolEnabled("write_file"), false);
    });
  });

  describe("constraints", () => {
    it("should check file write permission", () => {
      assert.strictEqual(context.canWriteFiles(), true);

      context.setMode("exploration");
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
      context.setMode("implementation");

      context.reset();

      assert.strictEqual(context.getMessages().length, 0);
      assert.strictEqual(context.getMode(), "conversation");
    });
  });
});

/**
 * ConversationHistory Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { ConversationHistory } from "../src/history";
import { ContentBlock } from "../src/llm";

describe("ConversationHistory", () => {
  let history: ConversationHistory;

  beforeEach(() => {
    history = new ConversationHistory();
  });

  describe("addUserMessage", () => {
    it("should add user message with correct role", () => {
      const message = history.addUserMessage("テストメッセージ");
      assert.strictEqual(message.role, "user");
      assert.strictEqual(message.content, "テストメッセージ");
    });

    it("should add user message with label 'user_input'", () => {
      const message = history.addUserMessage("テスト");
      assert.strictEqual(message.label, "user_input");
    });

    it("should generate unique id for each message", () => {
      const message1 = history.addUserMessage("テスト1");
      const message2 = history.addUserMessage("テスト2");
      assert.notStrictEqual(message1.id, message2.id);
    });

    it("should add timestamp to message", () => {
      const before = new Date();
      const message = history.addUserMessage("テスト");
      const after = new Date();
      assert.ok(message.timestamp >= before);
      assert.ok(message.timestamp <= after);
    });
  });

  describe("addAssistantMessage", () => {
    it("should add assistant message with correct role", () => {
      const content: ContentBlock[] = [{ type: "text", text: "応答" }];
      const message = history.addAssistantMessage(content);
      assert.strictEqual(message.role, "assistant");
      assert.deepStrictEqual(message.content, content);
    });

    it("should add assistant message with label 'assistant_response'", () => {
      const content: ContentBlock[] = [{ type: "text", text: "応答" }];
      const message = history.addAssistantMessage(content);
      assert.strictEqual(message.label, "assistant_response");
    });
  });

  describe("addToolResult", () => {
    it("should add tool result with correct structure", () => {
      const message = history.addToolResult("calculator", "tool_001", "8");
      assert.strictEqual(message.role, "user");
      assert.strictEqual(message.label, "tool_result");
    });
  });

  describe("addTaskCompletion", () => {
    it("should add task completion with correct label", () => {
      const message = history.addTaskCompletion("タスク完了しました");
      assert.strictEqual(message.label, "task_completion");
    });
  });

  describe("addError", () => {
    it("should add error with correct label", () => {
      const message = history.addError("エラーが発生しました");
      assert.strictEqual(message.label, "error");
    });
  });

  describe("getAll", () => {
    it("should return empty array initially", () => {
      const messages = history.getAll();
      assert.deepStrictEqual(messages, []);
    });

    it("should return all messages in order", () => {
      history.addUserMessage("メッセージ1");
      history.addUserMessage("メッセージ2");
      history.addUserMessage("メッセージ3");

      const messages = history.getAll();
      assert.strictEqual(messages.length, 3);
      assert.strictEqual(messages[0].content, "メッセージ1");
      assert.strictEqual(messages[1].content, "メッセージ2");
      assert.strictEqual(messages[2].content, "メッセージ3");
    });

    it("should return a copy of messages array", () => {
      history.addUserMessage("テスト");
      const messages1 = history.getAll();
      const messages2 = history.getAll();
      assert.notStrictEqual(messages1, messages2);
    });
  });

  describe("toBaseMessages", () => {
    it("should convert to base messages format", () => {
      history.addUserMessage("テスト");
      history.addAssistantMessage([{ type: "text", text: "応答" }]);

      const baseMessages = history.toBaseMessages();
      assert.strictEqual(baseMessages.length, 2);
      assert.strictEqual(baseMessages[0].role, "user");
      assert.strictEqual(baseMessages[0].content, "テスト");
      assert.strictEqual(baseMessages[1].role, "assistant");
    });
  });

  describe("clear", () => {
    it("should remove all messages", () => {
      history.addUserMessage("メッセージ1");
      history.addUserMessage("メッセージ2");

      history.clear();

      assert.deepStrictEqual(history.getAll(), []);
    });
  });
});

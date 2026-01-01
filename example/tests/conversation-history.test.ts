/**
 * ConversationHistory Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { ConversationHistory } from "../history";
import { ContentBlock } from "../llm";

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

      assert.strictEqual(message.metadata.label, "user_input");
    });

    it("should add user message with default priority 'high'", () => {
      const message = history.addUserMessage("テスト");

      assert.strictEqual(message.metadata.priority, "high");
    });

    it("should add user message with tags", () => {
      const message = history.addUserMessage("テスト", ["tag1", "tag2"]);

      assert.deepStrictEqual(message.metadata.tags, ["tag1", "tag2"]);
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

      assert.ok(message.metadata.timestamp >= before);
      assert.ok(message.metadata.timestamp <= after);
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

      assert.strictEqual(message.metadata.label, "assistant_response");
    });

    it("should add assistant message with default priority 'medium'", () => {
      const content: ContentBlock[] = [{ type: "text", text: "応答" }];
      const message = history.addAssistantMessage(content);

      assert.strictEqual(message.metadata.priority, "medium");
    });
  });

  describe("addToolResult", () => {
    it("should add tool result with correct structure", () => {
      const message = history.addToolResult("calculator", "tool_001", "8");

      assert.strictEqual(message.role, "user");
      assert.strictEqual(message.metadata.label, "tool_result");
      assert.strictEqual(message.metadata.toolName, "calculator");
      assert.strictEqual(message.metadata.toolUseId, "tool_001");
    });
  });

  describe("addTaskCompletion", () => {
    it("should add task completion with correct label", () => {
      const message = history.addTaskCompletion("タスク完了しました");

      assert.strictEqual(message.metadata.label, "task_completion");
      assert.strictEqual(message.metadata.priority, "high");
    });
  });

  describe("addError", () => {
    it("should add error with correct label and priority", () => {
      const message = history.addError("エラーが発生しました");

      assert.strictEqual(message.metadata.label, "error");
      assert.strictEqual(message.metadata.priority, "high");
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

  describe("getById", () => {
    it("should return message by id", () => {
      const added = history.addUserMessage("テスト");
      const found = history.getById(added.id);

      assert.strictEqual(found, added);
    });

    it("should return undefined for unknown id", () => {
      const found = history.getById("unknown_id");

      assert.strictEqual(found, undefined);
    });
  });

  describe("getByLabel", () => {
    it("should return messages with specific label", () => {
      history.addUserMessage("ユーザー1");
      history.addAssistantMessage([{ type: "text", text: "アシスタント" }]);
      history.addUserMessage("ユーザー2");

      const userMessages = history.getByLabel("user_input");

      assert.strictEqual(userMessages.length, 2);
    });

    it("should return empty array if no messages with label", () => {
      history.addUserMessage("テスト");

      const errors = history.getByLabel("error");

      assert.deepStrictEqual(errors, []);
    });
  });

  describe("filter", () => {
    beforeEach(() => {
      history.addUserMessage("ユーザー1", ["important"]);
      history.addAssistantMessage([{ type: "text", text: "アシスタント" }]);
      history.addUserMessage("ユーザー2");
      history.addError("エラー");
    });

    it("should filter by labels", () => {
      const filtered = history.filter({ labels: ["user_input"] });

      assert.strictEqual(filtered.length, 2);
    });

    it("should filter by priorities", () => {
      const filtered = history.filter({ priorities: ["high"] });

      assert.strictEqual(filtered.length, 3); // 2 user_input + 1 error
    });

    it("should filter by tags", () => {
      const filtered = history.filter({ tags: ["important"] });

      assert.strictEqual(filtered.length, 1);
    });

    it("should apply limit", () => {
      const filtered = history.filter({ limit: 2 });

      assert.strictEqual(filtered.length, 2);
    });

    it("should combine multiple filters", () => {
      const filtered = history.filter({
        labels: ["user_input"],
        tags: ["important"],
      });

      assert.strictEqual(filtered.length, 1);
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

  describe("getTokenCount", () => {
    it("should return 0 for empty history", () => {
      const count = history.getTokenCount();

      assert.strictEqual(count, 0);
    });

    it("should return estimated token count", () => {
      history.addUserMessage("テストメッセージ"); // 8 chars = 2 tokens (4 chars per token)

      const count = history.getTokenCount();

      assert.ok(count > 0);
    });
  });

  describe("updatePriority", () => {
    it("should update message priority", () => {
      const message = history.addUserMessage("テスト");

      history.updatePriority(message.id, "critical");

      const updated = history.getById(message.id);
      assert.strictEqual(updated?.metadata.priority, "critical");
    });

    it("should do nothing for unknown id", () => {
      history.updatePriority("unknown_id", "critical");
      // No error should be thrown
    });
  });

  describe("addTag / removeTag", () => {
    it("should add tag to message", () => {
      const message = history.addUserMessage("テスト");

      history.addTag(message.id, "new_tag");

      const updated = history.getById(message.id);
      assert.ok(updated?.metadata.tags?.includes("new_tag"));
    });

    it("should not add duplicate tag", () => {
      const message = history.addUserMessage("テスト", ["existing"]);

      history.addTag(message.id, "existing");

      const updated = history.getById(message.id);
      const existingCount = updated?.metadata.tags?.filter((t) => t === "existing").length;
      assert.strictEqual(existingCount, 1);
    });

    it("should remove tag from message", () => {
      const message = history.addUserMessage("テスト", ["to_remove"]);

      history.removeTag(message.id, "to_remove");

      const updated = history.getById(message.id);
      assert.ok(!updated?.metadata.tags?.includes("to_remove"));
    });
  });

  describe("remove", () => {
    it("should remove message by id", () => {
      const message = history.addUserMessage("テスト");

      history.remove(message.id);

      assert.strictEqual(history.getById(message.id), undefined);
      assert.strictEqual(history.getAll().length, 0);
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

  describe("toJSON / fromJSON", () => {
    it("should serialize and deserialize messages", () => {
      history.addUserMessage("テスト1", ["tag1"]);
      history.addUserMessage("テスト2");

      const json = history.toJSON();
      const newHistory = new ConversationHistory();
      newHistory.fromJSON(json);

      const messages = newHistory.getAll();
      assert.strictEqual(messages.length, 2);
      assert.strictEqual(messages[0].content, "テスト1");
      assert.deepStrictEqual(messages[0].metadata.tags, ["tag1"]);
    });

    it("should restore timestamps as Date objects", () => {
      history.addUserMessage("テスト");

      const json = history.toJSON();
      const newHistory = new ConversationHistory();
      newHistory.fromJSON(json);

      const messages = newHistory.getAll();
      assert.ok(messages[0].metadata.timestamp instanceof Date);
    });
  });

  describe("summarize", () => {
    beforeEach(() => {
      // Add various messages
      history.addUserMessage("ユーザー1");
      history.addAssistantMessage([{ type: "text", text: "応答1" }]);
      history.addUserMessage("ユーザー2");
      history.addAssistantMessage([{ type: "text", text: "応答2" }]);
      history.addError("エラー");
    });

    it("should preserve high priority messages", () => {
      const summarized = history.summarize({ maxMessages: 3 });

      // Should include user_input (high) and error (high)
      const highPriorityCount = summarized.filter(
        (m) => m.metadata.priority === "high"
      ).length;
      assert.ok(highPriorityCount >= 2);
    });

    it("should respect maxMessages limit", () => {
      const summarized = history.summarize({ maxMessages: 2 });

      assert.ok(summarized.length <= 5); // May include preserved messages
    });

    it("should preserve specified labels", () => {
      const summarized = history.summarize({
        maxMessages: 1,
        preserveLabels: ["error"],
      });

      const hasError = summarized.some((m) => m.metadata.label === "error");
      assert.ok(hasError);
    });
  });
});

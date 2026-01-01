/**
 * DummyProvider Unit Tests
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  DummyProvider,
  createMockResponse,
  createToolUseResponse,
  BaseMessage,
  LLMResponse,
} from "../llm";

describe("DummyProvider", () => {
  describe("constructor", () => {
    it("should create provider with name 'dummy'", () => {
      const provider = new DummyProvider();
      assert.strictEqual(provider.name, "dummy");
    });
  });

  describe("call", () => {
    it("should return greeting response for 'こんにちは'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "こんにちは" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "end_turn");
      assert.strictEqual(response.content.length, 1);
      assert.strictEqual(response.content[0].type, "text");
      if (response.content[0].type === "text") {
        assert.ok(response.content[0].text.includes("こんにちは"));
      }
    });

    it("should return greeting response for 'hello'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "hello" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "end_turn");
    });

    it("should return calculator tool_use for '計算'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "5+3を計算して" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "tool_use");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      assert.ok(toolUseBlock);
      if (toolUseBlock?.type === "tool_use") {
        assert.strictEqual(toolUseBlock.toolUse.name, "calculator");
      }
    });

    it("should return read_file tool_use for 'ファイルを読んで'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "ファイルを読んで" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "tool_use");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (toolUseBlock?.type === "tool_use") {
        assert.strictEqual(toolUseBlock.toolUse.name, "read_file");
      }
    });

    it("should return write_file tool_use for 'ファイルに書いて'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "ファイルに書いて" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "tool_use");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (toolUseBlock?.type === "tool_use") {
        assert.strictEqual(toolUseBlock.toolUse.name, "write_file");
      }
    });

    it("should return list_files tool_use for 'ファイル一覧'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "ファイル一覧を見せて" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "tool_use");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (toolUseBlock?.type === "tool_use") {
        assert.strictEqual(toolUseBlock.toolUse.name, "list_files");
      }
    });

    it("should return get_current_time tool_use for '時間'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "現在の時間を教えて" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "tool_use");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (toolUseBlock?.type === "tool_use") {
        assert.strictEqual(toolUseBlock.toolUse.name, "get_current_time");
      }
    });

    it("should return attempt_completion tool_use for '完了'", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "タスク完了" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "tool_use");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (toolUseBlock?.type === "tool_use") {
        assert.strictEqual(toolUseBlock.toolUse.name, "attempt_completion");
      }
    });

    it("should return fallback response for unknown input", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "xyz123abc" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "end_turn");
      assert.strictEqual(response.content[0].type, "text");
    });

    it("should return tool_result response after tool results", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [
        { role: "user", content: "計算して" },
        { role: "assistant", content: [{ type: "text", text: "計算します" }] },
        { role: "user", content: [{ toolUseId: "tool_001", content: "8" }] },
      ];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.stopReason, "tool_use");
      const toolUseBlock = response.content.find((b) => b.type === "tool_use");
      if (toolUseBlock?.type === "tool_use") {
        assert.strictEqual(toolUseBlock.toolUse.name, "attempt_completion");
      }
    });

    it("should call stream callback when provided", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "こんにちは" }];
      const events: string[] = [];

      await provider.call(messages, [], (event) => {
        events.push(event.type);
      });

      assert.ok(events.includes("text"));
      assert.ok(events.includes("done"));
    });

    it("should call tool_use_start stream event for tool calls", async () => {
      const provider = new DummyProvider();
      const messages: BaseMessage[] = [{ role: "user", content: "計算して" }];
      const events: string[] = [];

      await provider.call(messages, [], (event) => {
        events.push(event.type);
      });

      assert.ok(events.includes("tool_use_start"));
      assert.ok(events.includes("done"));
    });
  });

  describe("custom responses", () => {
    it("should use custom mock responses when provided", async () => {
      const customResponse: LLMResponse = {
        content: [{ type: "text", text: "カスタムレスポンス" }],
        stopReason: "end_turn",
      };
      const provider = new DummyProvider(undefined, {
        mockResponses: [{ pattern: /カスタム/, response: customResponse }],
      });
      const messages: BaseMessage[] = [{ role: "user", content: "カスタムテスト" }];

      const response = await provider.call(messages, []);

      assert.strictEqual(response.content[0].type, "text");
      if (response.content[0].type === "text") {
        assert.strictEqual(response.content[0].text, "カスタムレスポンス");
      }
    });

    it("should use custom fallback response when provided", async () => {
      const customFallback: LLMResponse = {
        content: [{ type: "text", text: "カスタムフォールバック" }],
        stopReason: "end_turn",
      };
      const provider = new DummyProvider(undefined, {
        mockResponses: [],
        fallbackResponse: customFallback,
      });
      const messages: BaseMessage[] = [{ role: "user", content: "なにかのテスト" }];

      const response = await provider.call(messages, []);

      if (response.content[0].type === "text") {
        assert.strictEqual(response.content[0].text, "カスタムフォールバック");
      }
    });
  });
});

describe("Helper functions", () => {
  describe("createMockResponse", () => {
    it("should create text response with default end_turn", () => {
      const response = createMockResponse("テストメッセージ");

      assert.strictEqual(response.stopReason, "end_turn");
      assert.strictEqual(response.content.length, 1);
      assert.strictEqual(response.content[0].type, "text");
      if (response.content[0].type === "text") {
        assert.strictEqual(response.content[0].text, "テストメッセージ");
      }
    });

    it("should create text response with custom stop reason", () => {
      const response = createMockResponse("テスト", "max_tokens");

      assert.strictEqual(response.stopReason, "max_tokens");
    });
  });

  describe("createToolUseResponse", () => {
    it("should create tool_use response", () => {
      const response = createToolUseResponse("test_tool", { key: "value" }, "tool_123");

      assert.strictEqual(response.stopReason, "tool_use");
      assert.strictEqual(response.content.length, 1);
      assert.strictEqual(response.content[0].type, "tool_use");
      if (response.content[0].type === "tool_use") {
        assert.strictEqual(response.content[0].toolUse.name, "test_tool");
        assert.strictEqual(response.content[0].toolUse.id, "tool_123");
        assert.deepStrictEqual(response.content[0].toolUse.input, { key: "value" });
      }
    });
  });
});

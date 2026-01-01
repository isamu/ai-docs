/**
 * Tools Unit Tests
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFile, mkdir, rm } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { getToolDefinitions, executeTool, getToolNames } from "../src/tools";

const TEST_WORKSPACE = path.join(process.cwd(), "workspace");
const TEST_FILE = "test_file.txt";
const TEST_FILE_CONTENT = "テストファイルの内容";

describe("Tools", () => {
  before(async () => {
    // テスト用ワークスペースを作成
    if (!existsSync(TEST_WORKSPACE)) {
      await mkdir(TEST_WORKSPACE, { recursive: true });
    }
    // テストファイルを作成
    await writeFile(path.join(TEST_WORKSPACE, TEST_FILE), TEST_FILE_CONTENT, "utf-8");
  });

  after(async () => {
    // テストファイルを削除
    const testFilePath = path.join(TEST_WORKSPACE, TEST_FILE);
    if (existsSync(testFilePath)) {
      await rm(testFilePath);
    }
    // 出力ファイルも削除
    const outputPath = path.join(TEST_WORKSPACE, "output.txt");
    if (existsSync(outputPath)) {
      await rm(outputPath);
    }
  });

  describe("getToolDefinitions", () => {
    it("should return array of tool definitions", () => {
      const definitions = getToolDefinitions();

      assert.ok(Array.isArray(definitions));
      assert.ok(definitions.length > 0);
    });

    it("should include required tools", () => {
      const definitions = getToolDefinitions();
      const toolNames = definitions.map((d) => d.name);

      assert.ok(toolNames.includes("read_file"));
      assert.ok(toolNames.includes("write_file"));
      assert.ok(toolNames.includes("list_files"));
      assert.ok(toolNames.includes("calculator"));
      assert.ok(toolNames.includes("get_current_time"));
      assert.ok(toolNames.includes("attempt_completion"));
    });

    it("should have name and description for each tool", () => {
      const definitions = getToolDefinitions();

      definitions.forEach((def) => {
        assert.ok(typeof def.name === "string");
        assert.ok(def.name.length > 0);
        assert.ok(typeof def.description === "string");
        assert.ok(def.description.length > 0);
      });
    });

    it("should have inputSchema for each tool", () => {
      const definitions = getToolDefinitions();

      definitions.forEach((def) => {
        assert.ok(def.inputSchema);
        assert.strictEqual(def.inputSchema.type, "object");
      });
    });
  });

  describe("getToolNames", () => {
    it("should return array of tool names", () => {
      const names = getToolNames();

      assert.ok(Array.isArray(names));
      assert.ok(names.length > 0);
      names.forEach((name) => {
        assert.ok(typeof name === "string");
      });
    });
  });

  describe("executeTool", () => {
    describe("read_file", () => {
      it("should read file content", async () => {
        const result = await executeTool("read_file", { path: TEST_FILE });

        assert.strictEqual(result, TEST_FILE_CONTENT);
      });

      it("should return error for non-existent file", async () => {
        const result = await executeTool("read_file", { path: "non_existent.txt" });

        assert.ok(result.includes("エラー"));
        assert.ok(result.includes("見つかりません"));
      });

      it("should return error for path outside workspace", async () => {
        const result = await executeTool("read_file", { path: "../outside.txt" });

        assert.ok(result.includes("エラー"));
        assert.ok(result.includes("ワークスペース外"));
      });
    });

    describe("write_file", () => {
      it("should write file content", async () => {
        const content = "書き込みテスト";
        const result = await executeTool("write_file", {
          path: "output.txt",
          content,
        });

        assert.ok(result.includes("書き込みました"));
      });

      it("should return error for path outside workspace", async () => {
        const result = await executeTool("write_file", {
          path: "../outside.txt",
          content: "テスト",
        });

        assert.ok(result.includes("エラー"));
        assert.ok(result.includes("ワークスペース外"));
      });
    });

    describe("list_files", () => {
      it("should list files in workspace", async () => {
        const result = await executeTool("list_files", {});

        assert.ok(result.includes(TEST_FILE));
      });

      it("should return error for non-existent directory", async () => {
        const result = await executeTool("list_files", { path: "non_existent_dir" });

        assert.ok(result.includes("エラー"));
      });

      it("should return error for path outside workspace", async () => {
        const result = await executeTool("list_files", { path: "../" });

        assert.ok(result.includes("エラー"));
        assert.ok(result.includes("ワークスペース外"));
      });
    });

    describe("calculator", () => {
      it("should calculate simple addition", async () => {
        const result = await executeTool("calculator", { expression: "5 + 3" });

        assert.strictEqual(result, "8");
      });

      it("should calculate subtraction", async () => {
        const result = await executeTool("calculator", { expression: "10 - 4" });

        assert.strictEqual(result, "6");
      });

      it("should calculate multiplication", async () => {
        const result = await executeTool("calculator", { expression: "6 * 7" });

        assert.strictEqual(result, "42");
      });

      it("should calculate division", async () => {
        const result = await executeTool("calculator", { expression: "20 / 4" });

        assert.strictEqual(result, "5");
      });

      it("should handle parentheses", async () => {
        const result = await executeTool("calculator", { expression: "(2 + 3) * 4" });

        assert.strictEqual(result, "20");
      });

      it("should handle decimals", async () => {
        const result = await executeTool("calculator", { expression: "3.5 + 1.5" });

        assert.strictEqual(result, "5");
      });

      it("should return error for invalid characters", async () => {
        const result = await executeTool("calculator", { expression: "5 + abc" });

        assert.ok(result.includes("エラー"));
        assert.ok(result.includes("使用できない文字"));
      });
    });

    describe("get_current_time", () => {
      it("should return current time string", async () => {
        const result = await executeTool("get_current_time", {});

        // 日本語形式の日時文字列を検証
        assert.ok(result.includes("/"));
        assert.ok(result.includes(":"));
      });
    });

    describe("attempt_completion", () => {
      it("should return result message", async () => {
        const result = await executeTool("attempt_completion", {
          result: "タスク完了",
        });

        assert.strictEqual(result, "タスク完了");
      });
    });

    describe("unknown tool", () => {
      it("should return error for unknown tool", async () => {
        const result = await executeTool("unknown_tool", {});

        assert.ok(result.includes("エラー"));
        assert.ok(result.includes("不明なツール"));
      });
    });
  });
});

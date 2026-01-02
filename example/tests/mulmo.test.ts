/**
 * MulmoScript Unit Tests
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { unlink, readFile } from "fs/promises";
import path from "path";
import {
  createMulmoScript,
  validateMulmoScript,
  formatValidationErrors,
  MulmoScriptInputSchema,
  createBeatsOnMulmoScriptTool,
  validateMulmoScriptTool,
} from "../src/tasks/definitions/mulmo";
import { AgentContext } from "../src/context";
import { startSessionTool } from "../src/tools/session";

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

describe("MulmoScript Schema", () => {
  describe("createMulmoScript", () => {
    it("should create script with minimal input", () => {
      const input = {
        title: "テスト動画",
        beats: [{ text: "こんにちは" }],
      };

      const script = createMulmoScript(input);

      assert.strictEqual(script.title, "テスト動画");
      assert.strictEqual(script.beats.length, 1);
      assert.strictEqual(script.beats[0].text, "こんにちは");
      // mulmocast format: speaker is optional, defaults to "Presenter"
      assert.ok(script.speechParams.speakers["Presenter"]);
    });

    it("should set default values", () => {
      const input = {
        title: "テスト",
        beats: [{ text: "テスト" }],
      };

      const script = createMulmoScript(input);

      // mulmocast format uses $mulmocast.version
      assert.strictEqual(script.$mulmocast.version, "1.1");
      assert.strictEqual(script.lang, "ja");
      // mulmocast uses canvasSize instead of config.aspectRatio
      assert.strictEqual(script.canvasSize.width, 1920);
      assert.strictEqual(script.canvasSize.height, 1080);
    });

    it("should auto-generate speaker entries", () => {
      const input = {
        title: "対話動画",
        beats: [
          { text: "こんにちは", speaker: "alice" },
          { text: "やあ", speaker: "bob" },
          { text: "元気？", speaker: "alice" },
        ],
      };

      const script = createMulmoScript(input);

      // mulmocast format uses speechParams.speakers
      assert.ok(script.speechParams.speakers["alice"]);
      assert.ok(script.speechParams.speakers["bob"]);
      assert.ok(script.speechParams.speakers["alice"].voiceId);
      assert.ok(script.speechParams.speakers["bob"].voiceId);
    });

    it("should preserve imagePrompt and moviePrompt", () => {
      const input = {
        title: "ビジュアル動画",
        beats: [
          { text: "宇宙の景色", imagePrompt: "beautiful space scene with stars" },
          { text: "ロケット発射", moviePrompt: "rocket launching from earth" },
        ],
      };

      const script = createMulmoScript(input);

      assert.strictEqual(script.beats[0].imagePrompt, "beautiful space scene with stars");
      assert.strictEqual(script.beats[1].moviePrompt, "rocket launching from earth");
    });

    it("should use provided aspectRatio", () => {
      const input = {
        title: "縦動画",
        beats: [{ text: "テスト" }],
        aspectRatio: "9:16" as const,
      };

      const script = createMulmoScript(input);

      // mulmocast uses canvasSize for 9:16 aspect ratio
      assert.strictEqual(script.canvasSize.width, 1080);
      assert.strictEqual(script.canvasSize.height, 1920);
    });
  });

  describe("validateMulmoScript", () => {
    it("should pass valid script", () => {
      const script = createMulmoScript({
        title: "テスト",
        beats: [{ text: "テスト" }],
      });

      const result = validateMulmoScript(script);

      assert.strictEqual(result.success, true);
      assert.ok(result.data);
    });

    it("should fail without title", () => {
      const result = validateMulmoScript({
        beats: [{ text: "テスト" }],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
    });

    it("should fail with empty beats", () => {
      const result = validateMulmoScript({
        title: "テスト",
        beats: [],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
    });

    it("should fail with beat without text", () => {
      const result = validateMulmoScript({
        title: "テスト",
        beats: [{ speaker: "narrator" }],
      });

      assert.strictEqual(result.success, false);
      assert.ok(result.errors);
    });
  });

  describe("formatValidationErrors", () => {
    it("should format errors as readable string", () => {
      const result = validateMulmoScript({
        title: "",
        beats: [],
      });

      assert.strictEqual(result.success, false);
      const formatted = formatValidationErrors(result.errors!);

      assert.ok(formatted.includes("-"));
      assert.ok(formatted.length > 0);
    });
  });

  describe("MulmoScriptInputSchema", () => {
    it("should parse valid input", () => {
      const input = {
        title: "テスト",
        beats: [{ text: "こんにちは" }],
      };

      const result = MulmoScriptInputSchema.safeParse(input);

      assert.strictEqual(result.success, true);
    });

    it("should allow optional fields", () => {
      const input = {
        title: "テスト",
        beats: [
          {
            text: "こんにちは",
            speaker: "narrator",
            imagePrompt: "test prompt",
          },
        ],
        description: "説明",
        lang: "en",
      };

      const result = MulmoScriptInputSchema.safeParse(input);

      assert.strictEqual(result.success, true);
    });
  });
});

describe("MulmoScript Tools", () => {
  let context: AgentContext;
  let createdFiles: string[] = [];

  beforeEach(async () => {
    context = new AgentContext();
  });

  afterEach(async () => {
    // Clean up created files
    for (const file of createdFiles) {
      try {
        await unlink(file);
      } catch {
        // Ignore errors
      }
    }
    createdFiles = [];
  });

  describe("createBeatsOnMulmoScript", () => {
    it("should have correct definition", () => {
      assert.strictEqual(createBeatsOnMulmoScriptTool.definition.name, "createBeatsOnMulmoScript");
      assert.ok(createBeatsOnMulmoScriptTool.definition.description.includes("MulmoScript"));
    });

    it("should return error without active session", async () => {
      const result = await createBeatsOnMulmoScriptTool.execute(
        {
          title: "テスト",
          beats: [{ text: "こんにちは" }],
        },
        context
      );

      assert.ok(result.includes("エラー"));
      assert.ok(result.includes("アクティブなセッション"));
    });

    it("should create script file with valid input", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト動画作成" },
        context
      );

      const result = await createBeatsOnMulmoScriptTool.execute(
        {
          title: "宇宙への旅",
          beats: [
            { text: "宇宙は広大です", imagePrompt: "vast space with galaxies" },
            { text: "星がきらめいています", imagePrompt: "twinkling stars in night sky" },
          ],
        },
        context
      );

      assert.ok(result.includes("MulmoScript作成完了"));
      assert.ok(result.includes("宇宙への旅"));
      assert.ok(result.includes("ビート数: 2"));

      // Find created file path
      const pathMatch = result.match(/パス: (.+\.json)/);
      if (pathMatch) {
        createdFiles.push(pathMatch[1]);

        // Verify file content
        const content = await readFile(pathMatch[1], "utf-8");
        const script = JSON.parse(content);

        assert.strictEqual(script.title, "宇宙への旅");
        assert.strictEqual(script.beats.length, 2);
        assert.strictEqual(script.beats[0].text, "宇宙は広大です");
      }
    });

    it("should update session artifacts", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト" },
        context
      );

      const result = await createBeatsOnMulmoScriptTool.execute(
        {
          title: "アーティファクトテスト",
          beats: [{ text: "テスト" }],
        },
        context
      );

      const pathMatch = result.match(/パス: (.+\.json)/);
      if (pathMatch) {
        createdFiles.push(pathMatch[1]);
      }

      const session = context.getActiveSession();
      const state = session?.state as { artifacts: string[] };
      assert.ok(state.artifacts.length > 0);
    });

    it("should return error for invalid input", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト" },
        context
      );

      const result = await createBeatsOnMulmoScriptTool.execute(
        {
          title: "",
          beats: [],
        },
        context
      );

      assert.ok(result.includes("入力エラー") || result.includes("エラー"));
    });
  });

  describe("validateMulmoScriptTool", () => {
    it("should have correct definition", () => {
      assert.strictEqual(validateMulmoScriptTool.definition.name, "validate_mulmo");
    });

    it("should validate existing script file", async () => {
      // First create a script
      await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト" },
        context
      );

      const createResult = await createBeatsOnMulmoScriptTool.execute(
        {
          title: "バリデーションテスト",
          beats: [{ text: "テストナレーション" }],
        },
        context
      );

      const pathMatch = createResult.match(/パス: (.+\.json)/);
      if (pathMatch) {
        createdFiles.push(pathMatch[1]);

        // Now validate it
        const validateResult = await validateMulmoScriptTool.execute(
          { path: pathMatch[1] },
          context
        );

        assert.ok(validateResult.includes("バリデーション成功"));
        assert.ok(validateResult.includes("バリデーションテスト"));
      }
    });

    it("should return error for non-existent file", async () => {
      const result = await validateMulmoScriptTool.execute(
        { path: "/nonexistent/path.json" },
        context
      );

      assert.ok(result.includes("エラー"));
    });
  });
});

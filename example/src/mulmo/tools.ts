/**
 * MulmoScript Tools
 * MulmoScript作成用のLLMツール
 */

import { writeFile } from "fs/promises";
import path from "path";
import { ContextAwareToolDefinition } from "../tools/types";
import {
  createMulmoScript,
  validateMulmoScript,
  formatValidationErrors,
  MulmoScriptInputSchema,
  MulmoScript,
} from "./schema";
import { TaskSessionState } from "../tasks";

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

/**
 * createBeatsOnMulmoScript - ビートからMulmoScriptを作成
 */
export const createBeatsOnMulmoScriptTool: ContextAwareToolDefinition = {
  definition: {
    name: "createBeatsOnMulmoScript",
    description: `MulmoScriptをビート配列から作成します。ヒアリング完了後、このツールでスクリプトを生成してください。

各ビートは1つのナレーションシーンを表します。
- text: ナレーションのテキスト（必須）
- speaker: 話者ID（省略時は"narrator"）
- imagePrompt: 画像生成用のプロンプト（英語推奨）
- moviePrompt: 動画生成用のプロンプト（英語推奨）

imagePromptとmoviePromptは排他的です（同時に指定しないでください）。`,
    inputSchema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "スクリプトのタイトル",
        },
        beats: {
          type: "array",
          description: "ビート（シーン）の配列",
          items: {
            type: "object",
            required: ["text"],
            properties: {
              text: {
                type: "string",
                description: "ナレーションテキスト",
              },
              speaker: {
                type: "string",
                description: "話者ID（省略時は'narrator'）",
              },
              imagePrompt: {
                type: "string",
                description: "画像生成プロンプト（moviePromptと排他）",
              },
              moviePrompt: {
                type: "string",
                description: "動画生成プロンプト（imagePromptと排他）",
              },
            },
          },
        },
        description: {
          type: "string",
          description: "スクリプトの説明（省略可）",
        },
        aspectRatio: {
          type: "string",
          enum: ["16:9", "9:16", "1:1", "4:3"],
          description: "アスペクト比（デフォルト: 16:9）",
        },
      },
      required: ["title", "beats"],
    },
  },
  execute: async (input, context) => {
    const session = context.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません。まずstart_sessionでmulmoタスクを開始してください。";
    }

    try {
      // 入力をパース
      const parseResult = MulmoScriptInputSchema.safeParse({
        title: input.title,
        beats: input.beats,
        description: input.description,
        aspectRatio: input.aspectRatio,
      });

      if (!parseResult.success) {
        return `入力エラー:\n${formatValidationErrors(parseResult.error)}`;
      }

      // MulmoScriptを作成（mulmocastスキーマで整形・検証）
      const script = createMulmoScript(parseResult.data);

      // 作成後に再度バリデート（二重チェック）
      const validationResult = validateMulmoScript(script);
      if (!validationResult.success) {
        return `バリデーションエラー:\n${formatValidationErrors(validationResult.errors!)}`;
      }

      // ファイル名を生成（タイトルをスラッグ化）
      const slug = script.title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
      const filename = `${slug}_${Date.now()}.mulmo.json`;
      const filepath = path.join(WORKSPACE_DIR, filename);

      // JSONファイルを保存
      await writeFile(filepath, JSON.stringify(script, null, 2), "utf-8");

      // セッション状態を更新（スクリプト情報を保存）
      const state = session.state as TaskSessionState;
      const newState: TaskSessionState = {
        ...state,
        artifacts: [...state.artifacts, filepath],
      };
      context.updateSessionState(newState);

      // 結果を返す
      const beatSummary = script.beats
        .map((b, i) => `  ${i + 1}. [${b.speaker ?? "Presenter"}] ${(b.text ?? "").slice(0, 30)}...`)
        .join("\n");

      const { width, height } = script.canvasSize;
      const aspectRatio = width > height ? "16:9" : height > width ? "9:16" : "1:1";

      return `MulmoScript作成完了！ ✅ バリデーション済み

📄 ファイル: ${filename}
📁 パス: ${filepath}

📋 内容:
- タイトル: ${script.title}
- ビート数: ${script.beats.length}
- キャンバス: ${width}x${height} (${aspectRatio})
- 言語: ${script.lang}
- バージョン: ${script.$mulmocast.version}

🎬 ビート:
${beatSummary}

スクリプトはmulmocastパッケージのスキーマで検証済みです。`;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `エラー: スクリプト作成に失敗しました\n${message}`;
    }
  },
};

/**
 * validateMulmoScript - MulmoScriptをバリデート
 */
export const validateMulmoScriptTool: ContextAwareToolDefinition = {
  definition: {
    name: "validate_mulmo",
    description: "保存済みのMulmoScriptファイルをバリデートします。mulmocastパッケージのスキーマで検証します。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "バリデートするファイルのパス",
        },
      },
      required: ["path"],
    },
  },
  execute: async (input, _context) => {
    const filepath = input.path as string;
    const { readFile } = await import("fs/promises");

    try {
      const content = await readFile(filepath, "utf-8");
      const json = JSON.parse(content);

      const result = validateMulmoScript(json);

      if (result.success) {
        const script = result.data!;
        const { width, height } = script.canvasSize;
        const aspectRatio = width > height ? "16:9" : height > width ? "9:16" : "1:1";
        const speakers = Object.keys(script.speechParams.speakers);

        return `✅ バリデーション成功！ (mulmocast v${script.$mulmocast.version})

📄 ファイル: ${filepath}
- タイトル: ${script.title}
- ビート数: ${script.beats.length}
- 話者: ${speakers.join(", ")}
- キャンバス: ${width}x${height} (${aspectRatio})
- 言語: ${script.lang}

スクリプトはmulmocastスキーマに準拠しています。`;
      } else {
        return `❌ バリデーションエラー:\n${formatValidationErrors(result.errors!)}`;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `エラー: ファイル読み込みに失敗しました\n${message}`;
    }
  },
};

// 全MulmoScriptツール
export const mulmoTools: ContextAwareToolDefinition[] = [
  createBeatsOnMulmoScriptTool,
  validateMulmoScriptTool,
];

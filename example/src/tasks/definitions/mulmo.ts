/**
 * MulmoScript Task Definition
 *
 * MulmoScript形式の動画スクリプトを作成するタスク
 */

import { z } from "zod";
import { writeFile } from "fs/promises";
import path from "path";
import {
  MulmoScriptMethods,
  type MulmoScript,
  type MulmoBeat,
} from "mulmocast";
import { TaskSessionState, defineTask } from "../types";
import { defineTool } from "../../tools/types";

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

// ============================================================
// スキーマ定義
// ============================================================

/**
 * LLMからの簡易入力用スキーマ
 */
const MulmoScriptInputSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  beats: z
    .array(
      z.object({
        text: z.string().min(1, "テキストは必須です"),
        speaker: z.string().optional(),
        imagePrompt: z.string().optional(),
        moviePrompt: z.string().optional(),
      })
    )
    .min(1, "最低1つのビートが必要です"),
  description: z.string().optional(),
  lang: z.string().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).optional(),
});

type MulmoScriptInput = z.infer<typeof MulmoScriptInputSchema>;

/**
 * 入力からMulmoScriptを作成
 */
function createMulmoScript(input: MulmoScriptInput): MulmoScript {
  const beats: MulmoBeat[] = input.beats.map((beat) => ({
    text: beat.text,
    speaker: beat.speaker,
    imagePrompt: beat.imagePrompt,
    moviePrompt: beat.moviePrompt,
  }));

  const canvasSizes: Record<string, { width: number; height: number }> = {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
    "4:3": { width: 1440, height: 1080 },
  };

  const aspectRatio = input.aspectRatio ?? "16:9";
  const canvasSize = canvasSizes[aspectRatio];

  const speakerIds = new Set(beats.map((b) => b.speaker ?? "Presenter"));
  const speakers: Record<string, { voiceId: string; isDefault?: boolean }> = {};
  speakerIds.forEach((speakerId) => {
    speakers[speakerId] = {
      voiceId: speakerId === "Presenter" ? "ja-JP-Wavenet-B" : "ja-JP-Wavenet-A",
      isDefault: speakerId === "Presenter" ? true : undefined,
    };
  });

  const scriptData = {
    $mulmocast: { version: "1.1" as const },
    title: input.title,
    description: input.description,
    lang: input.lang ?? "ja",
    canvasSize,
    speechParams: { speakers },
    beats,
  };

  return MulmoScriptMethods.validate(scriptData);
}

/**
 * MulmoScriptをバリデート
 */
function validateMulmoScript(script: unknown): {
  success: boolean;
  data?: MulmoScript;
  errors?: z.ZodError;
} {
  try {
    const validated = MulmoScriptMethods.validate(script);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error };
    }
    const zodError = new z.ZodError([
      {
        code: "custom",
        path: [],
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
    return { success: false, errors: zodError };
  }
}

/**
 * バリデーションエラーをフォーマット
 */
function formatValidationErrors(errors: z.ZodError): string {
  return errors.issues.map((e) => `- ${e.path.join(".")}: ${e.message}`).join("\n");
}

// ============================================================
// ツール定義
// ============================================================

/**
 * createBeatsOnMulmoScript - ビートからMulmoScriptを作成
 */
const createBeatsOnMulmoScriptTool = defineTool({
  definition: {
    name: "createBeatsOnMulmoScript",
    description: `MulmoScriptをビート配列から作成します。ヒアリング完了後、このツールでスクリプトを生成してください。

各ビートは1つのナレーションシーンを表します。
- text: ナレーションのテキスト（必須）
- speaker: 話者ID（省略時は"Presenter"）
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
              text: { type: "string", description: "ナレーションテキスト" },
              speaker: { type: "string", description: "話者ID（省略時は'Presenter'）" },
              imagePrompt: { type: "string", description: "画像生成プロンプト" },
              moviePrompt: { type: "string", description: "動画生成プロンプト" },
            },
          },
        },
        description: { type: "string", description: "スクリプトの説明（省略可）" },
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
    const session = context?.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません。まずstart_sessionでmulmoタスクを開始してください。";
    }

    try {
      const parseResult = MulmoScriptInputSchema.safeParse({
        title: input.title,
        beats: input.beats,
        description: input.description,
        aspectRatio: input.aspectRatio,
      });

      if (!parseResult.success) {
        return `入力エラー:\n${formatValidationErrors(parseResult.error)}`;
      }

      const script = createMulmoScript(parseResult.data);

      const validationResult = validateMulmoScript(script);
      if (!validationResult.success) {
        return `バリデーションエラー:\n${formatValidationErrors(validationResult.errors!)}`;
      }

      const slug = script.title
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);
      const filename = `${slug}_${Date.now()}.mulmo.json`;
      const filepath = path.join(WORKSPACE_DIR, filename);

      await writeFile(filepath, JSON.stringify(script, null, 2), "utf-8");

      const state = session.state as TaskSessionState;
      context!.updateSessionState({
        ...state,
        artifacts: [...state.artifacts, filepath],
      });

      const beatSummary = script.beats
        .map((b, i) => `  ${i + 1}. [${b.speaker ?? "Presenter"}] ${(b.text ?? "").slice(0, 30)}...`)
        .join("\n");

      const { width, height } = script.canvasSize;
      const ar = width > height ? "16:9" : height > width ? "9:16" : "1:1";

      return `MulmoScript作成完了！ ✅ バリデーション済み

📄 ファイル: ${filename}
📁 パス: ${filepath}

📋 内容:
- タイトル: ${script.title}
- ビート数: ${script.beats.length}
- キャンバス: ${width}x${height} (${ar})
- 言語: ${script.lang}
- バージョン: ${script.$mulmocast.version}

🎬 ビート:
${beatSummary}

スクリプトはmulmocastスキーマで検証済みです。`;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `エラー: スクリプト作成に失敗しました\n${message}`;
    }
  },
});

/**
 * validateMulmoScript - MulmoScriptをバリデート
 */
const validateMulmoScriptTool = defineTool({
  definition: {
    name: "validate_mulmo",
    description: "保存済みのMulmoScriptファイルをバリデートします。",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "バリデートするファイルのパス" },
      },
      required: ["path"],
    },
  },

  execute: async (input) => {
    const filepath = input.path as string;
    const { readFile } = await import("fs/promises");

    try {
      const content = await readFile(filepath, "utf-8");
      const json = JSON.parse(content);
      const result = validateMulmoScript(json);

      if (result.success) {
        const script = result.data!;
        const { width, height } = script.canvasSize;
        const ar = width > height ? "16:9" : height > width ? "9:16" : "1:1";
        const speakers = Object.keys(script.speechParams.speakers);

        return `✅ バリデーション成功！ (mulmocast v${script.$mulmocast.version})

📄 ファイル: ${filepath}
- タイトル: ${script.title}
- ビート数: ${script.beats.length}
- 話者: ${speakers.join(", ")}
- キャンバス: ${width}x${height} (${ar})
- 言語: ${script.lang}`;
      } else {
        return `❌ バリデーションエラー:\n${formatValidationErrors(result.errors!)}`;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return `エラー: ファイル読み込みに失敗しました\n${message}`;
    }
  },
});

// ============================================================
// タスクモジュール
// ============================================================

export const mulmoTaskModule = defineTask({
  config: {
    name: "mulmo",
    displayName: "MulmoScript作成",
    description: "MulmoScript形式の動画スクリプトを作成",
    goal: "完成したMulmoScriptファイル",
    defaultMode: "implementation",

    systemPrompt: `あなたはMulmoScript作成の専門家です。

## MulmoScriptについて
- JSON形式の動画スクリプトフォーマット
- beats配列でシーンごとのナレーションを定義
- 各beatにはtext（必須）、speaker、imagePrompt/moviePromptを指定

## 作成手順
1. ヒアリング: ユーザーの要望を詳しく聞く
2. スクリプト作成: createBeatsOnMulmoScriptでスクリプト生成
3. 検証: validate_mulmoでバリデーション`,

    enabledCoreTools: ["read_file", "list_files"],
    enabledTaskTools: ["createBeatsOnMulmoScript", "validate_mulmo"],

    phases: [
      {
        name: "planning",
        description: "ヒアリングと構成計画",
        goal: "ユーザー要望の把握とアウトライン作成",
        systemPrompt: `ユーザーの要望を詳しくヒアリングしてください。
- どんな動画を作りたいか
- 対象視聴者は誰か
- 動画の長さ・シーン数の希望
- 画風やトーンの希望

ヒアリング完了後、構成案を提示してください。`,
        requiresApproval: true,
        approvalPrompt: "この構成でMulmoScriptを作成してよろしいですか？",
      },
      {
        name: "writing",
        description: "スクリプト作成",
        goal: "MulmoScriptファイルの完成",
        systemPrompt: `【重要】createBeatsOnMulmoScriptツールを必ず使ってスクリプトを作成してください。
write_fileは使わないでください。createBeatsOnMulmoScriptがファイル保存も行います。

- 各シーンをbeatとして定義
- textには読み上げるナレーションを記載
- imagePromptまたはmoviePromptで画像/動画生成用プロンプトを英語で記載`,
        enabledTools: ["read_file", "createBeatsOnMulmoScript"],
      },
      {
        name: "validation",
        description: "検証と修正",
        goal: "エラーのない完成品",
        systemPrompt: `validate_mulmoで作成したスクリプトを検証してください。
修正が必要な場合はcreateBeatsOnMulmoScriptで再作成してください。`,
        enabledTools: ["read_file", "validate_mulmo", "createBeatsOnMulmoScript"],
      },
    ],

    completionCriteria: [
      "MulmoScriptファイルが作成されている",
      "バリデーションエラーがない",
      "ユーザーの要望を満たしている",
    ],
  },

  tools: [createBeatsOnMulmoScriptTool, validateMulmoScriptTool],
});

// エクスポート
export { createBeatsOnMulmoScriptTool, validateMulmoScriptTool };
export { createMulmoScript, validateMulmoScript, formatValidationErrors, MulmoScriptInputSchema };

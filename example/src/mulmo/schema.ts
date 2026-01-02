/**
 * MulmoScript Schema
 * mulmocastパッケージを使用してバリデーションと整形を行う
 */

import { z } from "zod";
import {
  mulmoScriptSchema,
  MulmoScriptMethods,
  type MulmoScript,
  type MulmoBeat,
} from "mulmocast";

// Re-export types from mulmocast
export { mulmoScriptSchema, MulmoScriptMethods };
export type { MulmoScript, MulmoBeat };

/**
 * LLMからの簡易入力用スキーマ
 * createBeatsOnMulmoScriptツールで受け取る入力形式
 */
export const MulmoScriptInputSchema = z.object({
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

export type MulmoScriptInput = z.infer<typeof MulmoScriptInputSchema>;

/**
 * 入力からMulmoScriptを作成（デフォルト値を補完）
 * mulmocastパッケージのMulmoScriptMethods.validateを使用
 */
export function createMulmoScript(input: MulmoScriptInput): MulmoScript {
  // ビートにIDを付与
  const beats: MulmoBeat[] = input.beats.map((beat) => ({
    text: beat.text,
    speaker: beat.speaker,
    imagePrompt: beat.imagePrompt,
    moviePrompt: beat.moviePrompt,
  }));

  // アスペクト比からキャンバスサイズを計算
  const canvasSizes: Record<string, { width: number; height: number }> = {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
    "4:3": { width: 1440, height: 1080 },
  };

  const aspectRatio = input.aspectRatio ?? "16:9";
  const canvasSize = canvasSizes[aspectRatio];

  // 話者を収集してspeechParamsを構築
  const speakerIds = new Set(beats.map((b) => b.speaker ?? "Presenter"));
  const speakers: Record<string, { voiceId: string; isDefault?: boolean }> = {};
  speakerIds.forEach((speakerId) => {
    speakers[speakerId] = {
      voiceId: speakerId === "Presenter" ? "ja-JP-Wavenet-B" : "ja-JP-Wavenet-A",
      isDefault: speakerId === "Presenter" ? true : undefined,
    };
  });

  // MulmoScript形式に変換
  const scriptData = {
    $mulmocast: {
      version: "1.1" as const,
    },
    title: input.title,
    description: input.description,
    lang: input.lang ?? "ja",
    canvasSize,
    speechParams: {
      speakers,
    },
    beats,
  };

  // mulmocast のバリデーターで整形・検証
  return MulmoScriptMethods.validate(scriptData);
}

/**
 * MulmoScriptをバリデート
 */
export function validateMulmoScript(script: unknown): {
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
    // Zodエラー以外はラップ
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
 * バリデーションエラーを人間が読める形式に変換
 */
export function formatValidationErrors(errors: z.ZodError): string {
  return errors.issues
    .map((e) => `- ${e.path.join(".")}: ${e.message}`)
    .join("\n");
}

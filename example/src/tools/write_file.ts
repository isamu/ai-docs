import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { ContextAwareToolDefinition } from "./types";

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

interface WriteFileInput {
  path: string;
  content: string;
}

const ERROR_MESSAGES = {
  OUTSIDE_WORKSPACE: "エラー: ワークスペース外のファイルには書き込めません",
  GENERIC: (message: string): string => `エラー: ${message}`,
} as const;

const SUCCESS_MESSAGE = (filePath: string): string => `✅ ファイルを書き込みました: ${filePath}`;

/**
 * タスクタイプごとの書き込み制限
 * 特定のタスクでは専用ツールの使用を強制
 */
const TASK_WRITE_RESTRICTIONS: Record<string, {
  message: string;
  suggestedTool: string;
  allowedExtensions?: string[];
}> = {
  mulmo: {
    message: "MulmoScriptの作成にはwrite_fileではなく専用ツールを使ってください",
    suggestedTool: "createBeatsOnMulmoScript",
    allowedExtensions: [], // mulmoタスクではwrite_file禁止
  },
};

export const writeFileTool: ContextAwareToolDefinition = {
  definition: {
    name: "write_file",
    description:
      "指定されたパスにコンテンツを書き込みます。既存のファイルは上書きされます。workspace/ディレクトリ内のみ書き込み可能です。",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "書き込むファイルのパス（workspace/からの相対パス、例: 'output.txt'）",
        },
        content: {
          type: "string",
          description: "ファイルに書き込む内容",
        },
      },
      required: ["path", "content"],
    },
  },

  async execute(rawInput: Record<string, unknown>, context): Promise<string> {
    const input = rawInput as unknown as WriteFileInput;

    // タスクコンテキストをチェック
    const session = context?.getActiveSession();
    if (session) {
      const restriction = TASK_WRITE_RESTRICTIONS[session.taskType];
      if (restriction) {
        const ext = path.extname(input.path).toLowerCase();
        const isAllowed = restriction.allowedExtensions?.includes(ext) ?? false;

        if (!isAllowed) {
          return `⚠️ ${restriction.message}

現在のタスク: ${session.taskType}
推奨ツール: ${restriction.suggestedTool}

${restriction.suggestedTool}ツールを使用してください。このツールは入力を検証し、正しい形式でファイルを生成します。`;
        }
      }
    }

    const filePath = path.resolve(WORKSPACE_DIR, input.path);

    if (!filePath.startsWith(WORKSPACE_DIR)) {
      return ERROR_MESSAGES.OUTSIDE_WORKSPACE;
    }

    try {
      const dirPath = path.dirname(filePath);
      if (!existsSync(dirPath)) {
        await mkdir(dirPath, { recursive: true });
      }

      await writeFile(filePath, input.content, "utf-8");
      console.log(`   結果: ${input.content.length}文字を書き込みました`);
      return SUCCESS_MESSAGE(input.path);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return ERROR_MESSAGES.GENERIC(message);
    }
  },
};

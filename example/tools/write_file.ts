import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { ToolDefinition } from "./types";

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

export const writeFileTool: ToolDefinition = {
  definition: {
    name: "write_file",
    description:
      "指定されたパスにコンテンツを書き込みます。既存のファイルは上書きされます。workspace/ディレクトリ内のみ書き込み可能です。",
    input_schema: {
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

  async execute(rawInput: Record<string, unknown>): Promise<string> {
    const input = rawInput as unknown as WriteFileInput;
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

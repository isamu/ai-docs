import { readFile } from "fs/promises";
import path from "path";
import { ToolDefinition } from "./types";

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

interface ReadFileInput {
  path: string;
}

const ERROR_MESSAGES = {
  OUTSIDE_WORKSPACE: "エラー: ワークスペース外のファイルにはアクセスできません",
  FILE_NOT_FOUND: (filePath: string): string => `エラー: ファイルが見つかりません: ${filePath}`,
  NO_PERMISSION: (filePath: string): string => `エラー: ファイルの読み取り権限がありません: ${filePath}`,
  GENERIC: (message: string): string => `エラー: ${message}`,
} as const;

interface FileSystemError extends Error {
  code?: string;
}

function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof Error && "code" in error;
}

export const readFileTool: ToolDefinition = {
  definition: {
    name: "read_file",
    description:
      "指定されたパスのファイルの内容を読み取ります。workspace/ディレクトリ内のファイルのみアクセス可能です。",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "読み取るファイルのパス（workspace/からの相対パス、例: 'example.txt'）",
        },
      },
      required: ["path"],
    },
  },

  async execute(rawInput: Record<string, unknown>): Promise<string> {
    const input = rawInput as unknown as ReadFileInput;
    const filePath = path.resolve(WORKSPACE_DIR, input.path);

    if (!filePath.startsWith(WORKSPACE_DIR)) {
      return ERROR_MESSAGES.OUTSIDE_WORKSPACE;
    }

    try {
      const content = await readFile(filePath, "utf-8");
      console.log(`   結果: ${content.length}文字を読み込みました`);
      return content;
    } catch (error: unknown) {
      if (!isFileSystemError(error)) {
        return ERROR_MESSAGES.GENERIC(String(error));
      }

      if (error.code === "ENOENT") {
        return ERROR_MESSAGES.FILE_NOT_FOUND(input.path);
      }
      if (error.code === "EACCES") {
        return ERROR_MESSAGES.NO_PERMISSION(input.path);
      }
      return ERROR_MESSAGES.GENERIC(error.message);
    }
  },
};

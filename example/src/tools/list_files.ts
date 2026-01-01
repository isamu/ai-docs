import { readdir } from "fs/promises";
import path from "path";
import { ToolDefinition } from "./types";

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");
const EMPTY_DIRECTORY_MESSAGE = "（空のディレクトリ）";

interface ListFilesInput {
  path?: string;
}

interface FileSystemError extends Error {
  code?: string;
}

function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof Error && "code" in error;
}

const ERROR_MESSAGES = {
  OUTSIDE_WORKSPACE: "エラー: ワークスペース外にはアクセスできません",
  DIRECTORY_NOT_FOUND: (dirPath: string): string =>
    `エラー: ディレクトリが見つかりません: ${dirPath}`,
  GENERIC: (message: string): string => `エラー: ${message}`,
} as const;

export const listFilesTool: ToolDefinition = {
  definition: {
    name: "list_files",
    description:
      "指定されたディレクトリ内のファイルとディレクトリの一覧を取得します。パスを省略するとworkspace/の内容を一覧表示します。",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "一覧を取得するディレクトリのパス（省略時はworkspace/）",
        },
      },
    },
  },

  async execute(rawInput: Record<string, unknown>): Promise<string> {
    const input = rawInput as ListFilesInput;
    const dirPath = input.path ? path.resolve(WORKSPACE_DIR, input.path) : WORKSPACE_DIR;

    if (!dirPath.startsWith(WORKSPACE_DIR)) {
      return ERROR_MESSAGES.OUTSIDE_WORKSPACE;
    }

    try {
      const files = await readdir(dirPath);
      const fileCount = files.length;
      const result = fileCount > 0 ? files.join("\n") : EMPTY_DIRECTORY_MESSAGE;
      console.log(`   結果: ${fileCount}個のファイル/ディレクトリ`);
      return result;
    } catch (error: unknown) {
      if (!isFileSystemError(error)) {
        return ERROR_MESSAGES.GENERIC(String(error));
      }

      if (error.code === "ENOENT") {
        return ERROR_MESSAGES.DIRECTORY_NOT_FOUND(input.path ?? "workspace/");
      }
      return ERROR_MESSAGES.GENERIC(error.message);
    }
  },
};

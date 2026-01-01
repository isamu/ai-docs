import { readdir } from "fs/promises";
import path from "path";
import { ToolDefinition } from "./types";

const WORKSPACE = path.join(process.cwd(), "workspace");

export const listFilesTool: ToolDefinition = {
  definition: {
    name: "list_files",
    description:
      "指定されたディレクトリ内のファイルとディレクトリの一覧を取得します。パスを省略するとworkspace/の内容を一覧表示します。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "一覧を取得するディレクトリのパス（省略時はworkspace/）",
        },
      },
    },
  },

  async execute(input: { path?: string }): Promise<string> {
    const dirPath = input.path ? path.resolve(WORKSPACE, input.path) : WORKSPACE;

    // セキュリティチェック
    if (!dirPath.startsWith(WORKSPACE)) {
      return "エラー: ワークスペース外にはアクセスできません";
    }

    try {
      const files = await readdir(dirPath);
      const result = files.length > 0 ? files.join("\n") : "（空のディレクトリ）";
      console.log(`   結果: ${files.length}個のファイル/ディレクトリ`);
      return result;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return `エラー: ディレクトリが見つかりません: ${input.path || "workspace/"}`;
      }
      return `エラー: ${error.message}`;
    }
  },
};

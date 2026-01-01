import { readFile } from "fs/promises";
import path from "path";
import { ToolDefinition } from "./types";

const WORKSPACE = path.join(process.cwd(), "workspace");

export const readFileTool: ToolDefinition = {
  definition: {
    name: "read_file",
    description:
      "指定されたパスのファイルの内容を読み取ります。workspace/ディレクトリ内のファイルのみアクセス可能です。",
    input_schema: {
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

  async execute(input: { path: string }): Promise<string> {
    const filePath = path.resolve(WORKSPACE, input.path);

    // セキュリティチェック: ワークスペース外へのアクセスを防ぐ
    if (!filePath.startsWith(WORKSPACE)) {
      return "エラー: ワークスペース外のファイルにはアクセスできません";
    }

    try {
      const content = await readFile(filePath, "utf-8");
      console.log(`   結果: ${content.length}文字を読み込みました`);
      return content;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return `エラー: ファイルが見つかりません: ${input.path}`;
      } else if (error.code === "EACCES") {
        return `エラー: ファイルの読み取り権限がありません: ${input.path}`;
      } else {
        return `エラー: ${error.message}`;
      }
    }
  },
};

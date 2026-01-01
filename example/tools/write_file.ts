import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { ToolDefinition } from "./types";

const WORKSPACE = path.join(process.cwd(), "workspace");

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

  async execute(input: { path: string; content: string }): Promise<string> {
    const filePath = path.resolve(WORKSPACE, input.path);

    // セキュリティチェック
    if (!filePath.startsWith(WORKSPACE)) {
      return "エラー: ワークスペース外のファイルには書き込めません";
    }

    try {
      // ディレクトリが存在しない場合は作成
      const dir = path.dirname(filePath);
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(filePath, input.content, "utf-8");
      console.log(`   結果: ${input.content.length}文字を書き込みました`);
      return `✅ ファイルを書き込みました: ${input.path}`;
    } catch (error: any) {
      return `エラー: ${error.message}`;
    }
  },
};

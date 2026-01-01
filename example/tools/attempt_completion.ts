import { ToolDefinition } from "./types";

export const attemptCompletionTool: ToolDefinition = {
  definition: {
    name: "attempt_completion",
    description: "タスクが完了したときに呼び出すツール。",
    input_schema: {
      type: "object",
      properties: {
        result: {
          type: "string",
          description: "タスクの実行結果や完了メッセージ",
        },
      },
      required: ["result"],
    },
  },

  async execute(input: { result: string }): Promise<string> {
    // このツールは特別扱いされるため、実行関数は呼ばれない
    return input.result;
  },
};

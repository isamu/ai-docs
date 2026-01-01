import { ToolDefinition } from "./types";

interface AttemptCompletionInput {
  result: string;
}

export const attemptCompletionTool: ToolDefinition = {
  definition: {
    name: "attempt_completion",
    description: "タスクが完了したときに呼び出すツール。",
    inputSchema: {
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

  async execute(rawInput: Record<string, unknown>): Promise<string> {
    const input = rawInput as unknown as AttemptCompletionInput;
    // このツールは特別扱いされるため、実行関数は呼ばれない
    return input.result;
  },
};

import { ToolDefinition } from "./types";

export const getCurrentTimeTool: ToolDefinition = {
  definition: {
    name: "get_current_time",
    description: "現在の日時を取得します。",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  async execute(_input: {}): Promise<string> {
    const now = new Date();
    const result = now.toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    console.log(`   結果: ${result}`);
    return result;
  },
};

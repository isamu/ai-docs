import { ToolDefinition } from "./types";

type EmptyInput = Record<string, never>;

const TIMEZONE = "Asia/Tokyo";
const LOCALE = "ja-JP";

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

export const getCurrentTimeTool: ToolDefinition = {
  definition: {
    name: "get_current_time",
    description: "現在の日時を取得します。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  async execute(_input: Record<string, unknown>): Promise<string> {
    const now = new Date();
    const result = now.toLocaleString(LOCALE, DATE_FORMAT_OPTIONS);
    console.log(`   結果: ${result}`);
    return result;
  },
};

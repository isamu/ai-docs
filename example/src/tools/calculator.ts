import { ToolDefinition } from "./types";

interface CalculatorInput {
  expression: string;
}

const ALLOWED_CHARACTERS_PATTERN = /^[0-9+\-*/().\s]+$/;
const ERROR_INVALID_CHARACTERS = "エラー: 使用できない文字が含まれています";
const ERROR_GENERIC = (message: string): string => `エラー: ${message}`;

export const calculatorTool: ToolDefinition = {
  definition: {
    name: "calculator",
    description: "数式を計算します。四則演算（+, -, *, /）と括弧が使えます。",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "計算したい数式",
        },
      },
      required: ["expression"],
    },
  },

  async execute(rawInput: Record<string, unknown>): Promise<string> {
    const input = rawInput as unknown as CalculatorInput;
    const { expression } = input;

    if (!ALLOWED_CHARACTERS_PATTERN.test(expression)) {
      return ERROR_INVALID_CHARACTERS;
    }

    try {
      const result = eval(expression) as number;
      console.log(`   結果: ${result}`);
      return String(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return ERROR_GENERIC(message);
    }
  },
};

import { ToolDefinition } from "./types";

export const calculatorTool: ToolDefinition = {
  definition: {
    name: "calculator",
    description: "数式を計算します。四則演算（+, -, *, /）と括弧が使えます。",
    input_schema: {
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

  async execute(input: { expression: string }): Promise<string> {
    const expression = input.expression;

    // 基本的な安全チェック
    if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
      return "エラー: 使用できない文字が含まれています";
    }

    try {
      const result = eval(expression);
      console.log(`   結果: ${result}`);
      return String(result);
    } catch (error: any) {
      return `エラー: ${error.message}`;
    }
  },
};

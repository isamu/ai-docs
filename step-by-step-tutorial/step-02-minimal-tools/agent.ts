/**
 * Step 2: 最小限のツール
 *
 * calculator と get_current_time の2つのシンプルなツールを追加。
 * LLMがツールを選択して使う様子を観察できる。
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-5-20250929";

/**
 * ツール定義
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "calculator",
    description:
      "数式を計算します。四則演算（+, -, *, /）と括弧が使えます。例: '2 + 2', '(10 * 5) + 3'",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "計算したい数式（例: '2 + 2', '10 * (5 + 3)'）",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "get_current_time",
    description: "現在の日時を取得します。タイムゾーンは日本標準時（JST）です。",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "attempt_completion",
    description: "タスクが完了したときに呼び出すツール。タスクの結果を報告する。",
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
];

type Message = Anthropic.MessageParam;

/**
 * ユーザー入力を取得
 */
async function getUserInput(prompt: string = "タスクを入力してください"): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n${prompt}: `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * ツールを実行
 */
function executeTool(toolName: string, input: any): string {
  console.log(`   入力: ${JSON.stringify(input)}`);

  try {
    switch (toolName) {
      case "calculator": {
        // 注意: eval()は本番環境では使用しないこと（セキュリティリスク）
        // 実際のアプリケーションでは、math.js などの安全な数式パーサーを使用
        const expression = input.expression;

        // 基本的な安全チェック（簡易版）
        if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
          return "エラー: 使用できない文字が含まれています";
        }

        const result = eval(expression);
        console.log(`   結果: ${result}`);
        return String(result);
      }

      case "get_current_time": {
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
      }

      default:
        return `エラー: 不明なツール '${toolName}'`;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`   エラー: ${errorMessage}`);
    return `エラー: ${errorMessage}`;
  }
}

/**
 * Claude APIを呼び出し
 */
async function callClaude(messages: Message[]): Promise<Anthropic.Message> {
  console.log("\n🤖 LLMの応答:");

  const stream = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: messages,
    tools: TOOLS,
    stream: true,
  });

  let fullResponse: Anthropic.Message | null = null;
  let currentText = "";

  for await (const event of stream) {
    if (event.type === "message_start") {
      fullResponse = event.message;
    } else if (event.type === "content_block_start") {
      if (event.content_block.type === "text") {
        currentText = "";
      } else if (event.content_block.type === "tool_use") {
        // ツール使用開始
        console.log(`🔧 ツール使用: ${event.content_block.name}`);
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        currentText += event.delta.text;
        process.stdout.write(event.delta.text);
      }
    } else if (event.type === "content_block_stop") {
      if (currentText) {
        console.log();
      }
    } else if (event.type === "message_delta") {
      if (fullResponse && event.delta.stop_reason) {
        fullResponse.stop_reason = event.delta.stop_reason;
      }
      if (fullResponse && event.usage) {
        fullResponse.usage.output_tokens = event.usage.output_tokens;
      }
    }
  }

  if (!fullResponse) {
    throw new Error("APIからの応答を取得できませんでした");
  }

  return fullResponse;
}

/**
 * LLMの応答を処理
 * @returns ループを継続するかどうか
 */
function processResponse(response: Anthropic.Message, messages: Message[]): boolean {
  // まずassistantの応答を履歴に追加
  messages.push({
    role: "assistant",
    content: response.content,
  });

  // tool_useブロックを探す
  const toolUses = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUses.length > 0) {
    // ツールが使われた
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      if (toolUse.name === "attempt_completion") {
        // タスク完了
        const result = (toolUse.input as { result: string }).result;
        console.log("\n✅ タスク完了:", result);
        return false; // ループ終了
      } else {
        // 他のツールを実行
        const result = executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }
    }

    // ツール結果をメッセージ履歴に追加
    if (toolResults.length > 0) {
      messages.push({
        role: "user",
        content: toolResults,
      });
    }
  }

  return true; // ループ継続
}

/**
 * メイン関数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Step 2: 最小限のツール");
  console.log("=".repeat(60));
  console.log("\nこのエージェントは以下のツールが使えます：");
  console.log("  • calculator - 数式を計算");
  console.log("  • get_current_time - 現在時刻を取得");

  try {
    const task = await getUserInput();

    if (!task.trim()) {
      console.log("❌ タスクが入力されませんでした");
      return;
    }

    const messages: Message[] = [
      {
        role: "user",
        content: task,
      },
    ];

    console.log("\n🚀 タスク実行開始...");

    let shouldContinue = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 25;

    while (shouldContinue && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`\n--- イテレーション ${iterationCount} ---`);

      const response = await callClaude(messages);
      shouldContinue = processResponse(response, messages);
    }

    if (iterationCount >= MAX_ITERATIONS) {
      console.log("\n⚠️ 最大イテレーション数に達しました");
    }

    console.log("\n" + "=".repeat(60));
    console.log("実行完了");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

main();

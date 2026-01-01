/**
 * Step 1: シンプルなループ
 *
 * 最もシンプルなAIエージェントの実装。
 * attempt_completionツールを使って完了を判定する基本的なループ。
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

// 環境変数からAPIキーを取得
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 使用するモデル
const MODEL = "claude-sonnet-4-5-20250929";

/**
 * 完了判定用のツール定義
 * LLMがタスクを完了したときにこのツールを使う
 */
const TOOLS: Anthropic.Tool[] = [
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
        command: {
          type: "string",
          description: "ユーザーに実行してもらいたいコマンド（オプション）",
        },
      },
      required: ["result"],
    },
  },
];

/**
 * メッセージの型定義
 */
type Message = Anthropic.MessageParam;

/**
 * ユーザーからの入力を取得
 */
async function getUserInput(prompt: string = "入力"): Promise<string> {
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
 * Claude APIを呼び出してストリーミングで応答を受け取る
 */
async function callClaude(messages: Message[]): Promise<Anthropic.Message> {
  console.log("\n🤖 LLMの応答:");

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    messages: messages,
    tools: TOOLS,
  });

  // ストリーミング出力
  stream.on("text", (text) => {
    process.stdout.write(text);
  });

  // 最終メッセージを取得
  const response = await stream.finalMessage();
  console.log(); // 改行

  return response;
}

/**
 * LLMの応答を処理する
 * @returns ループを継続するかどうか
 */
function processResponse(response: Anthropic.Message, messages: Message[]): boolean {
  // LLMの応答をメッセージ履歴に追加
  messages.push({
    role: "assistant",
    content: response.content,
  });

  // ツール呼び出しがない場合（通常の会話応答）はループを終了
  if (response.stop_reason === "end_turn") {
    return false;
  }

  // 応答内容からtool_useブロックを探す
  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUse) {
    // ツールが使われた
    if (toolUse.name === "attempt_completion") {
      // 完了ツールが使われた → タスク完了
      const result = (toolUse.input as { result: string; command?: string }).result;
      console.log("\n✅ タスク完了:", result);

      // コマンドが指定されている場合は表示
      const command = (toolUse.input as { result: string; command?: string }).command;
      if (command) {
        console.log("💡 実行コマンド:", command);
      }

      // tool_resultを履歴に追加
      messages.push({
        role: "user",
        content: [{
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "タスク完了を確認しました",
        }],
      });

      return false; // タスク完了でループ終了
    }
  }

  return true; // ループ継続
}

/**
 * メイン関数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Step 1: シンプルなループ");
  console.log("=".repeat(60));
  console.log("\nこのエージェントは、タスクを受け取って実行し、");
  console.log("完了したら attempt_completion ツールで終了します。");
  console.log("\n終了するには 'exit' または 'quit' と入力してください");

  try {
    // 会話履歴を保持
    const messages: Message[] = [];

    // メインの会話ループ
    while (true) {
      const input = await getUserInput();

      // 終了コマンドのチェック
      if (!input.trim() || input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        console.log("\n👋 終了します");
        break;
      }

      // ユーザーメッセージを履歴に追加
      messages.push({
        role: "user",
        content: input,
      });

      let shouldContinue = true;
      let iterationCount = 0;
      const MAX_ITERATIONS = 10;

      while (shouldContinue && iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        const response = await callClaude(messages);
        shouldContinue = processResponse(response, messages);
      }

      if (iterationCount >= MAX_ITERATIONS) {
        console.log("\n⚠️ 最大イテレーション数に達しました");
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("セッション終了");
    console.log("=".repeat(60));
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

// プログラム実行
main();

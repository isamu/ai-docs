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
 * Claude APIを呼び出してストリーミングで応答を受け取る
 */
async function callClaude(messages: Message[]): Promise<Anthropic.Message> {
  console.log("\n🤖 LLMの応答:");

  // ストリーミングでAPIを呼び出し
  const stream = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: messages,
    tools: TOOLS,
    stream: true,
  });

  // 応答を組み立てるための変数
  let fullResponse: Anthropic.Message | null = null;
  let currentText = "";

  // ストリーミングイベントを処理
  for await (const event of stream) {
    if (event.type === "message_start") {
      // メッセージ開始
      fullResponse = event.message;
    } else if (event.type === "content_block_start") {
      // コンテンツブロック開始（テキストまたはtool_use）
      if (event.content_block.type === "text") {
        currentText = "";
      }
    } else if (event.type === "content_block_delta") {
      // テキストの差分を受信
      if (event.delta.type === "text_delta") {
        currentText += event.delta.text;
        process.stdout.write(event.delta.text); // リアルタイムで表示
      }
    } else if (event.type === "content_block_stop") {
      // コンテンツブロック終了
      if (currentText) {
        console.log(); // 改行
      }
    } else if (event.type === "message_delta") {
      // メッセージの更新（stop_reason など）
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
 * LLMの応答を処理する
 * @returns ループを継続するかどうか
 */
function processResponse(response: Anthropic.Message, messages: Message[]): boolean {
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

      return false; // ループ終了
    }
  }

  // まだタスクが完了していない
  // LLMの応答をメッセージ履歴に追加
  messages.push({
    role: "assistant",
    content: response.content,
  });

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

  try {
    // ユーザーからタスクを取得
    const task = await getUserInput();

    if (!task.trim()) {
      console.log("❌ タスクが入力されませんでした");
      return;
    }

    // メッセージ履歴を初期化
    const messages: Message[] = [
      {
        role: "user",
        content: task,
      },
    ];

    console.log("\n🚀 タスク実行開始...");

    // メインループ
    let shouldContinue = true;
    let iterationCount = 0;
    const MAX_ITERATIONS = 10; // 無限ループ防止

    while (shouldContinue && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`\n--- イテレーション ${iterationCount} ---`);

      // Claude APIを呼び出し
      const response = await callClaude(messages);

      // 応答を処理
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

// プログラム実行
main();

/**
 * Step 3: ファイル操作
 *
 * ファイルの読み書き、一覧表示ツールを追加。
 * 実際のコーディング補助に近いタスクが可能になる。
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-5-20250929";

// ワークスペースディレクトリ（この中だけアクセス可能）
const WORKSPACE = path.join(process.cwd(), "workspace");

/**
 * ツール定義
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description:
      "指定されたパスのファイルの内容を読み取ります。workspace/ディレクトリ内のファイルのみアクセス可能です。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "読み取るファイルのパス（workspace/からの相対パス、例: 'example.txt'）",
        },
      },
      required: ["path"],
    },
  },
  {
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
  {
    name: "list_files",
    description:
      "指定されたディレクトリ内のファイルとディレクトリの一覧を取得します。パスを省略するとworkspace/の内容を一覧表示します。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "一覧を取得するディレクトリのパス（省略時はworkspace/）",
        },
      },
    },
  },
  {
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
  {
    name: "get_current_time",
    description: "現在の日時を取得します。",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
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
async function executeTool(toolName: string, input: any): Promise<string> {
  console.log(`   入力: ${JSON.stringify(input)}`);

  try {
    switch (toolName) {
      case "read_file": {
        const filePath = path.resolve(WORKSPACE, input.path);

        // セキュリティチェック: ワークスペース外へのアクセスを防ぐ
        if (!filePath.startsWith(WORKSPACE)) {
          return "エラー: ワークスペース外のファイルにはアクセスできません";
        }

        try {
          const content = await readFile(filePath, "utf-8");
          console.log(`   結果: ${content.length}文字を読み込みました`);
          return content;
        } catch (error: any) {
          if (error.code === "ENOENT") {
            return `エラー: ファイルが見つかりません: ${input.path}`;
          } else if (error.code === "EACCES") {
            return `エラー: ファイルの読み取り権限がありません: ${input.path}`;
          } else {
            return `エラー: ${error.message}`;
          }
        }
      }

      case "write_file": {
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
      }

      case "list_files": {
        const dirPath = input.path ? path.resolve(WORKSPACE, input.path) : WORKSPACE;

        // セキュリティチェック
        if (!dirPath.startsWith(WORKSPACE)) {
          return "エラー: ワークスペース外にはアクセスできません";
        }

        try {
          const files = await readdir(dirPath);
          const result = files.length > 0 ? files.join("\n") : "（空のディレクトリ）";
          console.log(`   結果: ${files.length}個のファイル/ディレクトリ`);
          return result;
        } catch (error: any) {
          if (error.code === "ENOENT") {
            return `エラー: ディレクトリが見つかりません: ${input.path || "workspace/"}`;
          }
          return `エラー: ${error.message}`;
        }
      }

      case "calculator": {
        const expression = input.expression;

        // 基本的な安全チェック
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
async function processResponse(response: Anthropic.Message, messages: Message[]): Promise<boolean> {
  // assistantの応答を履歴に追加
  messages.push({
    role: "assistant",
    content: response.content,
  });

  // tool_useブロックを探す
  const toolUses = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUses.length > 0) {
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      if (toolUse.name === "attempt_completion") {
        const result = (toolUse.input as { result: string }).result;
        console.log("\n✅ タスク完了:", result);
        return false; // ループ終了
      } else {
        // 他のツールを実行（非同期対応）
        const result = await executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }
    }

    // ツール結果を追加
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
 * ワークスペースディレクトリを初期化
 */
async function initializeWorkspace() {
  if (!existsSync(WORKSPACE)) {
    await mkdir(WORKSPACE, { recursive: true });
    console.log(`📁 ワークスペースを作成しました: ${WORKSPACE}`);

    // サンプルファイルを作成
    await writeFile(
      path.join(WORKSPACE, "example.txt"),
      "Hello, this is an example file!\nYou can read and modify this file.",
      "utf-8"
    );
    console.log("📄 サンプルファイル（example.txt）を作成しました");
  }
}

/**
 * メイン関数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Step 3: ファイル操作");
  console.log("=".repeat(60));
  console.log("\nこのエージェントは以下のツールが使えます：");
  console.log("  • read_file - ファイル読み込み");
  console.log("  • write_file - ファイル書き込み");
  console.log("  • list_files - ファイル一覧");
  console.log("  • calculator - 計算");
  console.log("  • get_current_time - 時刻取得");

  try {
    // ワークスペース初期化
    await initializeWorkspace();

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
      shouldContinue = await processResponse(response, messages);
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

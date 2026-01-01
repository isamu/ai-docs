/**
 * Step 4: コンテキスト管理
 *
 * トークンカウントとメッセージ履歴管理を実装。
 * 長い会話でもトークン制限を超えないようにする。
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import { readFile, writeFile, readdir, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { encodingForModel } from "js-tiktoken";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-5-20250929";
const WORKSPACE = path.join(process.cwd(), "workspace");

// コンテキストの最大トークン数（150K = 余裕を持った設定）
const MAX_CONTEXT_TOKENS = 150000;

/**
 * ツール定義（Step 3と同じ）
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "指定されたパスのファイルの内容を読み取ります。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "読み取るファイルのパス" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "指定されたパスにコンテンツを書き込みます。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "書き込むファイルのパス" },
        content: { type: "string", description: "ファイルに書き込む内容" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "指定されたディレクトリ内のファイル一覧を取得します。",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "一覧を取得するディレクトリのパス" },
      },
    },
  },
  {
    name: "calculator",
    description: "数式を計算します。",
    input_schema: {
      type: "object",
      properties: {
        expression: { type: "string", description: "計算したい数式" },
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
        result: { type: "string", description: "タスクの実行結果" },
      },
      required: ["result"],
    },
  },
];

type Message = Anthropic.MessageParam;

/**
 * トークンカウンタークラス
 */
class TokenCounter {
  private encoding;

  constructor() {
    // Claude SonnetはGPT-4と同様のトークナイザーを使用
    this.encoding = encodingForModel("gpt-4");
  }

  /**
   * テキストのトークン数をカウント
   */
  countTokens(text: string): number {
    const tokens = this.encoding.encode(text);
    return tokens.length;
  }

  /**
   * メッセージ配列の合計トークン数をカウント
   */
  countMessageTokens(messages: Message[]): number {
    let total = 0;

    for (const message of messages) {
      // 各メッセージには約4トークンのオーバーヘッド
      total += 4;

      // コンテンツのトークン数
      if (typeof message.content === "string") {
        total += this.countTokens(message.content);
      } else if (Array.isArray(message.content)) {
        // ツール使用や結果などの構造化コンテンツ
        total += this.countTokens(JSON.stringify(message.content));
      }
    }

    return total;
  }

  /**
   * リソースを解放
   */
  free() {
    this.encoding.free();
  }
}

/**
 * コンテキスト管理クラス
 */
class ContextManager {
  private maxTokens: number;
  private tokenCounter: TokenCounter;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
    this.tokenCounter = new TokenCounter();
  }

  /**
   * コンテキストを管理（必要に応じてメッセージを削除）
   */
  manageContext(messages: Message[]): Message[] {
    const totalTokens = this.tokenCounter.countMessageTokens(messages);

    if (totalTokens <= this.maxTokens) {
      return messages; // 制限内なのでそのまま
    }

    console.log("\n⚠️ コンテキスト制限に近づいています。古いメッセージを削除します。");

    // 最初のユーザーメッセージ（タスク）は必ず保持
    const firstMessage = messages[0];
    const result: Message[] = [];
    let currentTokens = 0;

    // 後ろから順にメッセージを追加（最近のものを優先）
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const msgTokens = this.tokenCounter.countMessageTokens([msg]);

      if (currentTokens + msgTokens > this.maxTokens - 5000) {
        // 5000トークンのバッファを残す
        if (i === 0) {
          // 最初のメッセージは必ず含める
          result.unshift(msg);
        }
        break;
      }

      result.unshift(msg);
      currentTokens += msgTokens;
    }

    // 最初のメッセージが含まれていない場合は追加
    if (result[0] !== firstMessage) {
      result.unshift(firstMessage);
    }

    const newTotal = this.tokenCounter.countMessageTokens(result);
    console.log(
      `📊 削除後: ${newTotal.toLocaleString()} / ${this.maxTokens.toLocaleString()} tokens ` +
      `(${messages.length} → ${result.length} messages)`
    );

    return result;
  }

  /**
   * トークン使用状況を表示
   */
  displayUsage(messages: Message[]) {
    const totalTokens = this.tokenCounter.countMessageTokens(messages);
    const percentage = (totalTokens / this.maxTokens) * 100;

    console.log(
      `📊 コンテキスト使用状況: ${totalTokens.toLocaleString()} / ` +
      `${this.maxTokens.toLocaleString()} tokens (${percentage.toFixed(1)}%) ` +
      `[${messages.length} messages]`
    );
  }

  /**
   * リソース解放
   */
  cleanup() {
    this.tokenCounter.free();
  }
}

/**
 * ユーザー入力を取得
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
 * ツールを実行（Step 3と同じ）
 */
async function executeTool(toolName: string, input: any): Promise<string> {
  console.log(`   入力: ${JSON.stringify(input)}`);

  try {
    switch (toolName) {
      case "read_file": {
        const filePath = path.resolve(WORKSPACE, input.path);
        if (!filePath.startsWith(WORKSPACE)) {
          return "エラー: ワークスペース外のファイルにはアクセスできません";
        }
        try {
          const content = await readFile(filePath, "utf-8");
          console.log(`   結果: ${content.length}文字を読み込みました`);
          return content;
        } catch (error: any) {
          return `エラー: ${error.message}`;
        }
      }

      case "write_file": {
        const filePath = path.resolve(WORKSPACE, input.path);
        if (!filePath.startsWith(WORKSPACE)) {
          return "エラー: ワークスペース外のファイルには書き込めません";
        }
        try {
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
        if (!dirPath.startsWith(WORKSPACE)) {
          return "エラー: ワークスペース外にはアクセスできません";
        }
        try {
          const files = await readdir(dirPath);
          const result = files.length > 0 ? files.join("\n") : "（空のディレクトリ）";
          console.log(`   結果: ${files.length}個のファイル/ディレクトリ`);
          return result;
        } catch (error: any) {
          return `エラー: ${error.message}`;
        }
      }

      case "calculator": {
        const expression = input.expression;
        if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
          return "エラー: 使用できない文字が含まれています";
        }
        const result = eval(expression);
        console.log(`   結果: ${result}`);
        return String(result);
      }

      case "get_current_time": {
        const result = new Date().toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
        });
        console.log(`   結果: ${result}`);
        return result;
      }

      default:
        return `エラー: 不明なツール '${toolName}'`;
    }
  } catch (error: any) {
    console.log(`   エラー: ${error.message}`);
    return `エラー: ${error.message}`;
  }
}

/**
 * Claude APIを呼び出し
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

  stream.on("contentBlock", (block) => {
    if (block.type === "tool_use") {
      console.log(`\n🔧 ツール使用: ${block.name}`);
    }
  });

  // 最終メッセージを取得
  const response = await stream.finalMessage();
  console.log(); // 改行

  return response;
}

/**
 * LLMの応答を処理
 * @returns ループを継続するかどうか
 */
async function processResponse(response: Anthropic.Message, messages: Message[]): Promise<boolean> {
  messages.push({
    role: "assistant",
    content: response.content,
  });

  // ツール呼び出しがない場合（通常の会話応答）はループを終了
  if (response.stop_reason === "end_turn") {
    return false;
  }

  const toolUses = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUses.length > 0) {
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let isCompleted = false;

    for (const toolUse of toolUses) {
      if (toolUse.name === "attempt_completion") {
        const result = (toolUse.input as { result: string }).result;
        console.log("\n✅ タスク完了:", result);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: "タスク完了を確認しました",
        });
        isCompleted = true;
      } else {
        const result = await executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result,
        });
      }
    }

    if (toolResults.length > 0) {
      messages.push({
        role: "user",
        content: toolResults,
      });
    }

    if (isCompleted) {
      return false; // タスク完了でループ終了
    }
  }

  return true; // ツール結果を返した場合はループ継続
}

/**
 * ワークスペース初期化
 */
async function initializeWorkspace() {
  if (!existsSync(WORKSPACE)) {
    await mkdir(WORKSPACE, { recursive: true });
    console.log(`📁 ワークスペースを作成しました: ${WORKSPACE}`);
    await writeFile(
      path.join(WORKSPACE, "example.txt"),
      "Hello, this is an example file!",
      "utf-8"
    );
  }
}

/**
 * メイン関数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Step 4: コンテキスト管理");
  console.log("=".repeat(60));
  console.log("\nこのエージェントはトークン制限を管理します。");
  console.log(`最大コンテキスト: ${MAX_CONTEXT_TOKENS.toLocaleString()} tokens`);
  console.log("\n終了するには 'exit' または 'quit' と入力してください");

  const contextManager = new ContextManager(MAX_CONTEXT_TOKENS);

  try {
    await initializeWorkspace();

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
      const MAX_ITERATIONS = 50;

      while (shouldContinue && iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        // コンテキスト管理
        const managedMessages = contextManager.manageContext(messages);
        contextManager.displayUsage(managedMessages);

        // LLM呼び出し
        const response = await callClaude(managedMessages);

        // 応答処理（元のmessages配列に追加）
        shouldContinue = await processResponse(response, messages);
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
  } finally {
    // クリーンアップ
    contextManager.cleanup();
  }
}

main();

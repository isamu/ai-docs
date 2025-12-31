/**
 * Step 5: サマリー機能
 *
 * 古い会話を要約して保持することで、情報を失わずにトークン数を削減。
 * これで完全な機能を持つAIエージェントシステムが完成！
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
const SUMMARY_MODEL = "claude-haiku-3-5-20241022"; // サマリー用（安価で高速）
const WORKSPACE = path.join(process.cwd(), "workspace");
const MAX_CONTEXT_TOKENS = 150000;

/**
 * ツール定義
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
    this.encoding = encodingForModel("gpt-4");
  }

  countTokens(text: string): number {
    const tokens = this.encoding.encode(text);
    return tokens.length;
  }

  countMessageTokens(messages: Message[]): number {
    let total = 0;
    for (const message of messages) {
      total += 4;
      if (typeof message.content === "string") {
        total += this.countTokens(message.content);
      } else if (Array.isArray(message.content)) {
        total += this.countTokens(JSON.stringify(message.content));
      }
    }
    return total;
  }

  free() {
    this.encoding.free();
  }
}

/**
 * サマリー管理クラス
 */
class SummaryManager {
  private summary: string = "";
  private tokenCounter: TokenCounter;

  constructor(tokenCounter: TokenCounter) {
    this.tokenCounter = tokenCounter;
  }

  /**
   * メッセージをサマリーに変換
   */
  async generateSummary(messages: Message[]): Promise<string> {
    console.log("\n📝 サマリー生成中...");

    // メッセージをテキスト形式に変換
    const messagesText = messages
      .map((msg, index) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        let content: string;

        if (typeof msg.content === "string") {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          // ツール使用や結果を簡潔に
          content = msg.content
            .map((block) => {
              if (block.type === "tool_use") {
                return `[Tool: ${block.name}]`;
              } else if (block.type === "tool_result") {
                return `[Result: ${typeof block.content === "string" ? block.content.substring(0, 50) : "..."}]`;
              } else if (block.type === "text") {
                return block.text;
              }
              return "";
            })
            .filter((s) => s)
            .join(" ");
        } else {
          content = JSON.stringify(msg.content);
        }

        return `${role}: ${content}`;
      })
      .join("\n\n");

    try {
      // Haikuモデルを使用（安価で高速）
      const response = await anthropic.messages.create({
        model: SUMMARY_MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content:
              `以下の会話を簡潔に要約してください。\n` +
              `重要な情報（実行したタスク、結果、現在の状態、ファイル名など）を含めてください：\n\n` +
              `${messagesText}`,
          },
        ],
      });

      const summaryText =
        response.content[0].type === "text" ? response.content[0].text : "";
      const tokens = this.tokenCounter.countTokens(summaryText);
      console.log(`✅ サマリー生成完了（${tokens} tokens）`);

      return summaryText;
    } catch (error) {
      console.error("⚠️ サマリー生成エラー:", error);
      return "（サマリー生成に失敗しました）";
    }
  }

  /**
   * サマリーを更新
   */
  async updateSummary(newMessages: Message[]) {
    const newSummary = await this.generateSummary(newMessages);

    if (this.summary) {
      // 既存のサマリーと統合
      this.summary = `${this.summary}\n\n[追加情報]\n${newSummary}`;
    } else {
      this.summary = newSummary;
    }
  }

  getSummary(): string {
    return this.summary;
  }

  clearSummary() {
    this.summary = "";
  }
}

/**
 * コンテキスト管理クラス
 */
class ContextManager {
  private maxTokens: number;
  private tokenCounter: TokenCounter;
  private summaryManager: SummaryManager;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
    this.tokenCounter = new TokenCounter();
    this.summaryManager = new SummaryManager(this.tokenCounter);
  }

  /**
   * コンテキストを管理（サマリー生成含む）
   */
  async manageContext(messages: Message[]): Promise<{
    messages: Message[];
    summary: string;
  }> {
    const totalTokens = this.tokenCounter.countMessageTokens(messages);

    if (totalTokens <= this.maxTokens) {
      return { messages, summary: this.summaryManager.getSummary() };
    }

    console.log("\n⚠️ コンテキスト制限に近づいています。サマリーを生成します...");

    // 最初のメッセージ（タスク）と最近のN個を保持
    const keepCount = 15; // 最近の15メッセージを保持
    const firstMessage = messages[0];

    if (messages.length <= keepCount + 1) {
      // メッセージが少ない場合はサマリー不要
      return { messages, summary: this.summaryManager.getSummary() };
    }

    // サマリー対象（中間のメッセージ）
    const toSummarize = messages.slice(1, -keepCount);
    // 保持するメッセージ
    const toKeep = [firstMessage, ...messages.slice(-keepCount)];

    // サマリー生成
    await this.summaryManager.updateSummary(toSummarize);

    const newTotal = this.tokenCounter.countMessageTokens(toKeep);
    console.log(
      `📊 削除後: ${newTotal.toLocaleString()} / ${this.maxTokens.toLocaleString()} tokens ` +
        `(${messages.length} → ${toKeep.length} messages)`
    );

    const summary = this.summaryManager.getSummary();
    console.log(`📝 サマリー:\n${summary.substring(0, 200)}...`);

    return { messages: toKeep, summary };
  }

  displayUsage(messages: Message[]) {
    const totalTokens = this.tokenCounter.countMessageTokens(messages);
    const percentage = (totalTokens / this.maxTokens) * 100;

    console.log(
      `📊 コンテキスト使用状況: ${totalTokens.toLocaleString()} / ` +
        `${this.maxTokens.toLocaleString()} tokens (${percentage.toFixed(1)}%) ` +
        `[${messages.length} messages]`
    );
  }

  cleanup() {
    this.tokenCounter.free();
  }
}

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
 * Claude APIを呼び出し（サマリー付き）
 */
async function callClaude(messages: Message[], summary: string): Promise<Anthropic.Message> {
  console.log("\n🤖 LLMの応答:");

  // システムプロンプトにサマリーを含める
  const systemPrompt = summary
    ? `あなたはタスクを実行するAIアシスタントです。

## これまでの会話のサマリー
${summary}

## 指示
上記のサマリーを踏まえて、ユーザーのタスクを継続してください。
サマリーに含まれる情報（すでに実行したタスク、作成したファイルなど）を活用して、適切に作業を進めてください。`
    : `あなたはタスクを実行するAIアシスタントです。ユーザーのタスクを適切に実行してください。`;

  const stream = await anthropic.messages.create({
    model: MODEL,
    system: systemPrompt,
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
 */
async function processResponse(response: Anthropic.Message, messages: Message[]): Promise<boolean> {
  messages.push({
    role: "assistant",
    content: response.content,
  });

  const toolUses = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUses.length > 0) {
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      if (toolUse.name === "attempt_completion") {
        const result = (toolUse.input as { result: string }).result;
        console.log("\n✅ タスク完了:", result);
        return false;
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
  }

  return true;
}

/**
 * ワークスペース初期化
 */
async function initializeWorkspace() {
  if (!existsSync(WORKSPACE)) {
    await mkdir(WORKSPACE, { recursive: true });
    console.log(`📁 ワークスペースを作成しました: ${WORKSPACE}`);
  }
}

/**
 * メイン関数
 */
async function main() {
  console.log("=".repeat(60));
  console.log("Step 5: サマリー機能");
  console.log("=".repeat(60));
  console.log("\nこのエージェントは会話をサマリーして長期タスクに対応します。");

  const contextManager = new ContextManager(MAX_CONTEXT_TOKENS);

  try {
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
    const MAX_ITERATIONS = 100;

    while (shouldContinue && iterationCount < MAX_ITERATIONS) {
      iterationCount++;
      console.log(`\n--- イテレーション ${iterationCount} ---`);

      // コンテキスト管理（サマリー含む）
      const { messages: managedMessages, summary } = await contextManager.manageContext(messages);
      contextManager.displayUsage(managedMessages);

      // LLM呼び出し（サマリー付き）
      const response = await callClaude(managedMessages, summary);

      // 応答処理（元のmessages配列に追加）
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
  } finally {
    contextManager.cleanup();
  }
}

main();

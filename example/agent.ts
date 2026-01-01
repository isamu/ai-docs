/**
 * AI Agent with modular tools
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline/promises";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { getToolDefinitions, executeTool, getToolNames } from "./tools";

// 定数
const MODEL_NAME = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 4096;
const MAX_ITERATIONS = 25;
const SEPARATOR_LENGTH = 60;
const WORKSPACE_DIR = path.join(process.cwd(), "workspace");
const SAMPLE_FILE_NAME = "example.txt";
const SAMPLE_FILE_CONTENT = "Hello, this is an example file!\nYou can read and modify this file.";
const EXIT_COMMANDS = ["exit", "quit", ""];
const ATTEMPT_COMPLETION_TOOL_NAME = "attempt_completion";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type Message = Anthropic.MessageParam;

interface AttemptCompletionInput {
  result: string;
}

interface ProcessResult {
  shouldContinue: boolean;
  isCompleted: boolean;
}

/**
 * ユーザー入力を取得
 */
async function getUserInput(prompt: string = "入力"): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(`\n${prompt}: `);
  rl.close();
  return answer;
}

/**
 * Claude APIを呼び出し
 */
async function callClaude(messages: readonly Message[]): Promise<Anthropic.Message> {
  console.log("\n🤖 LLMの応答:");

  const stream = anthropic.messages.stream({
    model: MODEL_NAME,
    max_tokens: MAX_TOKENS,
    messages: [...messages],
    tools: getToolDefinitions(),
  });

  stream.on("text", (text: string): void => {
    process.stdout.write(text);
  });

  stream.on("contentBlock", (block: Anthropic.ContentBlock): void => {
    if (block.type === "tool_use") {
      console.log(`\n🔧 ツール使用: ${block.name}`);
    }
  });

  const response = await stream.finalMessage();
  console.log();

  return response;
}

/**
 * ツール使用結果を処理
 */
async function processToolUse(
  toolUse: Anthropic.ToolUseBlock
): Promise<{ toolResult: Anthropic.ToolResultBlockParam; isCompleted: boolean }> {
  if (toolUse.name === ATTEMPT_COMPLETION_TOOL_NAME) {
    const input = toolUse.input as AttemptCompletionInput;
    console.log("\n✅ タスク完了:", input.result);
    return {
      toolResult: {
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: "タスク完了を確認しました",
      },
      isCompleted: true,
    };
  }

  const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);
  return {
    toolResult: {
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: result,
    },
    isCompleted: false,
  };
}

/**
 * LLMの応答を処理
 */
async function processResponse(
  response: Anthropic.Message,
  messages: Message[]
): Promise<ProcessResult> {
  messages.push({
    role: "assistant",
    content: response.content,
  });

  if (response.stop_reason === "end_turn") {
    return { shouldContinue: false, isCompleted: false };
  }

  const toolUses = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );

  if (toolUses.length === 0) {
    return { shouldContinue: true, isCompleted: false };
  }

  const processedResults = await Promise.all(toolUses.map(processToolUse));
  const toolResults = processedResults.map((r) => r.toolResult);
  const hasCompletion = processedResults.some((r) => r.isCompleted);

  messages.push({
    role: "user",
    content: toolResults,
  });

  return {
    shouldContinue: !hasCompletion,
    isCompleted: hasCompletion,
  };
}

/**
 * 会話ループを実行（再帰的）
 */
async function runConversationLoop(
  messages: Message[],
  iterationCount: number
): Promise<void> {
  if (iterationCount >= MAX_ITERATIONS) {
    console.log("\n⚠️ 最大イテレーション数に達しました");
    return;
  }

  const response = await callClaude(messages);
  const { shouldContinue } = await processResponse(response, messages);

  if (shouldContinue) {
    await runConversationLoop(messages, iterationCount + 1);
  }
}

/**
 * 終了コマンドかどうかを判定
 */
function isExitCommand(input: string): boolean {
  const normalizedInput = input.trim().toLowerCase();
  return EXIT_COMMANDS.includes(normalizedInput);
}

/**
 * ワークスペース初期化
 */
async function initializeWorkspace(): Promise<void> {
  if (existsSync(WORKSPACE_DIR)) {
    return;
  }

  await mkdir(WORKSPACE_DIR, { recursive: true });
  console.log(`📁 ワークスペースを作成しました: ${WORKSPACE_DIR}`);

  await writeFile(
    path.join(WORKSPACE_DIR, SAMPLE_FILE_NAME),
    SAMPLE_FILE_CONTENT,
    "utf-8"
  );
  console.log(`📄 サンプルファイル（${SAMPLE_FILE_NAME}）を作成しました`);
}

/**
 * ヘッダーを表示
 */
function displayHeader(): void {
  const separator = "=".repeat(SEPARATOR_LENGTH);
  console.log(separator);
  console.log("AI Agent");
  console.log(separator);
  console.log("\n利用可能なツール:");
  getToolNames().forEach((name) => {
    console.log(`  • ${name}`);
  });
  console.log("\n終了するには 'exit' または 'quit' と入力してください");
}

/**
 * フッターを表示
 */
function displayFooter(): void {
  const separator = "=".repeat(SEPARATOR_LENGTH);
  console.log("\n" + separator);
  console.log("セッション終了");
  console.log(separator);
}

/**
 * メインの会話ループ
 */
async function mainLoop(messages: Message[]): Promise<void> {
  const input = await getUserInput();

  if (isExitCommand(input)) {
    console.log("\n👋 終了します");
    return;
  }

  messages.push({
    role: "user",
    content: input,
  });

  const initialIterationCount = 0;
  await runConversationLoop(messages, initialIterationCount);
  await mainLoop(messages);
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  displayHeader();

  try {
    await initializeWorkspace();
    const messages: Message[] = [];
    await mainLoop(messages);
    displayFooter();
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

main();

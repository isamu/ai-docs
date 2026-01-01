/**
 * AI Agent with modular tools, LLM abstraction, and history management
 */

import * as readline from "readline/promises";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import {
  LLMProvider,
  LLMResponse,
  ContentBlock,
  ToolUse,
  StreamEvent,
} from "./llm";
import { AnthropicProvider } from "./llm/anthropic";
import { ConversationHistory } from "./history";
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

interface AttemptCompletionInput {
  result: string;
}

interface ProcessResult {
  shouldContinue: boolean;
  isCompleted: boolean;
}

// LLMプロバイダーを作成
function createLLMProvider(): LLMProvider {
  return new AnthropicProvider({
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: MODEL_NAME,
    maxTokens: MAX_TOKENS,
  });
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
 * ストリームイベントを処理
 */
function handleStreamEvent(event: StreamEvent): void {
  switch (event.type) {
    case "text":
      process.stdout.write(event.text ?? "");
      break;
    case "tool_use_start":
      console.log(`\n🔧 ツール使用: ${event.toolName}`);
      break;
    case "done":
      console.log();
      break;
  }
}

/**
 * LLMを呼び出し
 */
async function callLLM(
  provider: LLMProvider,
  history: ConversationHistory
): Promise<LLMResponse> {
  console.log("\n🤖 LLMの応答:");

  const tools = getToolDefinitions();
  const messages = history.toBaseMessages();

  return provider.call(messages, tools, handleStreamEvent);
}

/**
 * ツール使用を処理
 */
async function processToolUse(
  toolUse: ToolUse,
  history: ConversationHistory
): Promise<{ isCompleted: boolean }> {
  if (toolUse.name === ATTEMPT_COMPLETION_TOOL_NAME) {
    const input = toolUse.input as unknown as AttemptCompletionInput;
    console.log("\n✅ タスク完了:", input.result);
    history.addTaskCompletion(input.result);
    return { isCompleted: true };
  }

  const result = await executeTool(toolUse.name, toolUse.input);
  history.addToolResult(toolUse.name, toolUse.id, result);
  return { isCompleted: false };
}

/**
 * ツール使用ブロックを抽出
 */
function extractToolUses(content: ContentBlock[]): ToolUse[] {
  return content
    .filter((block): block is ContentBlock & { type: "tool_use" } => block.type === "tool_use")
    .map((block) => block.toolUse);
}

/**
 * LLMの応答を処理
 */
async function processResponse(
  response: LLMResponse,
  history: ConversationHistory
): Promise<ProcessResult> {
  // アシスタントの応答を履歴に追加
  history.addAssistantMessage(response.content);

  if (response.stopReason === "end_turn") {
    return { shouldContinue: false, isCompleted: false };
  }

  const toolUses = extractToolUses(response.content);

  if (toolUses.length === 0) {
    return { shouldContinue: true, isCompleted: false };
  }

  // ツール結果を処理
  const results = await Promise.all(
    toolUses.map((toolUse) => processToolUse(toolUse, history))
  );
  const hasCompletion = results.some((r) => r.isCompleted);

  return {
    shouldContinue: !hasCompletion,
    isCompleted: hasCompletion,
  };
}

/**
 * 会話ループを実行（再帰的）
 */
async function runConversationLoop(
  provider: LLMProvider,
  history: ConversationHistory,
  iterationCount: number
): Promise<void> {
  if (iterationCount >= MAX_ITERATIONS) {
    console.log("\n⚠️ 最大イテレーション数に達しました");
    return;
  }

  const response = await callLLM(provider, history);
  const { shouldContinue } = await processResponse(response, history);

  if (shouldContinue) {
    await runConversationLoop(provider, history, iterationCount + 1);
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
function displayHeader(providerName: string): void {
  const separator = "=".repeat(SEPARATOR_LENGTH);
  console.log(separator);
  console.log(`AI Agent (${providerName})`);
  console.log(separator);
  console.log("\n利用可能なツール:");
  getToolNames().forEach((name) => {
    console.log(`  • ${name}`);
  });
  console.log("\n終了するには 'exit'、'quit'、または Ctrl+C");
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
async function mainLoop(
  provider: LLMProvider,
  history: ConversationHistory
): Promise<void> {
  const input = await getUserInput();

  if (isExitCommand(input)) {
    console.log("\n👋 終了します");
    return;
  }

  history.addUserMessage(input);

  const initialIterationCount = 0;
  await runConversationLoop(provider, history, initialIterationCount);
  await mainLoop(provider, history);
}

/**
 * Ctrl+C ハンドラーを設定
 */
function setupSignalHandlers(): void {
  process.on("SIGINT", () => {
    console.log("\n\n👋 Ctrl+C で終了します");
    displayFooter();
    process.exit(0);
  });
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  setupSignalHandlers();

  const provider = createLLMProvider();
  const history = new ConversationHistory();

  displayHeader(provider.name);

  try {
    await initializeWorkspace();
    await mainLoop(provider, history);
    displayFooter();
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

main();

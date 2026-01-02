/**
 * AI Agent with modular tools, LLM abstraction, context and mode management
 */

import * as readline from "readline/promises";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { LLMProvider, LLMResponse, ContentBlock, ToolUse, StreamEvent } from "./llm";
import { AnthropicProvider } from "./llm/anthropic";
import { AgentContext, AgentMode } from "./context";
import { executeTool } from "./tools";

// 定数
const MODEL_NAME = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 4096;
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
 * プロンプト文字列を生成（zshスタイル）
 */
function buildPrompt(context: AgentContext): string {
  const mode = context.getMode();
  const session = context.getActiveSession();

  if (session) {
    // セッションがある場合: [mode:taskType] >
    return `\n[${mode}:${session.taskType}] > `;
  }
  // セッションがない場合: [mode] >
  return `\n[${mode}] > `;
}

/**
 * ユーザー入力を取得
 */
async function getUserInput(context: AgentContext): Promise<string | null> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const prompt = buildPrompt(context);
    const answer = await rl.question(prompt);
    return answer;
  } catch {
    // Ctrl+C による中断
    return null;
  } finally {
    rl.close();
  }
}

/**
 * ストリームイベントを処理
 */
function createStreamHandler(): (event: StreamEvent) => void {
  return (event: StreamEvent): void => {
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
  };
}

/**
 * LLMを呼び出し
 */
async function callLLM(provider: LLMProvider, context: AgentContext): Promise<LLMResponse> {
  console.log("\n🤖 LLMの応答:");

  const tools = context.getEnabledTools();
  const messages = context.toBaseMessages();
  const systemPrompt = context.getSystemPrompt();

  const response = await provider.call(messages, tools, createStreamHandler(), systemPrompt);

  return response;
}

/**
 * ツール使用を処理
 */
async function processToolUse(
  toolUse: ToolUse,
  context: AgentContext
): Promise<{ isCompleted: boolean }> {
  // ツールが現在のモードで使用可能か確認
  if (!context.isToolEnabled(toolUse.name)) {
    const errorMessage = `ツール "${toolUse.name}" は現在のモード "${context.getMode()}" では使用できません`;
    console.log(`\n⚠️ ${errorMessage}`);
    context.addToolResult(toolUse.name, toolUse.id, errorMessage);
    return { isCompleted: false };
  }

  // 制約チェック
  if (toolUse.name === "write_file" && !context.canWriteFiles()) {
    const errorMessage = "現在のモードではファイル書き込みが許可されていません";
    console.log(`\n⚠️ ${errorMessage}`);
    context.addToolResult(toolUse.name, toolUse.id, errorMessage);
    return { isCompleted: false };
  }

  if (toolUse.name === ATTEMPT_COMPLETION_TOOL_NAME) {
    const input = toolUse.input as unknown as AttemptCompletionInput;
    console.log("\n✅ タスク完了:", input.result);
    context.addTaskCompletion(input.result);
    return { isCompleted: true };
  }

  const result = await executeTool(toolUse.name, toolUse.input, context);
  context.addToolResult(toolUse.name, toolUse.id, result);
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
  context: AgentContext
): Promise<ProcessResult> {
  // アシスタントの応答を履歴に追加
  context.addAssistantMessage(response.content);

  if (response.stopReason === "end_turn") {
    return { shouldContinue: false, isCompleted: false };
  }

  const toolUses = extractToolUses(response.content);

  if (toolUses.length === 0) {
    return { shouldContinue: true, isCompleted: false };
  }

  // ツール結果を処理
  const results = await Promise.all(toolUses.map((toolUse) => processToolUse(toolUse, context)));
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
  context: AgentContext,
  iterationCount: number
): Promise<void> {
  const maxIterations = context.getMaxIterations();
  if (iterationCount >= maxIterations) {
    console.log(`\n⚠️ 最大イテレーション数に達しました (${maxIterations})`);
    return;
  }

  const response = await callLLM(provider, context);
  const { shouldContinue } = await processResponse(response, context);

  if (shouldContinue) {
    await runConversationLoop(provider, context, iterationCount + 1);
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

  await writeFile(path.join(WORKSPACE_DIR, SAMPLE_FILE_NAME), SAMPLE_FILE_CONTENT, "utf-8");
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
 * モード変更コマンドを処理
 */
function handleModeCommand(input: string, context: AgentContext): boolean {
  const modeMatch = input.match(/^\/mode\s+(\w+)$/);
  if (!modeMatch) {
    return false;
  }

  const modeName = modeMatch[1] as AgentMode;
  const validModes: AgentMode[] = ["exploration", "planning", "implementation", "review", "conversation"];

  if (!validModes.includes(modeName)) {
    console.log(`⚠️ 無効なモード: ${modeName}`);
    return true;
  }

  // ベースモードに戻してから新しいモードをpush
  context.modeManager.popToBase();
  if (modeName !== "conversation") {
    context.pushMode(modeName);
  }
  return true;
}

/**
 * メインの会話ループ
 */
async function mainLoop(provider: LLMProvider, context: AgentContext): Promise<void> {
  const input = await getUserInput(context);

  // Ctrl+C による中断
  if (input === null) {
    console.log("\n👋 終了します");
    return;
  }

  if (isExitCommand(input)) {
    console.log("\n👋 終了します");
    return;
  }

  // モード変更コマンド
  if (handleModeCommand(input, context)) {
    await mainLoop(provider, context);
    return;
  }

  // ターン開始（このターン中はセッション切り替えがあっても同じ履歴を使用）
  context.beginTurn();
  try {
    context.addUserMessage(input);

    const initialIterationCount = 0;
    await runConversationLoop(provider, context, initialIterationCount);
  } finally {
    // ターン終了（次のターンでは新しいセッションの履歴を使用）
    context.endTurn();
  }

  await mainLoop(provider, context);
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
  const provider = createLLMProvider();
  const context = new AgentContext();

  setupSignalHandlers();
  displayHeader(provider.name);

  try {
    await initializeWorkspace();
    await mainLoop(provider, context);
    displayFooter();
  } catch (error) {
    context.addError(error instanceof Error ? error.message : String(error));
    console.error("\n❌ エラーが発生しました:", error);
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

main();

/**
 * AI Agent with modular tools
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { getToolDefinitions, executeTool, getToolNames } from "./tools";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-5-20250929";
const WORKSPACE = path.join(process.cwd(), "workspace");

type Message = Anthropic.MessageParam;

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
 * Claude APIを呼び出し
 */
async function callClaude(messages: Message[]): Promise<Anthropic.Message> {
  console.log("\n🤖 LLMの応答:");

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    messages: messages,
    tools: getToolDefinitions(),
  });

  stream.on("text", (text) => {
    process.stdout.write(text);
  });

  stream.on("contentBlock", (block) => {
    if (block.type === "tool_use") {
      console.log(`\n🔧 ツール使用: ${block.name}`);
    }
  });

  const response = await stream.finalMessage();
  console.log();

  return response;
}

/**
 * LLMの応答を処理
 */
async function processResponse(response: Anthropic.Message, messages: Message[]): Promise<boolean> {
  messages.push({
    role: "assistant",
    content: response.content,
  });

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
      return false;
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
  console.log("AI Agent");
  console.log("=".repeat(60));
  console.log("\n利用可能なツール:");
  for (const name of getToolNames()) {
    console.log(`  • ${name}`);
  }
  console.log("\n終了するには 'exit' または 'quit' と入力してください");

  try {
    await initializeWorkspace();

    const messages: Message[] = [];

    while (true) {
      const input = await getUserInput();

      if (!input.trim() || input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
        console.log("\n👋 終了します");
        break;
      }

      messages.push({
        role: "user",
        content: input,
      });

      let shouldContinue = true;
      let iterationCount = 0;
      const MAX_ITERATIONS = 25;

      while (shouldContinue && iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        const response = await callClaude(messages);
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
  }
}

main();

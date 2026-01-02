/**
 * Shell Tool - シェルコマンド実行
 */

import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { ToolDefinition } from "./types";

const execAsync = promisify(exec);

const WORKSPACE_DIR = path.join(process.cwd(), "workspace");
const MAX_OUTPUT_LENGTH = 10000;
const DEFAULT_TIMEOUT = 30000; // 30秒

// 許可されたコマンドのプレフィックス
const ALLOWED_COMMANDS = [
  "npm",
  "yarn",
  "pnpm",
  "node",
  "npx",
  "git",
  "ls",
  "cat",
  "head",
  "tail",
  "grep",
  "find",
  "echo",
  "pwd",
  "mkdir",
  "cp",
  "mv",
  "rm",
  "tsc",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "mocha",
];

// 禁止されたパターン
const FORBIDDEN_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf /
  />\s*\/dev\//, // redirect to /dev
  /curl.*\|.*sh/, // curl | sh
  /wget.*\|.*sh/, // wget | sh
  /sudo/, // sudo
  /chmod\s+777/, // chmod 777
];

function isCommandAllowed(command: string): { allowed: boolean; reason?: string } {
  const trimmedCommand = command.trim();
  const firstWord = trimmedCommand.split(/\s+/)[0];

  // 禁止パターンチェック
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      return { allowed: false, reason: "このコマンドパターンは禁止されています" };
    }
  }

  // 許可コマンドチェック
  if (!ALLOWED_COMMANDS.includes(firstWord)) {
    return {
      allowed: false,
      reason: `コマンド '${firstWord}' は許可されていません。許可: ${ALLOWED_COMMANDS.join(", ")}`,
    };
  }

  return { allowed: true };
}

function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_LENGTH) {
    return output;
  }
  return output.substring(0, MAX_OUTPUT_LENGTH) + `\n... (出力が${MAX_OUTPUT_LENGTH}文字で切り詰められました)`;
}

export const shellTool: ToolDefinition = {
  definition: {
    name: "shell",
    description: `シェルコマンドを実行します。npm, yarn, git, node などの開発ツールが使用可能です。
許可されたコマンド: ${ALLOWED_COMMANDS.join(", ")}`,
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "実行するコマンド",
        },
        cwd: {
          type: "string",
          description: "作業ディレクトリ（省略時はworkspace）",
        },
        timeout: {
          type: "string",
          description: "タイムアウト（ミリ秒、省略時は30000）",
        },
      },
      required: ["command"],
    },
  },
  execute: async (input) => {
    const command = input.command as string;
    const cwd = (input.cwd as string) || WORKSPACE_DIR;
    const timeout = parseInt(input.timeout as string) || DEFAULT_TIMEOUT;

    // コマンドチェック
    const check = isCommandAllowed(command);
    if (!check.allowed) {
      return `エラー: ${check.reason}`;
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        env: { ...process.env, NODE_ENV: "development" },
      });

      let result = "";
      if (stdout) {
        result += truncateOutput(stdout);
      }
      if (stderr) {
        result += (result ? "\n\n[stderr]\n" : "[stderr]\n") + truncateOutput(stderr);
      }

      return result || "(出力なし)";
    } catch (error: unknown) {
      if (error instanceof Error) {
        const execError = error as Error & { stdout?: string; stderr?: string; code?: number };
        let message = `コマンド実行エラー: ${error.message}`;
        if (execError.stdout) {
          message += `\n\n[stdout]\n${truncateOutput(execError.stdout)}`;
        }
        if (execError.stderr) {
          message += `\n\n[stderr]\n${truncateOutput(execError.stderr)}`;
        }
        return message;
      }
      return `エラー: ${String(error)}`;
    }
  },
};

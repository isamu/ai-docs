/**
 * Code Generation Task Definition
 *
 * ユーザーの要望に基づいてコードを生成・修正するタスク
 */

import { TaskModule, defineTask } from "../types";

export const codegenTaskModule = defineTask({
  config: {
    name: "codegen",
    displayName: "コード生成",
    description: "ユーザーの要望に基づいてコードを生成・修正",
    goal: "動作するコード",
    defaultMode: "implementation",

    systemPrompt: `あなたはコード生成の専門家です。

## 原則
- クリーンで読みやすいコードを書く
- 適切なエラーハンドリングを含める
- 既存のコードスタイルに従う
- 必要に応じてテストを作成

## 手順
1. 要件を理解
2. 既存コードを確認
3. 実装
4. テストで確認`,

    enabledCoreTools: ["read_file", "write_file", "list_files", "shell"],
    enabledTaskTools: ["run_tests", "lint_code"],

    phases: [
      {
        name: "analysis",
        description: "要件分析",
        goal: "実装方針の決定",
        systemPrompt: "要件を分析し、実装方針を決定してください。",
        enabledTools: ["read_file", "list_files"],
      },
      {
        name: "implementation",
        description: "コード実装",
        goal: "コードの完成",
        systemPrompt: "方針に基づいてコードを実装してください。",
      },
      {
        name: "testing",
        description: "テストと修正",
        goal: "テスト通過",
        systemPrompt: "コードをテストし、問題があれば修正してください。",
        enabledTools: ["read_file", "write_file", "shell", "run_tests"],
      },
    ],

    completionCriteria: [
      "コードが作成されている",
      "構文エラーがない",
      "テストが通過している（該当する場合）",
    ],
  },

  // カスタムツールなし（コアツールのみ使用）
  tools: [],
});

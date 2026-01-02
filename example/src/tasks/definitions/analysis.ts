/**
 * Analysis Task Definition
 *
 * コードベースを分析し、レポートを作成するタスク
 */

import { TaskModule, defineTask } from "../types";

export const analysisTaskModule = defineTask({
  config: {
    name: "analysis",
    displayName: "コード分析",
    description: "コードベースを分析し、レポートを作成",
    goal: "分析レポート",
    defaultMode: "exploration",

    systemPrompt: `あなたはコード分析の専門家です。

## 分析観点
- アーキテクチャ
- コード品質
- 潜在的な問題
- 改善提案`,

    enabledCoreTools: ["read_file", "list_files"],
    enabledTaskTools: [],

    completionCriteria: [
      "分析が完了している",
      "レポートが作成されている",
    ],
  },

  tools: [],
});

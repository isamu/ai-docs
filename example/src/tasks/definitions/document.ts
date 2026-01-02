/**
 * Document Task Definition
 *
 * ドキュメントやREADMEを作成するタスク
 */

import { TaskModule, defineTask } from "../types";

export const documentTaskModule = defineTask({
  config: {
    name: "document",
    displayName: "ドキュメント作成",
    description: "ドキュメントやREADMEを作成",
    goal: "完成したドキュメント",
    defaultMode: "planning",

    systemPrompt: `あなたはテクニカルライターです。

## 原則
- 明確で簡潔な文章
- 適切な構造化
- コード例を含める
- 対象読者を意識`,

    enabledCoreTools: ["read_file", "write_file", "list_files"],
    enabledTaskTools: [],

    completionCriteria: [
      "ドキュメントが作成されている",
      "必要な情報が含まれている",
    ],
  },

  tools: [],
});

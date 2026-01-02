# 開発者ガイド

このガイドでは、AIエージェントにタスクとツールを追加する方法を説明します。

## 目次

- [アーキテクチャ概要](#アーキテクチャ概要)
- [ツールの追加](#ツールの追加)
- [タスクの追加](#タスクの追加)
- [フェーズの設定](#フェーズの設定)
- [実例: MulmoScriptタスク](#実例-mulmoscriptタスク)

---

## アーキテクチャ概要

```
src/
├── tasks/
│   ├── definitions/          # タスク定義（ここに新規タスクを追加）
│   │   ├── index.ts          # 全タスクのエクスポート
│   │   ├── mulmo.ts          # MulmoScriptタスク（サンプル）
│   │   ├── codegen.ts
│   │   └── ...
│   ├── types.ts              # 型定義
│   └── task-config-manager.ts
├── tools/
│   ├── types.ts              # ToolDefinition型
│   ├── index.ts              # ツールレジストリ
│   └── *.ts                  # コアツール
└── context/
    └── agent-context.ts      # セッション・モード管理
```

---

## ツールの追加

### 基本的なツール

`ToolDefinition`インターフェースを使用してツールを定義します。

```typescript
// src/tools/my-tool.ts
import { ToolDefinition, defineTool } from "./types";

export const myTool = defineTool({
  definition: {
    name: "my_tool",
    description: "ツールの説明（LLMに表示される）",
    inputSchema: {
      type: "object",
      properties: {
        param1: {
          type: "string",
          description: "パラメータ1の説明",
        },
        param2: {
          type: "number",
          description: "パラメータ2の説明",
        },
      },
      required: ["param1"],
    },
  },

  execute: async (input, context) => {
    // input はLLMからの入力パラメータ
    const param1 = input.param1 as string;
    const param2 = input.param2 as number | undefined;

    // 処理を実行
    const result = doSomething(param1, param2);

    // 結果を文字列で返す（LLMに渡される）
    return `処理完了: ${result}`;
  },
});
```

### コンテキスト対応ツール

セッション情報が必要な場合は、`context`パラメータを使用します。

```typescript
export const sessionAwareTool = defineTool({
  definition: { /* ... */ },

  execute: async (input, context) => {
    // アクティブなセッションを取得
    const session = context?.getActiveSession();
    if (!session) {
      return "エラー: アクティブなセッションがありません";
    }

    // セッション状態を取得・更新
    const state = session.state as TaskSessionState;
    context!.updateSessionState({
      ...state,
      artifacts: [...state.artifacts, "new-file.txt"],
    });

    return "完了";
  },
});
```

### コアツールとして登録

コアツール（全タスクで使用可能）として登録する場合:

```typescript
// src/tools/index.ts
import { myTool } from "./my-tool";

const coreToolRegistry: Record<string, ToolDefinition> = {
  // ...既存のツール
  my_tool: myTool,  // 追加
};
```

---

## タスクの追加

### 基本構造

`src/tasks/definitions/`に新しいファイルを作成します。

```typescript
// src/tasks/definitions/my-task.ts
import { TaskModule, TaskSessionState, defineTask } from "../types";
import { defineTool } from "../../tools/types";

// ============================================================
// タスク固有ツール
// ============================================================

const myCustomTool = defineTool({
  definition: {
    name: "my_custom_tool",
    description: "このタスク専用のツール",
    inputSchema: { /* ... */ },
  },
  execute: async (input, context) => {
    // ...
  },
});

// ============================================================
// タスクモジュール定義
// ============================================================

export const myTaskModule = defineTask({
  config: {
    name: "my-task",              // タスク名（start_sessionで使用）
    displayName: "マイタスク",     // 表示名
    description: "タスクの説明",
    goal: "タスクのゴール",
    defaultMode: "implementation", // "conversation" | "exploration" | "planning" | "implementation"

    systemPrompt: `タスク用のシステムプロンプト。
LLMに対してタスクの進め方を指示します。`,

    // コアツールから使用するもの
    enabledCoreTools: ["read_file", "write_file", "list_files"],

    // タスク固有ツール
    enabledTaskTools: ["my_custom_tool"],

    // 完了条件（システムプロンプトに追加される）
    completionCriteria: [
      "条件1が満たされている",
      "条件2が満たされている",
    ],
  },

  // タスク固有ツールの配列
  tools: [myCustomTool],
});
```

### タスクを登録

```typescript
// src/tasks/definitions/index.ts
import { myTaskModule } from "./my-task";

export const taskModules: TaskModule[] = [
  // ...既存のタスク
  myTaskModule,  // 追加
];

export { myTaskModule } from "./my-task";
```

---

## フェーズの設定

複数のフェーズを持つタスクを定義できます。

```typescript
export const myTaskModule = defineTask({
  config: {
    name: "my-task",
    // ...

    phases: [
      {
        name: "planning",
        description: "計画フェーズ",
        goal: "実装計画の策定",
        systemPrompt: "ユーザーの要望をヒアリングし、計画を立ててください。",
        requiresApproval: true,  // 次のフェーズに進む前に確認
        approvalPrompt: "この計画で進めてよろしいですか？",
        enabledTools: ["read_file", "list_files"],  // このフェーズで使えるツール
      },
      {
        name: "implementation",
        description: "実装フェーズ",
        goal: "コードの完成",
        systemPrompt: "計画に基づいて実装してください。",
        // enabledToolsを省略すると、config.enabledCoreTools + enabledTaskToolsが使用される
      },
      {
        name: "testing",
        description: "テストフェーズ",
        goal: "テスト通過",
        systemPrompt: "テストを実行し、問題があれば修正してください。",
        enabledTools: ["read_file", "write_file", "shell"],
      },
    ],

    // ...
  },
  tools: [],
});
```

### フェーズの進行

ユーザーまたはLLMが`advance_phase`ツールを使用してフェーズを進めます。

---

## 実例: MulmoScriptタスク

完全な実装例として、`src/tasks/definitions/mulmo.ts`を参照してください。

### ポイント

1. **専用ツールの定義**: `createBeatsOnMulmoScript`と`validate_mulmo`
2. **write_fileの制限**: writingフェーズでは`write_file`を無効化し、専用ツールのみ許可
3. **バリデーション**: mulmocastパッケージのスキーマで検証
4. **セッション状態の更新**: 生成したファイルを`artifacts`に追加

```typescript
// フェーズごとのツール制限
phases: [
  {
    name: "writing",
    enabledTools: ["read_file", "createBeatsOnMulmoScript"],  // write_fileなし
  },
]
```

---

## ツールでのガード

特定のタスクでツールの使用を制限する場合:

```typescript
// src/tools/write_file.ts
const TASK_WRITE_RESTRICTIONS: Record<string, {
  message: string;
  suggestedTool: string;
}> = {
  mulmo: {
    message: "MulmoScriptの作成には専用ツールを使ってください",
    suggestedTool: "createBeatsOnMulmoScript",
  },
};

export const writeFileTool = defineTool({
  // ...
  execute: async (input, context) => {
    const session = context?.getActiveSession();
    if (session) {
      const restriction = TASK_WRITE_RESTRICTIONS[session.taskType];
      if (restriction) {
        return `⚠️ ${restriction.message}\n推奨ツール: ${restriction.suggestedTool}`;
      }
    }
    // 通常の処理
  },
});
```

---

## 型定義

### TaskConfig

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `name` | `string` | タスク名（一意） |
| `displayName` | `string` | 表示名 |
| `description` | `string` | タスクの説明 |
| `goal` | `string` | タスクのゴール |
| `defaultMode` | `AgentMode` | デフォルトモード |
| `systemPrompt` | `string` | システムプロンプト |
| `enabledCoreTools` | `string[]` | 有効なコアツール名 |
| `enabledTaskTools` | `string[]` | 有効なタスク固有ツール名 |
| `phases` | `TaskPhase[]` | フェーズ定義（オプション） |
| `completionCriteria` | `string[]` | 完了条件 |

### TaskPhase

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `name` | `string` | フェーズ名 |
| `description` | `string` | フェーズの説明 |
| `goal` | `string` | フェーズのゴール |
| `systemPrompt` | `string?` | 追加のシステムプロンプト |
| `requiresApproval` | `boolean?` | ユーザー確認が必要か |
| `approvalPrompt` | `string?` | 確認時のプロンプト |
| `enabledTools` | `string[]?` | このフェーズで有効なツール |

### ToolDefinition

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `definition` | `ToolSchema` | LLMに渡すツール定義 |
| `execute` | `(input, context?) => Promise<string>` | 実行関数 |

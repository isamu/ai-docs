# AI Agent Framework

**モジュラーアーキテクチャ、セッション管理、タスク駆動ワークフローを備えた本格的なAIエージェント**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Claude API](https://img.shields.io/badge/Claude-claude--sonnet--4-purple.svg)](https://www.anthropic.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```
[conversation] > 宇宙旅行の動画スクリプトを作って

🤖 LLMの応答:
MulmoScriptを作成しますね！まずヒアリングさせてください...

🔧 ツール使用: start_session
🔧 ツール使用: createBeatsOnMulmoScript

✅ MulmoScript作成完了！
📄 ファイル: space_travel_1704067200.mulmo.json
```

---

## 特徴

### コアアーキテクチャ

| 機能 | 説明 |
|------|------|
| **モードスタック** | 実行モードのpush/pop（conversation → planning → implementation） |
| **セッション管理** | 複数タスクの中断・再開をサポート |
| **タスクパイプライン** | フェーズごとに使用可能なツールを制御するワークフロー定義 |
| **履歴分離** | 各セッションが独立した会話履歴を保持 |
| **LLM抽象化** | プロバイダー（Anthropic、OpenAI等）をコード変更なしで切り替え |

### 組み込みツール

```
read_file          ファイル読み込み
write_file         ファイル書き込み（タスク対応ガード付き）
list_files         ディレクトリ一覧
calculator         安全な数式計算
get_current_time   現在時刻取得
```

### タスクシステム

専用ワークフローを持つ事前定義タスク：

- **mulmo** - MulmoScript動画スクリプト作成（3フェーズ: planning → writing → validation）
- **codegen** - コード生成（analysis → implementation → testing）
- **document** - ドキュメント作成
- **analysis** - コードベース探索

---

## クイックスタート

### インストール

```bash
git clone https://github.com/yourname/ai-agent-example.git
cd ai-agent-example
npm install
```

### 設定

```bash
cp .env.example .env
# ANTHROPIC_API_KEY を設定
```

### 実行

```bash
npm start
```

### 基本的な使い方

```
[conversation] > ファイル一覧を見せて
🔧 ツール使用: list_files
📁 workspace/
  - example.txt
  - output/

[conversation] > /mode implementation
[implementation] > 新しい機能を実装して
```

### セッション操作

```
[conversation] > 動画スクリプトを作って
🔧 ツール使用: start_session (task_type: mulmo)

[implementation:mulmo] > 一旦中断して別の作業をしたい
🔧 ツール使用: suspend_session

[conversation] > list_sessions
📋 中断中のセッション:
  - abc123: mulmo (suspended)

[conversation] > 再開して
🔧 ツール使用: resume_session

[implementation:mulmo] > 続きをお願い
```

---

## アーキテクチャ

```
src/
├── agent.ts                 # メインエントリーポイント
├── context/
│   ├── agent-context.ts     # 中央状態管理
│   ├── mode-manager.ts      # モードスタック操作
│   ├── session-manager.ts   # セッションライフサイクル
│   └── types.ts             # 型定義
├── tasks/
│   ├── definitions/         # タスクモジュール（設定 + ツール）
│   │   ├── mulmo.ts         # MulmoScriptタスク
│   │   ├── codegen.ts       # コード生成タスク
│   │   └── ...
│   ├── types.ts             # TaskModule, TaskConfig型
│   └── task-config-manager.ts
├── tools/
│   ├── types.ts             # ToolDefinitionインターフェース
│   ├── index.ts             # ツールレジストリ
│   └── *.ts                 # 個別ツール
├── llm/
│   ├── types.ts             # LLMProviderインターフェース
│   └── anthropic.ts         # Claude実装
└── history/
    └── conversation-history.ts
```

---

## 開発者ガイド

### ツールの追加

```typescript
// src/tools/my-tool.ts
import { defineTool } from "./types";

export const myTool = defineTool({
  definition: {
    name: "my_tool",
    description: "便利な処理を実行",
    inputSchema: {
      type: "object",
      properties: {
        param: { type: "string", description: "入力パラメータ" }
      },
      required: ["param"]
    }
  },

  // context はオプション - セッション情報が必要な場合に使用
  execute: async (input, context) => {
    const session = context?.getActiveSession();
    return `結果: ${input.param}`;
  }
});
```

### タスクの追加

```typescript
// src/tasks/definitions/my-task.ts
import { defineTask, defineTool } from "../types";

const myCustomTool = defineTool({
  definition: { name: "custom_action", ... },
  execute: async (input, context) => { ... }
});

export const myTaskModule = defineTask({
  config: {
    name: "my-task",
    displayName: "マイタスク",
    description: "このタスクの説明",
    goal: "期待される成果物",
    defaultMode: "implementation",

    systemPrompt: `あなたは...の専門家です`,

    enabledCoreTools: ["read_file", "write_file"],
    enabledTaskTools: ["custom_action"],

    phases: [
      {
        name: "planning",
        description: "計画フェーズ",
        goal: "明確な計画",
        requiresApproval: true,
        approvalPrompt: "この計画で進めますか？",
        enabledTools: ["read_file"]  // ツール制限
      },
      {
        name: "execution",
        description: "実行フェーズ",
        goal: "完成した成果物"
        // enabledCoreTools + enabledTaskTools をすべて使用
      }
    ],

    completionCriteria: [
      "出力ファイルが作成されている",
      "バリデーションが通過している"
    ]
  },

  tools: [myCustomTool]
});
```

### タスク対応ツールガード

LLMが間違ったツールを使うのを防止：

```typescript
// write_file ツール内
const TASK_RESTRICTIONS = {
  mulmo: {
    message: "createBeatsOnMulmoScriptを使用してください",
    suggestedTool: "createBeatsOnMulmoScript"
  }
};

execute: async (input, context) => {
  const session = context?.getActiveSession();
  if (session && TASK_RESTRICTIONS[session.taskType]) {
    return `⚠️ ${TASK_RESTRICTIONS[session.taskType].message}`;
  }
  // 通常の処理...
}
```

---

## なぜこのアーキテクチャ？

### モードスタック > 単純な状態管理

```typescript
// 従来: コンテキストを失う
agent.mode = "implementation";
// ...後で...
agent.mode = "conversation"; // 何をしてたっけ？

// このフレームワーク: コンテキストを維持
context.pushMode("implementation", sessionId);
context.pushMode("review"); // 一時的な切り替え
context.popMode(); // implementationに戻る
context.popToBase(); // クリーンに終了
```

### セッション分離

各タスクは独自の会話履歴を持つ。タスク間の混同なし。

```typescript
// セッションA: "REST APIを作って"
// セッションB: "ユニットテストを書いて"
// Aを中断、Bで作業、Aを再開 - コンテキストは保持される
```

### フェーズベースのツール制御

LLMは時に...クリエイティブすぎる。フェーズで早まった行動を防止：

```typescript
phases: [
  { name: "planning", enabledTools: ["read_file"] },      // 読み取りのみ
  { name: "implementation", enabledTools: ["write_file"] } // 書き込み可能に
]
```

---

## テスト

```bash
# 全テスト実行
npm test

# 型チェック
npm run typecheck

# リント
npm run lint
```

265のテストをカバー：
- コンテキスト管理
- セッションライフサイクル
- モードスタック操作
- ツール実行
- タスク設定

---

## ロードマップ

### 開発中

- [ ] **並列ツール実行** - 独立したツールを同時実行
- [ ] **ストリーミングツール結果** - 長時間操作のプログレス出力
- [ ] **Memory/RAG統合** - 長期コンテキストの永続化

### 計画中

- [ ] **マルチエージェント連携** - 複雑なタスクにサブエージェントを生成
- [ ] **プラグインシステム** - ツールとタスクのホットリロード
- [ ] **Web UI** - 視覚的なセッション管理
- [ ] **OpenAIプロバイダー** - GPT-4サポート
- [ ] **ローカルLLMサポート** - Ollama統合

### 検討中

- [ ] **自動リカバリ** - 障害からの復旧
- [ ] **コスト追跡** - セッションごとのトークン使用量
- [ ] **承認ワークフロー** - 重要な操作にHuman-in-the-loop

---

## 関連プロジェクト

- [mulmocast](https://github.com/snakajima/mulmocast) - mulmoタスクで使用する動画スクリプトフォーマット
- [Claude API](https://docs.anthropic.com/) - AnthropicのClaude API

---

## コントリビュート

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. テストを実行 (`npm test`)
4. 変更をコミット
5. ブランチをプッシュ
6. Pull Requestを作成

詳細な開発ドキュメントは [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) を参照してください。

---

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照。

---

<p align="center">
  <sub>Claude APIとTypeScriptで構築</sub>
</p>

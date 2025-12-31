# Step 2: 最小限のツール

## 🎯 このステップで学ぶこと

- ツールの定義方法
- 複数ツールの管理
- LLMによるツール選択と実行
- ツール実行結果のLLMへの返却

## 📝 概要

Step 1の基本的なループに、実際に使えるツールを追加します。このステップでは、以下の2つのシンプルなツールを実装します：

1. **calculator** - 数式を計算する
2. **get_current_time** - 現在時刻を取得する

### 動作の流れ

```
1. ユーザーがタスクを入力
   ↓
2. LLMを呼び出し
   ↓
3. LLMの応答を確認
   ├─ attempt_completion？ → 終了
   ├─ calculator？ → 計算実行 → 結果をLLMに返す → 2に戻る
   ├─ get_current_time？ → 時刻取得 → 結果をLLMに返す → 2に戻る
   └─ テキストのみ？ → 表示 → 2に戻る
```

## 🔑 重要な概念

### 1. ツールの定義

各ツールには以下の情報が必要です：

```typescript
{
  name: "calculator",           // ツール名（一意）
  description: "数式を計算する", // LLMがこれを読んで使うかどうか判断
  input_schema: {               // 入力パラメータの定義（JSON Schema）
    type: "object",
    properties: {
      expression: {
        type: "string",
        description: "計算したい数式（例: '2 + 2'）"
      }
    },
    required: ["expression"]
  }
}
```

### 2. ツールの実行

LLMがツールを選ぶと、`tool_use`ブロックが返ってきます：

```typescript
{
  type: "tool_use",
  id: "toolu_01ABC123",  // 一意のID
  name: "calculator",     // ツール名
  input: {                // ツールへの入力
    expression: "2 + 2"
  }
}
```

これを受け取ったら、実際にツールを実行します：

```typescript
const result = executeTool(toolUse.name, toolUse.input);
// result: "4"
```

### 3. ツール実行結果をLLMに返す

ツールを実行したら、その結果を`tool_result`メッセージとしてLLMに返します：

```typescript
messages.push({
  role: "user",  // ツール結果はuserロールで返す
  content: [
    {
      type: "tool_result",
      tool_use_id: toolUse.id,  // 元のtool_useのIDと紐付け
      content: "4"               // ツールの実行結果
    }
  ]
});
```

### 4. LLMがツール結果を使って応答

ツール結果を受け取ったLLMは、それを使って最終的な応答を生成します：

```
User: "2+2を計算して"
  ↓
LLM: [calculator(expression="2+2")を使う]
  ↓
Tool: "4"
  ↓
LLM: "2+2の計算結果は4です。"
```

## 💻 コードの構造

```
step-02-minimal-tools/
├── README.md          # このファイル
├── package.json       # 依存関係
├── .env.example       # 環境変数のサンプル
└── agent.ts           # メインの実装
```

## 🚀 実行方法

### 1. セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env ファイルにAPIキーを記入
```

### 2. 実行

```bash
npx tsx agent.ts
```

### 3. 試してみよう

以下のようなタスクを試してみてください：

- "2+2を計算して"
- "今何時？"
- "(10 * 5) + 3を計算して、その結果を教えて"
- "今日の日付と時刻を教えて"

## 📊 動作例

```
$ npx tsx agent.ts

タスクを入力してください: 123 * 456を計算して、今の時刻も教えて

--- イテレーション 1 ---
🤖 LLMの応答:
🔧 ツール使用: calculator
   入力: {"expression":"123 * 456"}
   結果: 56088

--- イテレーション 2 ---
🤖 LLMの応答:
🔧 ツール使用: get_current_time
   入力: {}
   結果: 2026-01-01 15:30:45

--- イテレーション 3 ---
🤖 LLMの応答:
123 × 456の計算結果は56,088です。
現在の時刻は2026年1月1日 15時30分45秒です。

✅ タスク完了: 123 × 456 = 56,088。現在時刻: 2026-01-01 15:30:45
```

## 🔍 コードの詳細解説

### ツール定義の配列

```typescript
const TOOLS = [
  {
    name: "calculator",
    description: "数式を計算します。四則演算（+, -, *, /）と括弧が使えます。",
    input_schema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "計算したい数式"
        }
      },
      required: ["expression"]
    }
  },
  {
    name: "get_current_time",
    description: "現在の日時を取得します。",
    input_schema: {
      type: "object",
      properties: {},  // パラメータなし
      required: []
    }
  },
  {
    name: "attempt_completion",
    // ... (Step 1と同じ)
  }
];
```

### ツール実行関数

```typescript
function executeTool(toolName: string, input: any): string {
  switch (toolName) {
    case "calculator":
      // eval()を使って数式を計算（本番環境では安全な代替手段を使用）
      try {
        const result = eval(input.expression);
        return String(result);
      } catch (error) {
        return `エラー: ${error.message}`;
      }

    case "get_current_time":
      // 現在時刻を返す
      return new Date().toLocaleString("ja-JP");

    default:
      return `不明なツール: ${toolName}`;
  }
}
```

### 応答処理の拡張

```typescript
function processResponse(response: Message, messages: Message[]): boolean {
  // まずassistantの応答を履歴に追加
  messages.push({
    role: "assistant",
    content: response.content
  });

  // tool_useブロックを探す
  const toolUses = response.content.filter(
    block => block.type === "tool_use"
  );

  if (toolUses.length > 0) {
    // ツールが使われた
    const toolResults = [];

    for (const toolUse of toolUses) {
      if (toolUse.name === "attempt_completion") {
        // 完了
        return false;
      } else {
        // 他のツールを実行
        const result = executeTool(toolUse.name, toolUse.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result
        });
      }
    }

    // ツール結果を追加
    if (toolResults.length > 0) {
      messages.push({
        role: "user",
        content: toolResults
      });
    }
  }

  return true; // 継続
}
```

## 🎨 重要なポイント

### ✅ DO（推奨）

1. **明確なツール説明を書く**
   - LLMはdescriptionを読んでツールを選ぶ
   - 具体的な使用例を含める

2. **エラーハンドリング**
   - ツール実行が失敗する可能性を考慮
   - エラーメッセージをツール結果として返す

3. **入力検証**
   - 危険な入力をチェック
   - 適切な型変換を行う

### ❌ DON'T（非推奨）

1. **eval()を本番環境で使わない**
   - セキュリティリスクが高い
   - 代わりに専用の数式パーサーを使う

2. **ツール結果のIDを間違えない**
   - `tool_use_id`は必ず元の`tool_use`のIDと一致させる

## 🤔 よくある質問

### Q1: LLMは必ずツールを使う？

A: いいえ。LLMは必要に応じてツールを使います。簡単な質問なら、ツールを使わずに直接答えることもあります。

### Q2: 複数のツールを同時に使える？

A: はい。LLMは1つの応答で複数のツールを使うことができます。例えば、計算と時刻取得を同時に行うなど。

### Q3: カスタムツールを追加するには？

A: TOOLS配列に新しいツール定義を追加し、executeTool関数にそのツールの実装を追加するだけです。

## 🎓 次のステップへ

このステップでは、ツールの基本的な使い方を学びました。次のステップでは、**ファイル操作ツール**を追加して、実際のコーディング作業に近づけます。

→ [Step 3: ファイル操作](../step-03-file-operations/)

## 📚 参考リンク

- [Tool Use Guide](https://docs.anthropic.com/claude/docs/tool-use)
- [Tool Use Examples](https://docs.anthropic.com/claude/docs/tool-use-examples)
- [JSON Schema Reference](https://json-schema.org/understanding-json-schema/)

---

最終更新: 2026-01-01

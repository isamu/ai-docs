# Step 1: シンプルなループ

## 🎯 このステップで学ぶこと

- Claude APIとの基本的な対話
- `attempt_completion`ツールによるタスク完了の判定
- while loopによる対話の継続

## 📝 概要

最もシンプルなAIエージェントの実装です。ユーザーからタスクを受け取り、LLMが考えて応答し、完了したら`attempt_completion`ツールを使ってループを終了します。

### 動作の流れ

```
1. ユーザーがタスクを入力
   ↓
2. LLMを呼び出し
   ↓
3. LLMの応答を確認
   ├─ attempt_completionツールを使った？
   │  └─ YES → 結果を表示して終了
   │  └─ NO  → 応答を表示して2に戻る
```

## 🔑 重要な概念

### 1. Tool Useの基本

Claude APIでは、LLMにツール（関数）を渡すことができます。LLMは状況に応じて適切なツールを選んで使います。

```typescript
const tools = [
  {
    name: "attempt_completion",
    description: "タスクが完了したときに呼ぶツール",
    input_schema: {
      type: "object",
      properties: {
        result: { type: "string", description: "タスクの結果" }
      }
    }
  }
];
```

### 2. メッセージの形式

Claudeとの対話は、メッセージの配列として管理されます：

```typescript
const messages = [
  {
    role: "user",      // ユーザーのメッセージ
    content: "こんにちは"
  },
  {
    role: "assistant", // LLMの応答
    content: "こんにちは！何かお手伝いできることはありますか？"
  }
];
```

### 3. ストリーミング応答

LLMからの応答はストリーミングで受け取ることができます。これにより、リアルタイムで応答を表示できます：

```typescript
const stream = await anthropic.messages.create({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 4096,
  messages: messages,
  tools: tools,
  stream: true  // ストリーミングを有効化
});

for await (const event of stream) {
  if (event.type === "content_block_delta") {
    // テキストを1文字ずつ受け取る
    process.stdout.write(event.delta.text);
  }
}
```

### 4. ループの終了判定

LLMが`attempt_completion`ツールを使ったときにループを終了します：

```typescript
let shouldContinue = true;

while (shouldContinue) {
  const response = await callClaude(messages);

  // ツールが使われたかチェック
  const toolUse = response.content.find(block => block.type === "tool_use");

  if (toolUse && toolUse.name === "attempt_completion") {
    // 完了！
    console.log("\n✅ タスク完了:", toolUse.input.result);
    shouldContinue = false;
  } else {
    // まだ続く
    messages.push({ role: "assistant", content: response.content });
  }
}
```

## 💻 コードの構造

```
step-01-simple-loop/
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

- "2+2の計算をして"
- "Pythonでフィボナッチ数列を計算する関数を書いて"
- "TypeScriptの特徴を3つ教えて"

## 📊 動作例

```
$ npx tsx agent.ts

タスクを入力してください: 2+2の計算をして

🤖 LLMの応答:
2+2の計算は簡単です。答えは4です。

✅ タスク完了: 2+2=4です。
```

## 🔍 コードの詳細解説

### メイン関数の流れ

```typescript
async function main() {
  // 1. APIクライアント初期化
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  // 2. ユーザー入力を取得
  const task = await getUserInput();

  // 3. メッセージ履歴を初期化
  const messages = [
    { role: "user", content: task }
  ];

  // 4. ループ開始
  let shouldContinue = true;
  while (shouldContinue) {
    // LLMを呼び出し
    const response = await callClaude(anthropic, messages);

    // 応答を処理
    shouldContinue = processResponse(response, messages);
  }
}
```

### Tool Useの検出

```typescript
function processResponse(response, messages) {
  // 応答からtool_useブロックを探す
  const toolUse = response.content.find(
    block => block.type === "tool_use"
  );

  if (toolUse && toolUse.name === "attempt_completion") {
    // 完了ツールが使われた → 終了
    console.log("\n✅ タスク完了:", toolUse.input.result);
    return false;  // ループ終了
  } else {
    // まだ続く
    messages.push({ role: "assistant", content: response.content });
    return true;   // ループ継続
  }
}
```

## 🤔 よくある質問

### Q1: なぜ`attempt_completion`が必要？

A: LLMに「完了した」と明示的に伝えてもらうためです。テキストだけだと「完了したかどうか」を判定するのが難しいですが、ツールを使うことで明確に判定できます。

### Q2: LLMが永遠にループする可能性は？

A: あります。このシンプルな実装では、LLMが`attempt_completion`を使わない限り続きます。実際のアプリケーションでは、最大ループ回数を設定するなどの対策が必要です（後のステップで実装します）。

### Q3: エラーハンドリングは？

A: このステップでは省略していますが、実際のアプリケーションでは、API呼び出しのエラーやネットワークエラーに対処する必要があります。

## 🎓 次のステップへ

このステップでは、最もシンプルなループを実装しました。次のステップでは、**実際に使えるツール**を追加して、LLMに計算や情報取得をさせてみます。

→ [Step 2: 最小限のツール](../step-02-minimal-tools/)

## 📚 参考リンク

- [Tool Use Documentation](https://docs.anthropic.com/claude/docs/tool-use)
- [Messages API Reference](https://docs.anthropic.com/claude/reference/messages_post)
- [Streaming Documentation](https://docs.anthropic.com/claude/reference/messages-streaming)

---

最終更新: 2026-01-01

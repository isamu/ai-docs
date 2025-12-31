# Step 4: コンテキスト管理

## 🎯 このステップで学ぶこと

- トークンカウントの実装（js-tiktoken）
- メッセージ履歴の管理とトークン制限への対応
- 古いメッセージの削除戦略
- システムプロンプトの保持

## 📝 概要

Step 3までの実装では、会話が長くなるとClaudeのトークン制限（200K tokens）に引っかかります。このステップでは、メッセージ履歴を管理してトークン制限内に収める方法を学びます。

### 問題

```
ユーザー: "100個のファイルを作成して"
  ↓ (ツールを100回使用)
  ↓ (メッセージが200個以上に)
  ↓
❌ エラー: Token limit exceeded
```

### 解決策

- **トークンカウント**: メッセージの合計トークン数を監視
- **古いメッセージ削除**: 制限に近づいたら古いメッセージを削除
- **重要なメッセージ保持**: システムプロンプトと最近のメッセージは保持

## 🔑 重要な概念

### 1. トークンカウント

`js-tiktoken`を使ってメッセージのトークン数を計算：

```typescript
import { encodingForModel } from "js-tiktoken";

const encoding = encodingForModel("gpt-4");

function countTokens(text: string): number {
  const tokens = encoding.encode(text);
  return tokens.length;
}

function countMessageTokens(messages: Message[]): number {
  let total = 0;
  for (const message of messages) {
    // メッセージのコンテンツをトークンカウント
    const content = typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
    total += countTokens(content);
    total += 4; // メッセージのオーバーヘッド
  }
  return total;
}
```

### 2. コンテキストウィンドウ管理

トークン制限に近づいたら、古いメッセージを削除：

```typescript
const MAX_CONTEXT_TOKENS = 150000; // 150K（余裕を持たせる）

function manageContext(messages: Message[]): Message[] {
  const totalTokens = countMessageTokens(messages);

  if (totalTokens <= MAX_CONTEXT_TOKENS) {
    return messages; // 制限内なのでそのまま
  }

  // 最初のユーザーメッセージ（タスク）は保持
  const firstMessage = messages[0];
  // 最近のN個のメッセージを保持
  const recentMessages = messages.slice(-20);

  return [firstMessage, ...recentMessages];
}
```

### 3. メッセージペアの保持

Assistant-Userのペアを崩さないように削除：

```typescript
function manageContext(messages: Message[]): Message[] {
  const totalTokens = countMessageTokens(messages);

  if (totalTokens <= MAX_CONTEXT_TOKENS) {
    return messages;
  }

  // 最初のメッセージは保持
  const result = [messages[0]];
  let currentTokens = countMessageTokens([messages[0]]);

  // 後ろから順にメッセージを追加
  for (let i = messages.length - 1; i >= 1; i--) {
    const msg = messages[i];
    const msgTokens = countMessageTokens([msg]);

    if (currentTokens + msgTokens > MAX_CONTEXT_TOKENS) {
      break; // 制限を超えるので打ち切り
    }

    result.unshift(msg);
    currentTokens += msgTokens;
  }

  return result;
}
```

### 4. トークン使用状況の表示

ユーザーに現在のトークン使用状況を表示：

```typescript
function displayTokenUsage(messages: Message[]) {
  const totalTokens = countMessageTokens(messages);
  const percentage = (totalTokens / MAX_CONTEXT_TOKENS) * 100;

  console.log(
    `📊 コンテキスト使用状況: ${totalTokens.toLocaleString()} / ` +
    `${MAX_CONTEXT_TOKENS.toLocaleString()} tokens (${percentage.toFixed(1)}%)`
  );
}
```

## 💻 コードの構造

```
step-04-context-management/
├── README.md          # このファイル
├── package.json       # 依存関係（js-tiktokenを追加）
├── .env.example       # 環境変数のサンプル
├── agent.ts           # メインの実装
└── workspace/         # テスト用ワークスペース
```

## 🚀 実行方法

### 1. セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
```

### 2. 実行

```bash
npx tsx agent.ts
```

### 3. 試してみよう

コンテキスト管理の動作を確認するには：

- 長い会話を試す（複数のファイル操作を連続で）
- 大きなファイルの読み書き
- 計算や時刻取得を多数回実行

各イテレーションでトークン使用状況が表示されます。

## 📊 動作例

```
$ npx tsx agent.ts

タスクを入力してください: workspace/に10個のテストファイルを作成して

--- イテレーション 1 ---
📊 コンテキスト使用状況: 1,234 / 150,000 tokens (0.8%)

🤖 LLMの応答:
🔧 ツール使用: write_file
   ...

--- イテレーション 15 ---
📊 コンテキスト使用状況: 45,678 / 150,000 tokens (30.5%)

🤖 LLMの応答:
...

--- イテレーション 20 ---
📊 コンテキスト使用状況: 152,000 / 150,000 tokens (101.3%)
⚠️ コンテキスト制限に近づいています。古いメッセージを削除します。
📊 削除後: 48,234 / 150,000 tokens (32.2%)

✅ タスク完了: 10個のファイルを作成しました
```

## 🔍 コードの詳細解説

### トークンカウンターの実装

```typescript
import { encodingForModel } from "js-tiktoken";

class TokenCounter {
  private encoding;

  constructor() {
    // Claude Sonnetは内部的にGPT-4と同じトークナイザーを使用
    this.encoding = encodingForModel("gpt-4");
  }

  /**
   * テキストのトークン数をカウント
   */
  countTokens(text: string): number {
    const tokens = this.encoding.encode(text);
    return tokens.length;
  }

  /**
   * メッセージ配列の合計トークン数をカウント
   */
  countMessageTokens(messages: Message[]): number {
    let total = 0;

    for (const message of messages) {
      // roleのトークン
      total += 4; // 各メッセージには約4トークンのオーバーヘッド

      // contentのトークン
      if (typeof message.content === "string") {
        total += this.countTokens(message.content);
      } else if (Array.isArray(message.content)) {
        // ツール結果などの構造化コンテンツ
        total += this.countTokens(JSON.stringify(message.content));
      }
    }

    return total;
  }

  /**
   * リソースを解放
   */
  free() {
    this.encoding.free();
  }
}
```

### コンテキスト管理クラス

```typescript
class ContextManager {
  private maxTokens: number;
  private tokenCounter: TokenCounter;

  constructor(maxTokens: number = 150000) {
    this.maxTokens = maxTokens;
    this.tokenCounter = new TokenCounter();
  }

  /**
   * コンテキストを管理（必要に応じてメッセージを削除）
   */
  manageContext(messages: Message[]): Message[] {
    const totalTokens = this.tokenCounter.countMessageTokens(messages);

    if (totalTokens <= this.maxTokens) {
      return messages; // 制限内
    }

    console.log("\n⚠️ コンテキスト制限に近づいています。古いメッセージを削除します。");

    // 最初のユーザーメッセージ（タスク）は必ず保持
    const firstMessage = messages[0];
    const result: Message[] = [firstMessage];
    let currentTokens = this.tokenCounter.countMessageTokens([firstMessage]);

    // 後ろから順に追加していく
    for (let i = messages.length - 1; i >= 1; i--) {
      const msg = messages[i];
      const msgTokens = this.tokenCounter.countMessageTokens([msg]);

      if (currentTokens + msgTokens > this.maxTokens) {
        break; // これ以上追加できない
      }

      result.splice(1, 0, msg); // 最初のメッセージの後に挿入
      currentTokens += msgTokens;
    }

    const newTotal = this.tokenCounter.countMessageTokens(result);
    console.log(
      `📊 削除後: ${newTotal.toLocaleString()} / ${this.maxTokens.toLocaleString()} tokens`
    );

    return result;
  }

  /**
   * トークン使用状況を表示
   */
  displayUsage(messages: Message[]) {
    const totalTokens = this.tokenCounter.countMessageTokens(messages);
    const percentage = (totalTokens / this.maxTokens) * 100;

    console.log(
      `📊 コンテキスト使用状況: ${totalTokens.toLocaleString()} / ` +
      `${this.maxTokens.toLocaleString()} tokens (${percentage.toFixed(1)}%)`
    );
  }
}
```

### メインループでの使用

```typescript
async function main() {
  const contextManager = new ContextManager(150000);
  const messages: Message[] = [/* ... */];

  while (shouldContinue) {
    // コンテキスト管理
    const managedMessages = contextManager.manageContext(messages);
    contextManager.displayUsage(managedMessages);

    // LLMを呼び出し
    const response = await callClaude(managedMessages);

    // 応答を元のメッセージ配列に追加（managedMessagesではない）
    shouldContinue = await processResponse(response, messages);
  }
}
```

## 🎨 ベストプラクティス

### ✅ DO（推奨）

1. **余裕を持った制限設定**
   - Claudeの制限は200Kだが、150K程度に設定して安全マージンを確保

2. **重要なメッセージを保持**
   - 最初のユーザータスクは必ず保持
   - 最近の会話履歴も保持

3. **トークン使用状況の可視化**
   - ユーザーに現在の状況を表示
   - 警告を出して予測可能に

### ❌ DON'T（非推奨）

1. **削除しすぎない**
   - LLMがコンテキストを失うと、タスクを完了できなくなる

2. **ペアを崩さない**
   - assistant-userのツール呼び出しペアを崩すとエラーになる

## 🤔 よくある質問

### Q1: トークンカウントは正確？

A: `js-tiktoken`はGPT-4用ですが、Claudeも似たトークナイザーを使用しているため、近似値として使えます。完全に正確ではありませんが、実用上問題ありません。

### Q2: どのくらいのメッセージを保持すべき？

A: タスクの複雑さによります。ファイル操作など、過去の履歴が重要な場合は多めに保持。単純な質問応答なら少なくても OK。

### Q3: システムプロンプトは？

A: Claudeではsystemパラメータを別途使用するため、messagesには含まれません。このステップでは扱いませんが、Step 5で追加します。

## 🎓 次のステップへ

このステップでは、トークン制限に対応するコンテキスト管理を実装しました。しかし、古いメッセージを単純に削除すると、重要な情報が失われます。次のステップでは、**サマリー機能**を追加して、古い会話を要約して保持します。

→ [Step 5: サマリー機能](../step-05-summary/)

## 📚 参考リンク

- [js-tiktoken](https://github.com/dqbd/tiktoken)
- [Claude API Token Limits](https://docs.anthropic.com/claude/docs/models-overview)
- [Context Window Management](https://docs.anthropic.com/claude/docs/long-context-window-tips)

---

最終更新: 2026-01-01

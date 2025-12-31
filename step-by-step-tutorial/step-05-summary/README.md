# Step 5: サマリー機能

## 🎯 このステップで学ぶこと

- 会話のサマリー生成（別のLLM呼び出し）
- サマリーと最近のメッセージの組み合わせ
- 段階的なコンテキスト圧縮戦略
- システムプロンプトの活用

## 📝 概要

Step 4では古いメッセージを削除してトークン制限に対応しましたが、重要な情報が失われる問題がありました。このステップでは、古い会話を要約（サマリー）して保持することで、情報を失わずにトークン数を削減します。

### 問題

```
ユーザー: "100個のファイルを作成して"
  ↓ (50個目まで作成)
  ↓ (古いメッセージを削除)
  ↓
LLM: "あれ？どこまで作ったんだっけ？"
❌ コンテキストが失われて、タスクを継続できない
```

### 解決策

古いメッセージを削除する代わりに、サマリーを生成：

```
[サマリー]
ユーザーは100個のファイル作成を依頼。
現在50個まで完了。ファイル名はfile001.txt〜file050.txt。

[最近のメッセージ]
Assistant: file050.txtを作成しました
User: tool_result: ✅成功
...
```

## 🔑 重要な概念

### 1. サマリー生成の仕組み

別のLLM呼び出しで、会話をサマリー：

```typescript
async function generateSummary(messages: Message[]): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-haiku-3-5-20241022", // 安価で高速なモデルを使用
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: `以下の会話を簡潔に要約してください：\n\n${messagesText}`
      }
    ]
  });

  return response.content[0].text;
}
```

### 2. サマリーをシステムプロンプトに含める

```typescript
const systemPrompt = `
あなたはタスクを実行するAIアシスタントです。

## これまでの会話のサマリー
${summary}

## 現在のタスク
上記のサマリーを踏まえて、ユーザーのタスクを継続してください。
`;

const response = await anthropic.messages.create({
  model: MODEL,
  system: systemPrompt,  // システムプロンプトに含める
  messages: recentMessages,
  // ...
});
```

### 3. 段階的なサマリー更新

トークン制限に近づいたらサマリーを生成・更新：

```typescript
class SummaryManager {
  private summary: string = "";

  async updateSummary(oldMessages: Message[], newMessages: Message[]) {
    // 新しいメッセージを要約
    const newSummary = await generateSummary(newMessages);

    // 既存のサマリーと統合
    if (this.summary) {
      this.summary = `${this.summary}\n\n[追加]\n${newSummary}`;
    } else {
      this.summary = newSummary;
    }
  }

  getSummary(): string {
    return this.summary;
  }
}
```

### 4. サマリー + 最近のメッセージ

常に以下の構造を維持：

```
System Prompt:
  - タスク説明
  - サマリー（これまでの会話）

Messages:
  - 最初のユーザーメッセージ（タスク）
  - 最近のN個のメッセージ
```

## 💻 コードの構造

```
step-05-summary/
├── README.md          # このファイル
├── package.json       # 依存関係
├── .env.example       # 環境変数のサンプル
├── agent.ts           # メインの実装
└── workspace/         # テスト用ワークスペース
```

## 🚀 実行方法

### 1. セットアップ

```bash
npm install
cp .env.example .env
# .env ファイルにAPIキーを記入
```

### 2. 実行

```bash
npx tsx agent.ts
```

### 3. 試してみよう

サマリー機能の効果を確認するには、長いタスクを試してください：

- "workspace/に50個のファイルを作成して、それぞれに番号を書き込んで"
- "workspace/の全ファイルを読んで、内容を大文字に変換して保存して"

## 📊 動作例

```
$ npx tsx agent.ts

タスクを入力してください: workspace/に30個のファイルを作成して

--- イテレーション 1 ---
📊 コンテキスト使用状況: 1,234 / 150,000 tokens (0.8%)
🤖 LLMの応答:
🔧 ツール使用: write_file
...

--- イテレーション 25 ---
📊 コンテキスト使用状況: 148,000 / 150,000 tokens (98.7%)

⚠️ コンテキスト制限に近づいています。サマリーを生成します...
📝 サマリー生成中...
✅ サマリー生成完了（523 tokens）

📊 サマリー後: 45,234 / 150,000 tokens (30.2%)
📝 サマリー内容:
ユーザーはworkspace/ディレクトリに30個のファイルを作成するタスクを依頼。
現在25個まで完了（file001.txt〜file025.txt）。
各ファイルには連番が書き込まれている。

--- イテレーション 26 ---
🤖 LLMの応答:
（サマリーを参照しながらタスクを継続）
🔧 ツール使用: write_file
...

✅ タスク完了: 30個のファイルを作成しました
```

## 🔍 コードの詳細解説

### サマリー管理クラス

```typescript
class SummaryManager {
  private summary: string = "";
  private tokenCounter: TokenCounter;

  constructor(tokenCounter: TokenCounter) {
    this.tokenCounter = tokenCounter;
  }

  /**
   * メッセージをサマリーに変換
   */
  async generateSummary(messages: Message[]): Promise<string> {
    console.log("\n📝 サマリー生成中...");

    // メッセージをテキスト形式に変換
    const messagesText = messages
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        return `${role}: ${content}`;
      })
      .join("\n\n");

    // サマリー生成（Haiku使用 = 安価で高速）
    const response = await anthropic.messages.create({
      model: "claude-haiku-3-5-20241022",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `以下の会話を簡潔に要約してください。重要な情報（実行したタスク、結果、現在の状態）を含めてください：\n\n${messagesText}`,
        },
      ],
    });

    const summaryText = response.content[0].text;
    const tokens = this.tokenCounter.countTokens(summaryText);
    console.log(`✅ サマリー生成完了（${tokens} tokens）`);

    return summaryText;
  }

  /**
   * サマリーを更新
   */
  async updateSummary(newMessages: Message[]) {
    const newSummary = await this.generateSummary(newMessages);

    if (this.summary) {
      // 既存のサマリーと統合
      this.summary = `${this.summary}\n\n[追加情報]\n${newSummary}`;
    } else {
      this.summary = newSummary;
    }
  }

  /**
   * サマリーを取得
   */
  getSummary(): string {
    return this.summary;
  }

  /**
   * サマリーをクリア
   */
  clearSummary() {
    this.summary = "";
  }
}
```

### コンテキスト管理の拡張

```typescript
class ContextManager {
  private summaryManager: SummaryManager;

  async manageContext(messages: Message[]): Promise<{
    messages: Message[];
    summary: string;
  }> {
    const totalTokens = this.tokenCounter.countMessageTokens(messages);

    if (totalTokens <= this.maxTokens) {
      return { messages, summary: this.summaryManager.getSummary() };
    }

    console.log("\n⚠️ コンテキスト制限に近づいています。");

    // サマリー対象（古いメッセージ）と保持対象（最近のメッセージ）に分割
    const keepCount = 15; // 最近の15メッセージを保持
    const toSummarize = messages.slice(1, -keepCount); // 最初と最後は除く
    const toKeep = [messages[0], ...messages.slice(-keepCount)];

    // サマリー生成
    await this.summaryManager.updateSummary(toSummarize);

    console.log(
      `📊 削除後: ${messages.length} → ${toKeep.length} messages`
    );
    console.log(`📝 サマリー内容:\n${this.summaryManager.getSummary()}`);

    return {
      messages: toKeep,
      summary: this.summaryManager.getSummary(),
    };
  }
}
```

### システムプロンプトでサマリーを使用

```typescript
async function callClaude(
  messages: Message[],
  summary: string
): Promise<Anthropic.Message> {
  // システムプロンプトにサマリーを含める
  const systemPrompt = summary
    ? `あなたはタスクを実行するAIアシスタントです。

## これまでの会話のサマリー
${summary}

## 指示
上記のサマリーを踏まえて、ユーザーのタスクを継続してください。
サマリーに含まれる情報を活用して、適切に作業を進めてください。`
    : `あなたはタスクを実行するAIアシスタントです。`;

  const response = await anthropic.messages.create({
    model: MODEL,
    system: systemPrompt,
    max_tokens: 4096,
    messages: messages,
    tools: TOOLS,
    stream: true,
  });

  // ...
}
```

## 🎨 ベストプラクティス

### ✅ DO（推奨）

1. **安価なモデルでサマリー生成**
   - Haiku（安価・高速）を使ってコスト削減
   - Sonnetは本タスクにのみ使用

2. **段階的なサマリー更新**
   - 一度に全てをサマリーしない
   - 新しい情報を追加で要約

3. **重要な情報を明示的に要求**
   - サマリーに何を含めるか具体的に指示
   - タスクの状態、結果、次のステップなど

### ❌ DON'T（非推奨）

1. **サマリーが長すぎる**
   - サマリー自体がトークンを消費しすぎると本末転倒
   - 簡潔さを保つ

2. **頻繁にサマリーを生成**
   - API呼び出しコストがかかる
   - 本当に必要なときだけ

## 🤔 よくある質問

### Q1: サマリーの精度は？

A: LLMが生成するので、完璧ではありません。重要な情報が欠落する可能性があります。本番環境では、重要な情報（ファイル名リストなど）は構造化して別途保持することも検討してください。

### Q2: どのくらいの頻度でサマリー生成すべき？

A: トークン使用率が80-90%に達したときが目安です。頻繁すぎるとコストがかかり、少なすぎるとトークン制限に引っかかります。

### Q3: サマリーをファイルに保存できる？

A: はい。長時間実行するエージェントでは、サマリーをファイルに保存して、再起動時に読み込むことも有効です。

## 🎓 まとめ

このステップで、完全な機能を持つAIエージェントシステムが完成しました！

### 学んだこと

1. **Step 1**: シンプルなLLMループ - `attempt_completion`による終了判定
2. **Step 2**: ツールの追加 - 計算、時刻取得
3. **Step 3**: ファイル操作 - 読み書き、一覧表示
4. **Step 4**: コンテキスト管理 - トークンカウント、メッセージ削除
5. **Step 5**: サマリー機能 - 会話の要約、情報の保持

### 次のステップ

これらの基礎を応用して、さらに高度なシステムを構築できます：

- **マルチモーダル処理**: 画像、PDF、動画の処理
- **RAG（検索拡張生成）**: ベクトルDBとの統合
- **エージェントオーケストレーション**: 複数のエージェントを組み合わせる
- **ストリーミングUI**: Webインターフェースの追加

## 📚 参考リンク

- [Claude API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [Long Context Tips](https://docs.anthropic.com/claude/docs/long-context-window-tips)

---

最終更新: 2026-01-01

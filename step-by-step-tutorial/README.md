# Step by Step チュートリアル：AIエージェントを作る

このチュートリアルでは、Claude APIを使って、段階的にAIエージェントシステムを構築していきます。
各ステップで新しい機能を追加しながら、実際に動くコードで学習できます。

**全5ステップ完成済み** - すぐに始められます！

## 🎯 学習目標

- LLMとの基本的な対話ループの実装
- Tool Useの仕組みとツールの追加方法
- ファイル操作とコンテキスト管理
- 長い会話のサマリー生成

## 📚 ステップ一覧

### ✅ [Step 1: シンプルなループ](./step-01-simple-loop/)
**学ぶこと**: LLMとの基本的な対話ループ、`attempt_completion`ツールによる終了判定

最もシンプルな実装。ユーザーの質問に答えて、完了したら終了するだけのエージェント。

**主な概念**:
- Claude APIの基本的な使い方
- Tool Useの基礎（attempt_completionツールのみ）
- while loopによる対話の継続

---

### ✅ [Step 2: 最小限のツール](./step-02-minimal-tools/)
**学ぶこと**: ツールの追加、複数ツールの管理

計算機と時刻取得の2つのシンプルなツールを追加。LLMがツールを選んで使う様子を観察。

**主な概念**:
- ツールの定義方法（name, description, input_schema）
- LLMによるツール選択
- ツール実行結果のLLMへの返却

---

### ✅ [Step 3: ファイル操作](./step-03-file-operations/)
**学ぶこと**: ファイルの読み書き、実用的なツールの実装

ファイル読み込み・書き込みツールを追加。実際のコーディング補助に近づく。

**主な概念**:
- 非同期ファイル操作
- エラーハンドリング
- セキュリティ考慮（パス検証など）

---

### ✅ [Step 4: コンテキスト管理](./step-04-context-management/)
**学ぶこと**: メッセージ履歴の管理、トークン制限への対応

会話が長くなっても動作するように、コンテキストウィンドウを管理。

**主な概念**:
- トークンカウント（js-tiktoken）
- 古いメッセージの削除戦略
- システムプロンプトの保持

---

### ✅ [Step 5: サマリー機能](./step-05-summary/)
**学ぶこと**: 会話のサマリー生成、階層的なコンテキスト圧縮

長い会話を要約して保持。より高度なコンテキスト管理。

**主な概念**:
- 別のLLM呼び出しによるサマリー生成
- サマリーとrecent messagesの組み合わせ
- 段階的な圧縮戦略

---

## 🚀 始め方

### 前提条件

- Node.js 18以上
- Anthropic API Key

### セットアップ

1. 各ステップのディレクトリに移動
2. 依存関係をインストール:
   ```bash
   npm install
   ```
3. `.env`ファイルを作成してAPIキーを設定:
   ```
   ANTHROPIC_API_KEY=your_api_key_here
   ```
4. サンプルを実行:
   ```bash
   # 例: Step 1を実行
   cd step-01-simple-loop
   npx tsx agent.ts
   ```

## 💡 使い方

各ステップは独立して動作します。順番に進むことを推奨しますが、興味のあるステップから始めても構いません。

### 学習の進め方

1. **README.mdを読む**: 各ステップの説明を理解
2. **コードを読む**: 実装を確認、コメントを参考に
3. **実行する**: 実際に動かして動作を確認
4. **改造する**: コードを変更して実験
5. **次のステップへ**: 新しい概念を追加で学習

## 📖 参考ドキュメント

- [Claude API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Tool Use Guide](https://docs.anthropic.com/claude/docs/tool-use)
- [Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)

## 🔗 関連ドキュメント

このチュートリアルは以下のドキュメントと連携しています：

- [Claude AI Design Philosophy](../claude-ai-design/) - 設計思想と実装ガイド
- [Context Management](../context-management/) - Roo Codeのコンテキスト管理詳細
- [Claude Code Context Management](../claude-code-context-management/) - Claude Codeの実装

## 🎉 完成したもの

このチュートリアルを通じて、以下の機能を持つ完全なAIエージェントシステムが完成します：

- ✅ **基本的な対話ループ** - LLMとの対話、タスク完了判定
- ✅ **ツールシステム** - 計算、時刻取得、ファイル操作など
- ✅ **ファイル操作** - 読み書き、一覧表示、セキュアなパス管理
- ✅ **コンテキスト管理** - トークンカウント、メッセージ履歴管理
- ✅ **サマリー生成** - 長い会話の要約、情報の保持

### ディレクトリ構造

```
step-by-step-tutorial/
├── README.md                      # このファイル
├── step-01-simple-loop/           # Step 1: シンプルなループ
│   ├── README.md
│   ├── agent.ts
│   ├── package.json
│   └── .env.example
├── step-02-minimal-tools/         # Step 2: 最小限のツール
│   ├── README.md
│   ├── agent.ts
│   ├── package.json
│   └── .env.example
├── step-03-file-operations/       # Step 3: ファイル操作
│   ├── README.md
│   ├── agent.ts
│   ├── package.json
│   └── .env.example
├── step-04-context-management/    # Step 4: コンテキスト管理
│   ├── README.md
│   ├── agent.ts
│   ├── package.json
│   └── .env.example
└── step-05-summary/               # Step 5: サマリー機能
    ├── README.md
    ├── agent.ts
    ├── package.json
    └── .env.example
```

---

最終更新: 2026-01-01

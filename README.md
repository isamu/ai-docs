# Roo Code ドキュメント

このディレクトリには、Roo Code、Claude Code、AIエージェント開発に関する包括的なドキュメントが含まれています。

## 📚 ドキュメント一覧

### 🎓 [Step by Step チュートリアル](./step-by-step-tutorial/)

**AIエージェントを段階的に構築する実践的なチュートリアル**

Claude APIを使って、ゼロから完全なAIエージェントシステムを作ります。実際に動くコードで学べる5ステップのチュートリアル。

**内容:**
- Step 1: シンプルなループ - 基本的な対話ループ
- Step 2: 最小限のツール - ツールシステムの追加
- Step 3: ファイル操作 - 読み書き、セキュリティ
- Step 4: コンテキスト管理 - トークン制限への対応
- Step 5: サマリー機能 - 長期タスクのサポート

**対象者:** AIエージェント開発の初心者〜中級者

**学習時間:** 各ステップ30分〜1時間、合計3〜5時間

---

### 🏗️ [Claude AI Design Philosophy](./claude-ai-design/)

**Claudeスタイルのエージェント設計思想と実装パターン**

AnthropicのClaude開発チームの設計思想を基に、高品質なAIエージェントを構築するためのガイド。

**内容:**
- 01: 設計原則 - コアとなる7つの原則
- 02: アーキテクチャパターン - ループ、ツール、状態管理
- 03: ツール設計 - 効果的なツールの作り方
- 04: 実装ガイド - LangGraph + TypeScript実装
- 05: マルチモーダル実装 - 画像、動画、ドキュメント処理
- 06: 実践例 - 5つの実用的なエージェント例

**対象者:** 中級〜上級者、プロダクション開発者

**言語:** TypeScript/Node.js（元はPythonから変換済み）

---

### 🧠 [Context Management](./context-management/)

**Roo Codeのコンテキスト管理システム詳細**

Roo Codeがどのようにコンテキストを管理し、長い会話やタスクを処理するかの完全ガイド。

**内容:**
- 01: 概要 - コンテキスト管理の全体像
- 02: 二段階戦略 - Condensation & Truncation
- 03: Condensation詳細 - タグベースの圧縮
- 04: Truncation詳細 - トークン制限への対応
- 05: タスク実行フロー - モード管理、オーケストレーション
- 06: 制御フロー解説 - 高校生でもわかる制御フロー

**対象者:** Roo Codeの内部実装を理解したい開発者

**特徴:**
- 非破壊的な圧縮
- タグベースの構造化
- 5つのモード（Architect、Code、Ask、Debug、Orchestrator）

---

### ⚡ [Claude Code Context Management](./claude-code-context-management/)

**Claude Codeのコンテキスト管理実装**

Claude Code（Anthropic公式CLI）のコンテキスト管理システムの詳細解説。

**内容:**
- 01: 概要 - Claude Codeのアプローチ
- 02: 自動要約 - LLMによる会話要約
- 03: トークン管理 - 制限とバジェット管理
- 04: メッセージ優先順位 - 重要度による保持
- 05: 実装詳細 - TypeScript実装の詳細

**対象者:** Claude Codeユーザー、CLI開発者

**特徴:**
- 自動要約による圧縮
- 優先度ベースのメッセージ保持
- 200Kトークンウィンドウの効率的活用

---

## 🗺️ 学習パス推奨

### 初心者向け

1. **[Step by Step チュートリアル](./step-by-step-tutorial/)** から始める
   - Step 1〜5を順番に実行
   - 各ステップで実際にコードを動かす

2. **[Context Management: 06-制御フロー解説](./context-management/06-control-flow-explained.md)** を読む
   - LLMとプログラムの関係を理解
   - 決定フローを学ぶ

3. **[Claude AI Design: 01-設計原則](./claude-ai-design/01-design-principles.md)** を読む
   - 良い設計の基礎を学ぶ

### 中級者向け

1. **[Claude AI Design Philosophy](./claude-ai-design/)** 全体を読む
   - 設計パターンを学ぶ
   - 実践例を参考に実装

2. **[Context Management](./context-management/)** でRoo Codeの実装を学ぶ
   - 高度なコンテキスト管理技術
   - モードシステムの理解

3. **[Step by Step チュートリアル](./step-by-step-tutorial/)** のコードを拡張
   - 新しいツールを追加
   - カスタムモードを実装

### 上級者向け

1. **全ドキュメント**を通読
   - Roo Code vs Claude Codeの違いを理解
   - それぞれのトレードオフを把握

2. **独自実装**を設計
   - ユースケースに応じた最適な設計を選択
   - ハイブリッドアプローチの検討

3. **コントリビューション**
   - Roo Codeへの改善提案
   - ドキュメントの改善

---

## 📖 ドキュメント間の関係

```
step-by-step-tutorial/        claude-ai-design/
  (実践・入門)         ←→      (理論・設計思想)
       ↓                              ↓
       └──────────┬───────────────────┘
                  ↓
    context-management/     claude-code-context-management/
      (Roo Code実装)                (Claude Code実装)
              ↓                              ↓
              └──────────┬───────────────────┘
                         ↓
                  実装の参考・比較
```

### 使い分け

- **チュートリアルから始めたい** → [Step by Step チュートリアル](./step-by-step-tutorial/)
- **設計思想を学びたい** → [Claude AI Design Philosophy](./claude-ai-design/)
- **Roo Codeの仕組みを知りたい** → [Context Management](./context-management/)
- **Claude Codeの仕組みを知りたい** → [Claude Code Context Management](./claude-code-context-management/)

---

## 🎯 各ドキュメントの対象読者

| ドキュメント | 初心者 | 中級者 | 上級者 | プロダクション |
|------------|--------|--------|--------|---------------|
| Step by Step チュートリアル | ⭐⭐⭐ | ⭐⭐ | ⭐ | - |
| Claude AI Design Philosophy | ⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Context Management | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Claude Code Context Management | ⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |

---

## 🔧 技術スタック

すべてのコードサンプルは **TypeScript/Node.js** で書かれています。

### 主要な依存関係

- `@anthropic-ai/sdk` - Claude API
- `@langchain/langgraph` - エージェントグラフ構築
- `js-tiktoken` - トークンカウント
- `chromadb` - ベクトルDB（RAG用）
- その他、ファイル操作、画像処理などの標準ライブラリ

---

## 📝 ドキュメント構成の詳細

### [Step by Step チュートリアル](./step-by-step-tutorial/)
```
step-by-step-tutorial/
├── README.md                    # 全体ガイド
├── step-01-simple-loop/         # 5つの独立したステップ
├── step-02-minimal-tools/
├── step-03-file-operations/
├── step-04-context-management/
└── step-05-summary/
```

### [Claude AI Design Philosophy](./claude-ai-design/)
```
claude-ai-design/
├── README.md                    # 設計思想の概要
├── 01-design-principles.md      # 7つの設計原則
├── 02-architecture-patterns.md  # アーキテクチャパターン
├── 03-tool-design.md            # ツール設計ガイド
├── 04-implementation-guide.md   # 実装ガイド（TypeScript）
├── 05-multimodal-implementation.md  # マルチモーダル処理
└── 06-practical-examples.md     # 実践例5つ
```

### [Context Management](./context-management/)
```
context-management/
├── README.md                           # 概要
├── 01-overview.md                      # コンテキスト管理の全体像
├── 02-two-stage-strategy.md            # 二段階戦略
├── 03-condensation-details.md          # Condensation詳細
├── 04-truncation-details.md            # Truncation詳細
├── 05-task-execution-flow.md           # タスク実行フロー
└── 06-control-flow-explained.md        # 制御フロー（初心者向け）
```

### [Claude Code Context Management](./claude-code-context-management/)
```
claude-code-context-management/
├── README.md                           # 概要
├── 01-overview.md                      # Claude Codeのアプローチ
├── 02-automatic-summarization.md       # 自動要約
├── 03-token-management.md              # トークン管理
├── 04-message-prioritization.md        # メッセージ優先順位
└── 05-implementation-details.md        # 実装詳細
```

---

## 🚀 クイックスタート

### 1. チュートリアルを試す

```bash
cd docs/step-by-step-tutorial/step-01-simple-loop
npm install
cp .env.example .env
# .env にAPIキーを設定
npx tsx agent.ts
```

### 2. ドキュメントを読む

```bash
# ブラウザで開く、またはMarkdownビューアーで読む
open docs/README.md
```

### 3. コードを探索

各ドキュメントには実装コード例が含まれています。TypeScript/Node.js環境があればすぐに実行可能です。

---

## 🤝 貢献

ドキュメントの改善提案や誤字修正などは歓迎します。以下のような貢献ができます：

- 誤字・脱字の修正
- 説明の改善
- コードサンプルの追加
- 新しいステップやセクションの追加
- 翻訳（英語など）

---

## 📜 ライセンス

このドキュメントは、Roo Codeプロジェクトと同じライセンスに従います。

---

**最終更新:** 2026-01-01

**バージョン:** 1.0.0

**メンテナー:** Roo Code Development Team

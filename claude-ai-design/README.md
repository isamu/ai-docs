# Claude AI 設計思想とContext Engineering

## 概要

このディレクトリには、Anthropic社のClaude AIの設計思想と、それを実現する技術（特にContext Engineering）、およびClaude風のシステムを実装するための包括的なガイドが含まれています。

**重要**: このドキュメントは公開情報のみに基づいており、推測部分は明示的に「推測」として記載しています。

---

## 📚 ドキュメント構成

### [01-claude-design-philosophy.md](./01-claude-design-philosophy.md)
**Claude AIの設計思想**

Anthropic公式が明言している設計原則と実装アプローチ：
- Constitutional AI（憲法型AI）の詳細
- "Helpful, Honest, Harmless" の3H原則
- 内部推論と出力の分離
- 安全性設計とユーザー体験
- ツール利用の思想
- 記憶とセッション管理

### [02-context-engineering.md](./02-context-engineering.md)
**Context Engineering - Claudeの核心技術**

Claudeの性能を支える最重要概念：
- Context Engineeringとは何か（公式定義）
- プロンプトエンジニアリングとの違い
- コンテキストの設計次元
- 重み付けと圧縮戦略
- 実装上の考慮事項
- ベストプラクティス

### [03-agent-architecture.md](./03-agent-architecture.md)
**Claude風エージェントアーキテクチャ**

Claude的な動作を実現するための全体設計：
- Agent Harness（実行ループ）
- State管理とスキーマ設計
- Plan-Act-Observe-Reflectサイクル
- ツール判断と実行戦略
- 停止条件と完了判定

### [04-implementation-guide.md](./04-implementation-guide.md)
**Claude風システム実装ガイド**

具体的な実装手順とツール選定：
- 必要なOSSコンポーネント
- LangGraphによるAgent構築
- Model Context Protocol (MCP)
- RAG戦略（ドキュメント・動画）
- コード例とテンプレート
- ステップバイステップガイド

### [05-multimodal-implementation.md](./05-multimodal-implementation.md)
**マルチモーダル対応の実装**

ドキュメント・動画・画像の処理：
- ドキュメント取り込み（Docling、Unstructured）
- 動画理解（LLaVA、Qwen2-VL）
- 階層型取得戦略
- 根拠とタイムコードの管理
- コスト最適化

### [06-practical-examples.md](./06-practical-examples.md)
**実践例とコードテンプレート**

動作するコード例：
- Context Builderの実装
- LangGraphエージェントの構築
- RAGパイプラインの実装
- ツール統合の例
- デバッグとモニタリング

---

## 🎯 このドキュメントの目的

### 1. Claude AIの理解

公開情報から明らかになっているClaudeの設計思想を体系的に整理：
- なぜClaudeは「Claudeらしい」のか
- 何が他のLLMと違うのか
- どういう設計判断がなされているのか

### 2. 実装可能な知識

単なる説明ではなく、実際に構築できるレベルの情報：
- どのOSSツールを使うか
- どう組み合わせるか
- どう設定するか
- どうデバッグするか

### 3. Context Engineeringの習得

Anthropicが最も強調する「Context Engineering」を実践的に理解：
- コンテキストは設計対象である
- 情報のキュレーションが性能を決める
- 圧縮と取捨選択の戦略

---

## 🔑 主要概念のクイックガイド

### Constitutional AI

> 人間のフィードバック（RLHF）だけでなく、**明文化された原則（憲法）**に基づいてモデルを自己修正する手法

**特徴**:
- 価値判断を外在化
- モデルが参照可能な形式
- 人権尊重、非暴力、差別回避など

**実装への示唆**:
- システムプロンプトに原則を明示
- 判断基準を外部ファイル化
- 反射的評価ステップの導入

---

### Context Engineering

> プロンプトエンジニアリングではなく、**コンテキスト全体を設計対象として扱う**アプローチ

**5つの設計次元**:
1. **何を**与えるか（情報選択）
2. **いつ**与えるか（タイミング）
3. **どの形式で**与えるか（構造化）
4. **何を捨てるか**（圧縮）
5. **どう要約するか**（再構成）

**実装への示唆**:
- Context Builderの実装が最重要
- 毎ステップでコンテキストを再構築
- 古い情報の棚卸しと圧縮

---

### Agent Harness

> LLM単体ではなく、**実行ループ・状態管理・ツール統合**を含む全体システム

**構成要素**:
```
Agent Harness
├── State（状態）
│   ├── Goal（目標）
│   ├── Known facts（確定事実）
│   ├── Open questions（未解決の疑問）
│   ├── Plan（計画）
│   └── Evidence（根拠）
├── Context Builder（コンテキスト構築）
├── LLM（推論エンジン）
├── Tools（ツール群）
└── Controller（制御ループ）
    ├── Plan（計画）
    ├── Act（実行）
    ├── Observe（観察）
    └── Reflect（反省）
```

---

## 🚀 クイックスタート

### 最小限の理解

最初に読むべきドキュメント：
1. [01-claude-design-philosophy.md](./01-claude-design-philosophy.md) - Claudeとは何か
2. [02-context-engineering.md](./02-context-engineering.md) - 核心技術
3. [04-implementation-guide.md](./04-implementation-guide.md) - 何から始めるか

### 実装を始める

実装に進む場合：
1. [03-agent-architecture.md](./03-agent-architecture.md) - 全体設計
2. [04-implementation-guide.md](./04-implementation-guide.md) - ツール選定と手順
3. [06-practical-examples.md](./06-practical-examples.md) - コード例

### マルチモーダル対応

ドキュメント・動画を扱う場合：
1. [05-multimodal-implementation.md](./05-multimodal-implementation.md) - 処理戦略
2. [06-practical-examples.md](./06-practical-examples.md) - 実装例

---

## 📊 Claudeの特徴マトリクス

### 設計の対比

| 要素 | 一般的なLLM | Claude的アプローチ |
|------|-----------|------------------|
| **推論** | 出力に含める | 内部で実行、要約のみ出力 |
| **コンテキスト** | 全部投入 | キュレーション対象 |
| **ツール** | ツールファースト | 最後の手段 |
| **記憶** | セッション全保持 | 要約・圧縮 |
| **安全性** | フィルタリング | 原則ベースの判断 |
| **不確実性** | 隠す | 明示する |

### 実装の勘所

| 側面 | 実装ポイント |
|------|------------|
| **コンテキスト** | Context Builderを毎ステップ実行 |
| **状態管理** | Stateスキーマを厳格に定義 |
| **ツール判断** | "必要性ゲート"を設ける |
| **根拠** | 観測（doc/tool結果）を最優先 |
| **停止条件** | doneの定義を明確化 |

---

## 🛠️ 必要なツールスタック

### 公式推奨

| カテゴリ | ツール | 用途 |
|---------|-------|------|
| **エージェント** | LangGraph | 状態機械・実行ループ |
| **接続** | Model Context Protocol | ツール・データ統合 |
| **ドキュメント** | Docling | PDF解析 |
| **動画** | LLaVA-NeXT-Video | 動画理解 |
| **推論** | vLLM | 高速サービング |

### 代替選択肢

| カテゴリ | 代替 | 特徴 |
|---------|------|------|
| **エージェント** | Haystack Agent | ツール統合が簡単 |
| **エージェント** | LlamaIndex Agents | 構成力が高い |
| **ドキュメント** | Unstructured | 多形式対応 |
| **動画** | Qwen2-VL | 高精度 |

---

## 📖 学習パス

### 初学者向け

```
1. Claude設計思想を理解
   ↓
2. Context Engineeringの概念を掴む
   ↓
3. 簡単な実装例を試す
   ↓
4. 徐々に拡張
```

**推奨順序**:
1. [01-claude-design-philosophy.md](./01-claude-design-philosophy.md)
2. [02-context-engineering.md](./02-context-engineering.md)
3. [06-practical-examples.md](./06-practical-examples.md) - 最小例
4. [04-implementation-guide.md](./04-implementation-guide.md)

### 実装者向け

```
1. アーキテクチャ全体を把握
   ↓
2. Stateスキーマ設計
   ↓
3. Context Builder実装
   ↓
4. LangGraphでループ構築
   ↓
5. ツール・RAG統合
```

**推奨順序**:
1. [03-agent-architecture.md](./03-agent-architecture.md)
2. [04-implementation-guide.md](./04-implementation-guide.md)
3. [06-practical-examples.md](./06-practical-examples.md)
4. [05-multimodal-implementation.md](./05-multimodal-implementation.md)

---

## ⚠️ 重要な注意事項

### 公開情報の範囲

このドキュメントは以下のみに基づいています：
- Anthropic公式ブログ・論文
- 公開されているAPIドキュメント
- コミュニティで確認された挙動

**含まれないもの**:
- 内部実装の詳細
- 未公開の技術仕様
- 推測（明示されている場合を除く）

### "Claude風"の意味

「Claude風」とは：
- Claude**そのもの**の再現ではない
- Claudeの**設計思想**を実装で体現する
- **公開されている原則**を適用する

---

## 🔗 公式リソース

### Anthropic公式

- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Context Engineeringの核心
- [Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) - MCP仕様
- [Constitutional AI論文](https://www.anthropic.com/constitutional-ai) - 設計思想の基盤

### 実装参考

- [LangGraph Documentation](https://www.langchain.com/langgraph)
- [Docling GitHub](https://github.com/docling-project/docling)
- [LLaVA-NeXT GitHub](https://github.com/LLaVA-VL/LLaVA-NeXT)

---

## 🎓 次のステップ

1. **理解フェーズ**: 設計思想を読む（01, 02）
2. **設計フェーズ**: アーキテクチャを考える（03）
3. **実装フェーズ**: コードを書く（04, 05, 06）
4. **最適化フェーズ**: モニタリングと改善

各フェーズで詰まったら、該当ドキュメントに戻って確認してください。

---

**作成日**: 2025年12月28日
**最終更新**: 2025年12月28日

これらのドキュメントがClaude的なシステム構築の助けになれば幸いです。

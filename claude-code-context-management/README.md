# Claude Code コンテキスト管理 - 包括的ガイド

## 概要

このディレクトリには、Claude Code（Anthropic公式）およびRoo Code（旧Claude Code fork）のコンテキスト管理に関する包括的なドキュメントが含まれています。ネット上の最新情報（2025年）と実装の詳細を統合した、実践的なガイドです。

---

## 🎯 このガイドの目的

1. **公式Claude Codeのアプローチを理解する** - Anthropic公式のベストプラクティス
2. **Roo Codeの実装を学ぶ** - 本プロジェクトの詳細な実装
3. **業界標準の技術を知る** - LLMアプリケーション全般で使われるパターン
4. **実装可能な知識を得る** - コード例とベストプラクティス

---

## 📚 ドキュメント構成

### [01-official-claude-code.md](./01-official-claude-code.md)
**Anthropic公式Claude Codeのコンテキスト管理**

- 2025年の新機能（Context Editing, Memory Tool）
- 1Mトークンコンテキストウィンドウ
- CLAUDE.mdファイルの活用
- /clearコマンドとSubagents
- 公式ベストプラクティス

### [02-roo-code-implementation.md](./02-roo-code-implementation.md)
**Roo Code（本プロジェクト）の実装詳細**

- 二段階アプローチ（Condensation + Truncation）
- 非破壊的メッセージ管理
- MessageManagerとチェックポイント統合
- トークンカウンティングとパフォーマンス最適化

### [03-industry-patterns.md](./03-industry-patterns.md)
**業界標準のコンテキスト管理パターン**

- Summarization（要約）技術
- Memory Buffering（メモリバッファリング）
- Observation Masking（観察マスキング）
- Vectorized Memory（ベクトル化メモリ）
- 各手法の比較と使い分け

### [04-comparative-analysis.md](./04-comparative-analysis.md)
**実装の比較分析**

- 公式Claude Code vs Roo Code
- 各アプローチの長所・短所
- 使用ケース別推奨事項
- 統合可能な技術

### [05-practical-guide.md](./05-practical-guide.md)
**実践ガイド**

- ステップバイステップの実装
- コード例とテンプレート
- トラブルシューティング
- パフォーマンスチューニング

---

## 🔑 主要概念

### Claude Codeとは

[Claude Code](https://claude.com/product/claude-code)は、Anthropic社が提供する公式のAIコーディングツールで、ターミナルやIDEで動作するエージェント型コーディングアシスタントです。

**公式リソース**:
- [GitHub リポジトリ](https://github.com/anthropics/claude-code)
- [公式ドキュメント](https://code.claude.com/docs)
- [ベストプラクティス](https://www.anthropic.com/engineering/claude-code-best-practices)

### Roo Code（旧Claude Code）との関係

Roo Codeは、元々Claude Codeという名前のコミュニティプロジェクトでしたが、Anthropicの公式ツールと区別するためにリブランディングされました。

---

## 🌟 2025年の主要アップデート

### Context Editing（コンテキスト編集）

Anthropicが2025年に導入した新機能で、トークン制限に近づいたときに古いツール呼び出しと結果を自動的にクリアします。

**性能向上**:
- Context Editing単独: **29%の性能向上**
- Memory Tool併用: **39%の性能向上**

出典: [Managing context on the Claude Developer Platform](https://claude.com/blog/context-management)

### 1Mトークンコンテキストウィンドウ

Claude Sonnet 4では、1,000,000トークンのコンテキストウィンドウが利用可能になり、リポジトリ全体を1セッションで処理できるようになりました。

**利用可能プラットフォーム**:
- Claude API
- Microsoft Foundry
- Amazon Bedrock
- Google Cloud Vertex AI

出典: [Context windows - Claude Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows)

### Context Awareness（コンテキスト認識）

Claude Sonnet 4.5とHaiku 4.5は、残りのコンテキストウィンドウ（「トークン予算」）を追跡し、タスク実行とコンテキスト管理をより効果的に行えます。

---

## 🎓 学習パス

### 初心者向け
1. [01-official-claude-code.md](./01-official-claude-code.md) - 公式アプローチを理解
2. [05-practical-guide.md](./05-practical-guide.md) - 実践的な使い方を学習
3. [03-industry-patterns.md](./03-industry-patterns.md) - 一般的なパターンを知る

### 実装者向け
1. [02-roo-code-implementation.md](./02-roo-code-implementation.md) - 詳細な実装を学習
2. [04-comparative-analysis.md](./04-comparative-analysis.md) - 異なるアプローチを比較
3. [03-industry-patterns.md](./03-industry-patterns.md) - 高度な技術を習得
4. [05-practical-guide.md](./05-practical-guide.md) - 実装に着手

### システム設計者向け
1. [04-comparative-analysis.md](./04-comparative-analysis.md) - アーキテクチャの比較
2. [01-official-claude-code.md](./01-official-claude-code.md) - 公式ガイドライン確認
3. [02-roo-code-implementation.md](./02-roo-code-implementation.md) - 実装詳細
4. [03-industry-patterns.md](./03-industry-patterns.md) - 最適化手法

---

## 📊 コンテキスト管理の主要技術

### 1. Summarization（要約）

**概要**: LLMを使って会話を要約し、トークン数を削減

**利点**:
- 情報の保持率が高い
- 文脈の連続性を維持

**欠点**:
- LLM API呼び出しコスト
- 一部の詳細が失われる可能性

**実装例**: Roo Codeの`summarizeConversation()`

### 2. Truncation（トランケーション）

**概要**: スライディングウィンドウで古いメッセージを削除

**利点**:
- 実装が簡単
- 追加コストなし

**欠点**:
- 情報損失
- 文脈の断絶

**実装例**: Roo Codeの`truncateConversation()`

### 3. Context Editing（コンテキスト編集）

**概要**: 不要なツール呼び出し/結果を自動削除

**利点**:
- 自動的に最適化
- 会話フローを維持

**実装**: Anthropic公式の新機能（2025年）

### 4. Memory Buffering（メモリバッファリング）

**概要**: 重要な情報をバッファに保存

**利点**:
- トークンコスト80-90%削減
- レスポンス品質26%向上

出典: [How Should I Manage Memory for my LLM Chatbot?](https://www.vellum.ai/blog/how-should-i-manage-memory-for-my-llm-chatbot)

---

## 🛠️ ツールとコマンド

### Claude Code CLIコマンド

```bash
# コンテキストをクリア
/clear

# カスタムコマンド実行
/[command-name]

# エージェント呼び出し
@[agent-name]
```

### CLAUDE.md設定ファイル

リポジトリルートに配置して、目標、使用可能ツール、スタイル、エスカレーションルールを定義します。

```markdown
# Project Goals
- Build a REST API with authentication
- Follow clean architecture principles

# Allowed Tools
- File operations (read, write, edit)
- Terminal commands (npm, git)
- Web search

# Style Guide
- Use TypeScript strict mode
- Follow Airbnb style guide

# Escalation Rules
- Ask before deleting files
- Confirm before git push
```

出典: [Claude Code Context Guide](https://www.arsturn.com/blog/beyond-prompting-a-guide-to-managing-context-in-claude-code)

---

## 📈 性能指標

### トークン削減率

| 手法 | 削減率 | コスト |
|------|--------|--------|
| Summarization | 70-90% | 中 |
| Truncation | 30-50% | なし |
| Context Editing | 29-39% | なし |
| Memory Buffering | 80-90% | 低 |

### 情報保持率

| 手法 | 保持率 | 品質 |
|------|--------|------|
| Summarization | 高 | 優 |
| Truncation | 低 | 可 |
| Context Editing | 中 | 良 |
| Memory Buffering | 高 | 優 |

---

## 🔗 参考リソース

### 公式ドキュメント
- [Claude Code公式サイト](https://claude.com/product/claude-code)
- [Claude Code Docs](https://code.claude.com/docs)
- [Claude API Context Windows](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [Context Management Blog](https://claude.com/blog/context-management)

### コミュニティガイド
- [How I Use Every Claude Code Feature](https://blog.sshh.io/p/how-i-use-every-claude-code-feature)
- [Managing Claude Code's Context: a practical handbook](https://www.cometapi.com/managing-claude-codes-context/)
- [Mastering Context Management in Claude Code CLI](https://lalatenduswain.medium.com/mastering-context-management-in-claude-code-cli-your-guide-to-efficient-ai-assisted-coding-83753129b28e)
- [Cooking with Claude Code: The Complete Guide](https://www.siddharthbharath.com/claude-code-the-complete-guide/)

### 技術記事
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Cutting Through the Noise: Smarter Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [LLM Chat History Summarization Guide](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025)

---

## 💡 クイックスタート

### 公式Claude Codeを使う場合

```bash
# インストール
npm install -g @anthropic-ai/claude-code

# 初期化
claude-code init

# CLAUDE.mdファイル作成
echo "# Project Context" > CLAUDE.md

# セッション開始
claude-code
```

### Roo Codeの実装を参考にする場合

```typescript
import { manageContext, getEffectiveApiHistory } from '@roo-code/context-management'

const result = await manageContext({
  messages: apiHistory,
  totalTokens: currentTokens,
  contextWindow: 200000,
  autoCondenseContext: true,
  autoCondenseContextPercent: 75,
  // ...
})

const effectiveHistory = getEffectiveApiHistory(result.messages)
```

---

## 🎯 ベストプラクティス

### コンテキストエンジニアリングの原則

1. **スコープを限定** - 1つのプロジェクトや機能に集中
2. **頻繁にクリア** - 機能完了後は`/clear`でリセット
3. **構造化された入力** - CLAUDE.mdで明確なガイドライン
4. **Subagentsを活用** - タスク分離でコンテキストをクリーンに保つ
5. **トークン予算を意識** - Context Awarenessを活用

出典: [Context Engineering for Claude Code](https://thomaslandgraf.substack.com/p/context-engineering-for-claude-code)

### "Prompt Engineer"から"Context Engineer"へ

> "Getting the most out of Claude Code isn't about being a 'prompt engineer' anymore—it's about becoming a 'context engineer.'"

出典: [Mastering Context Management in Claude Code CLI](https://lalatenduswain.medium.com/mastering-context-management-in-claude-code-cli-your-guide-to-efficient-ai-assisted-coding-83753129b28e)

---

## 📝 次のステップ

1. **学習**: 各ドキュメントを順番に読む
2. **実験**: 公式Claude Codeまたはサンプルコードで試す
3. **実装**: 自分のプロジェクトに適用
4. **最適化**: 性能指標をモニタリングして改善

---

## 🤝 貢献

このドキュメントの改善提案は、GitHubのIssuesまたはPull Requestsでお願いします。

---

**作成日**: 2025年12月28日
**最終更新**: 2025年12月28日

**Sources**:
- [Managing context on the Claude Developer Platform](https://claude.com/blog/context-management)
- [Context windows - Claude Docs](https://platform.claude.com/docs/en/build-with-claude/context-windows)
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [How Should I Manage Memory for my LLM Chatbot?](https://www.vellum.ai/blog/how-should-i-manage-memory-for-my-llm-chatbot)
- [LLM Chat History Summarization Guide](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025)
- [Cutting Through the Noise: Smarter Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)

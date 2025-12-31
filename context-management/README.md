# Roo Code コンテキスト管理システム - ドキュメント

## 概要

このディレクトリには、Roo Codeのコンテキスト管理システムに関する包括的なドキュメントが含まれています。

コンテキスト管理システムは、LLMのトークン制限内で長時間の会話を維持するための高度な機能で、AI要約による知的な圧縮とスライディングウィンドウによるフォールバックの二段階アプローチを採用しています。

---

## ドキュメント構成

### 📘 [01-overview.md](./01-overview.md)
**対象読者**: すべての開発者

**内容**:
- コンテキスト管理の課題と解決アプローチ
- 二段階管理（Condensation + Truncation）の説明
- アーキテクチャ概要とレイヤー構造
- 主要コンポーネントの紹介
- データフローとメッセージライフサイクル
- 非破壊的管理の仕組み

**推奨**: まずこのドキュメントから読み始めてください

---

### 📗 [02-implementation.md](./02-implementation.md)
**対象読者**: 実装の詳細を理解したい開発者

**内容**:
- `manageContext()` 関数の詳細な処理フロー
- Condensation（凝縮）の実装
  - `summarizeConversation()` の詳細
  - tool_use/tool_resultペアの保持
  - サマリープロンプトの構造
- Truncation（トランケーション）の実装
  - スライディングウィンドウアルゴリズム
  - 偶数メッセージ削除の理由
- MessageManagerの実装
  - 巻き戻し処理フロー
  - レースコンディション対策
- トークンカウンティングの実装
- 実装例とベストプラクティス

**推奨**: 同様の機能を実装する場合、このドキュメントを参照してください

---

### 📙 [03-api-reference.md](./03-api-reference.md)
**対象読者**: APIを使用する開発者

**内容**:
- コンテキスト管理コアAPI
  - `manageContext()`
  - `willManageContext()`
  - `truncateConversation()`
  - `estimateTokenCount()`
- 凝縮モジュールAPI
  - `summarizeConversation()`
  - `getEffectiveApiHistory()`
  - `cleanupAfterTruncation()`
  - `getKeepMessagesWithToolBlocks()`
- MessageManagerAPI
  - `rewindToTimestamp()`
  - `rewindToIndex()`
- 型定義
  - `ApiMessage`
  - `ContextManagementOptions`
  - `ContextManagementResult`
  - その他すべての型
- ユーティリティ関数

**推奨**: 関数のシグネチャやパラメータを確認する際のリファレンスとして使用してください

---

### 📕 [04-advanced-topics.md](./04-advanced-topics.md)
**対象読者**: システム全体を深く理解したい開発者

**内容**:
- チェックポイントとの統合
  - Shadow Gitリポジトリ
  - チェックポイント保存/復元
- UIコンポーネント
  - コンテキストウィンドウプログレス
  - 凝縮/トランケーション結果表示
  - 設定UI
- プロファイル別設定
  - 設定の階層構造
  - 推奨プロファイル設定
- テレメトリとモニタリング
  - テレメトリイベント
  - モニタリング指標
- パフォーマンス最適化
  - キャッシング
  - デバウンス処理
  - 並列処理
- エラーハンドリングとリトライ
  - コンテキストウィンドウ超過エラー
  - 凝縮失敗時のフォールバック
- トラブルシューティング
  - よくある問題と解決策
  - デバッグ技法

**推奨**: 実装後の最適化やトラブルシューティングに使用してください

---

### 📓 [05-task-execution-flow.md](./05-task-execution-flow.md)
**対象読者**: Roo Codeの全体動作を理解したい開発者

**内容**:
- タスク実行の全体フロー
  - ユーザー入力からタスク完了まで
  - メインの実行ループ（initiateTaskLoop）
  - LLMとの対話ループ
  - ストリーミング処理
  - ツール実行フロー
- モード管理システム
  - 5つのデフォルトモード（Architect, Code, Ask, Debug, Orchestrator）
  - モードの役割と利用可能なツール
  - switch_modeによる切り替え
  - new_taskによるサブタスク委譲
  - サブタスク完了時の親復帰
- TODO List管理
  - update_todo_listツールの使い方
  - TODOリストのルール
- Context Managementとの統合
  - タスク実行フロー内でのContext Management呼び出し
  - モード切り替え時のコンテキスト処理
  - サブタスク委譲時のコンテキスト分離
- 典型的なワークフロー例
- デバッグとモニタリング

**推奨**: Roo Codeがどのようにタスクを処理するかの全体像を理解する際に読んでください

---

### 📖 [06-control-flow-explained.md](./06-control-flow-explained.md)
**対象読者**: すべての人（高校生でも理解できるレベル）

**内容**:
- LLM（Claude）とプログラムの役割分担
  - LLMができること・できないこと
  - プログラムの役割
- 基本的な仕組み：無限ループの説明
- 具体例を使った詳しい解説
  - 例1：簡単なタスク「typo修正」
  - 例2：複雑なタスク「認証機能追加」
  - 例3：さらに複雑「TypeScript変換」
- 各ステップでの詳細な処理
  - LLMの思考プロセス
  - ツール実行の流れ
  - 結果の受け渡し
- 終了判定の3つのパターン
- ループ継続・終了の判定フロー
- レストランのアナロジー（わかりやすい例え話）
- 実際のコードとシステムプロンプト
- 練習問題

**推奨**: 「次に何をするか、誰がどう決めているか」を直感的に理解したい場合に最初に読んでください

---

## クイックスタート

### 基本的な使用方法

```typescript
import { manageContext } from './core/context-management'
import { getEffectiveApiHistory } from './core/condense'

// 1. コンテキスト管理を実行
const result = await manageContext({
  messages: apiConversationHistory,
  totalTokens: currentTokenCount,
  contextWindow: 200000,
  maxTokens: 4096,
  apiHandler: api,
  autoCondenseContext: true,
  autoCondenseContextPercent: 75,
  systemPrompt: SYSTEM_PROMPT,
  taskId: "task-123",
  profileThresholds: {},
  currentProfileId: "default",
  useNativeTools: true
})

// 2. 更新されたメッセージを保存
apiConversationHistory = result.messages

// 3. API送信用にフィルタリング
const effectiveHistory = getEffectiveApiHistory(apiConversationHistory)

// 4. APIリクエスト送信
const response = await api.createMessage(systemPrompt, effectiveHistory)
```

### メッセージ削除/編集

```typescript
import { MessageManager } from './core/message-manager'

// MessageManagerを使用（直接削除しない！）
await task.messageManager.rewindToTimestamp(messageTs, {
  includeTargetMessage: operation === "delete"  // delete=true, edit=false
})
```

---

## 主要概念

### 非破壊的管理

Roo Codeのコンテキスト管理は、メッセージを物理的に削除しません。代わりに：

1. **タグ付け**: `condenseParent`や`truncationParent`タグでマーク
2. **フィルタリング**: `getEffectiveApiHistory()`でAPI送信時に除外
3. **復元**: 巻き戻し時に自動的に復元

これにより：
- ✅ データ損失なし
- ✅ チェックポイント機能との互換性
- ✅ いつでも過去の状態に戻せる

### 二段階アプローチ

```
┌─────────────────────────────────────────┐
│ しきい値超過?                            │
└─────────────────────────────────────────┘
              ↓ Yes
┌─────────────────────────────────────────┐
│ 第1段階: Condensation (AI要約)          │
│ - LLMで会話を要約                       │
│ - 70-90%のトークン削減                  │
│ - コスト発生                            │
└─────────────────────────────────────────┘
              ↓ 失敗 or 無効
┌─────────────────────────────────────────┐
│ 第2段階: Truncation (スライディング)    │
│ - 古いメッセージを隠す                   │
│ - 確実な削減                            │
│ - コストなし                            │
└─────────────────────────────────────────┘
```

---

## 技術スタック

- **言語**: TypeScript
- **トークンカウント**: Tiktoken (`o200k_base`)
- **LLM API**: Anthropic SDK, OpenAI SDK
- **UI**: React + VSCode Webview UI Toolkit
- **永続化**: JSON ファイル
- **チェックポイント**: Shadow Git リポジトリ

---

## アーキテクチャダイアグラム

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (React)                      │
│  - ContextWindowProgress                                 │
│  - CondensationResultRow                                 │
│  - TruncationResultRow                                   │
│  - ContextManagementSettings                             │
└─────────────────────────────────────────────────────────┘
                          ↕ Events
┌─────────────────────────────────────────────────────────┐
│                    Task Layer                            │
│  - Task.ts (メイン制御)                                  │
│  - MessageManager (巻き戻し管理)                         │
└─────────────────────────────────────────────────────────┘
                          ↕ API Calls
┌─────────────────────────────────────────────────────────┐
│              Context Management Layer                    │
│  - manageContext() (制御フロー)                          │
│  - willManageContext() (事前チェック)                    │
└─────────────────────────────────────────────────────────┘
         ↕                                 ↕
┌──────────────────────┐      ┌──────────────────────┐
│   Condensation       │      │    Truncation        │
│  - summarize         │      │  - truncate          │
│  - getKeepMessages   │      │  - tag messages      │
└──────────────────────┘      └──────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                 Persistence Layer                        │
│  - readApiMessages() / saveApiMessages()                 │
│  - JSON file storage                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 主要ファイル

### コアモジュール
- [`src/core/context-management/index.ts`](../../src/core/context-management/index.ts) - コンテキスト管理コア
- [`src/core/condense/index.ts`](../../src/core/condense/index.ts) - 凝縮モジュール
- [`src/core/message-manager/index.ts`](../../src/core/message-manager/index.ts) - メッセージマネージャー
- [`src/core/task-persistence/apiMessages.ts`](../../src/core/task-persistence/apiMessages.ts) - 永続化

### ユーティリティ
- [`src/utils/tiktoken.ts`](../../src/utils/tiktoken.ts) - トークンカウンティング
- [`src/core/context/context-management/context-error-handling.ts`](../../src/core/context/context-management/context-error-handling.ts) - エラー検出

### UIコンポーネント
- [`webview-ui/src/components/chat/ContextWindowProgress.tsx`](../../webview-ui/src/components/chat/ContextWindowProgress.tsx)
- [`webview-ui/src/components/chat/context-management/`](../../webview-ui/src/components/chat/context-management/)
- [`webview-ui/src/components/settings/ContextManagementSettings.tsx`](../../webview-ui/src/components/settings/ContextManagementSettings.tsx)

### テスト
- [`src/core/context-management/__tests__/`](../../src/core/context-management/__tests__/)
- [`src/core/condense/__tests__/`](../../src/core/condense/__tests__/)
- [`src/core/message-manager/index.spec.ts`](../../src/core/message-manager/index.spec.ts)

---

## 重要な定数

```typescript
// コンテキスト管理
TOKEN_BUFFER_PERCENTAGE = 0.1          // 10%バッファ予約

// 凝縮
N_MESSAGES_TO_KEEP = 3                 // 保持する最新メッセージ数
MIN_CONDENSE_THRESHOLD = 5             // 最小しきい値 5%
MAX_CONDENSE_THRESHOLD = 100           // 最大しきい値 100%

// トークンカウント
TOKEN_FUDGE_FACTOR = 1.5               // 誤差調整係数

// リトライ
MAX_CONTEXT_WINDOW_RETRIES = 3         // 最大リトライ回数
FORCED_CONTEXT_REDUCTION_PERCENT = 75  // 強制削減時の保持率
```

---

## 推奨学習パス

### 完全初心者向け（プログラミング経験が浅い方）
1. **[06-control-flow-explained.md](./06-control-flow-explained.md)** - まずここから！高校生でもわかる説明
2. [01-overview.md](./01-overview.md) - Context Managementの基本を理解
3. 実際にRoo Codeを使ってみる
4. [05-task-execution-flow.md](./05-task-execution-flow.md) - より詳しい技術説明

### 初学者向け（プログラミング経験あり）
1. [06-control-flow-explained.md](./06-control-flow-explained.md) - 直感的な理解（レストランの例え話が有用）
2. [01-overview.md](./01-overview.md) - 全体像を理解
3. [05-task-execution-flow.md](./05-task-execution-flow.md) - Roo Codeの動作フローを把握
4. [03-api-reference.md](./03-api-reference.md) - よく使う関数を確認
5. 実際のコードで試す
6. [04-advanced-topics.md](./04-advanced-topics.md) - トラブルシューティング参照

### 実装者向け
1. [06-control-flow-explained.md](./06-control-flow-explained.md) - 制御フローの本質を理解
2. [01-overview.md](./01-overview.md) - 設計思想を理解
3. [05-task-execution-flow.md](./05-task-execution-flow.md) - タスク実行の全体像を把握
4. [02-implementation.md](./02-implementation.md) - 詳細な実装を学習
5. ソースコードを読む（テスト含む）
6. [03-api-reference.md](./03-api-reference.md) - API仕様確認
7. [04-advanced-topics.md](./04-advanced-topics.md) - 最適化とエラーハンドリング

### システム設計者向け
1. [06-control-flow-explained.md](./06-control-flow-explained.md) - LLMとプログラムの協力体制を理解
2. [01-overview.md](./01-overview.md) - アーキテクチャ全体
3. [05-task-execution-flow.md](./05-task-execution-flow.md) - タスク実行とモード管理の仕組み
4. [04-advanced-topics.md](./04-advanced-topics.md) - チェックポイント統合、テレメトリ
5. [02-implementation.md](./02-implementation.md) - 実装の詳細
6. パフォーマンス指標の分析

---

## FAQ

### Q: なぜメッセージを削除せずにタグ付けするのか？
**A**: 非破壊的管理により、チェックポイント機能との互換性を保ち、いつでも過去の状態に戻すことができます。データ損失のリスクがありません。

### Q: Condensation と Truncation の違いは？
**A**:
- **Condensation**: LLMを使った知的な要約。情報を保持しつつ大幅に圧縮。コスト発生。
- **Truncation**: 単純なスライディングウィンドウ。確実だがコンテキスト損失。コストなし。

### Q: しきい値はどのように設定すべきか？
**A**:
- 高性能/高コストモデル（Opus）: 80%（最大限活用）
- バランス型（Sonnet）: 75%（推奨デフォルト）
- 低コストモデル（Haiku）: 60%（早めに凝縮）

### Q: 凝縮が失敗した場合は？
**A**: 自動的にTruncationにフォールバックします。エラーは`result.error`に格納され、`result.truncationId`が設定されます。

### Q: チェックポイント復元後にメッセージが消えた？
**A**: `MessageManager`を使用していますか？直接`filter()`で削除すると、孤立したタグのクリーンアップが実行されません。必ず`task.messageManager.rewindToTimestamp()`を使用してください。

---

## 貢献

このドキュメントの改善提案やバグ報告は、GitHubのIssuesでお願いします。

---

## ライセンス

このドキュメントは、Roo Codeプロジェクトと同じライセンスの下で公開されています。

---

## 作成日

2025年12月28日

## 最終更新

2025年12月30日

---

**Happy Coding! 🚀**

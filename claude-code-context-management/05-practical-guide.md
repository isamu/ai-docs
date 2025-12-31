# Claude Code コンテキスト管理 - 実践ガイド

## 目次
1. [セットアップ](#セットアップ)
2. [公式Claude Codeの実装](#公式claude-codeの実装)
3. [Roo Codeスタイルの実装](#roo-codeスタイルの実装)
4. [ハイブリッドアプローチ](#ハイブリッドアプローチ)
5. [トラブルシューティング](#トラブルシューティング)
6. [パフォーマンス最適化](#パフォーマンス最適化)
7. [モニタリングとデバッグ](#モニタリングとデバッグ)

---

## セットアップ

### 公式Claude Codeのセットアップ

#### インストール

```bash
# npmでインストール
npm install -g @anthropic-ai/claude-code

# または yarn
yarn global add @anthropic-ai/claude-code
```

#### 初期化

```bash
# プロジェクトディレクトリで初期化
cd your-project
claude-code init

# APIキーの設定
export ANTHROPIC_API_KEY="your-api-key"
```

#### CLAUDE.mdファイル作成

```bash
# プロジェクトルートに作成
cat > CLAUDE.md << 'EOF'
# プロジェクト: My Application

## 技術スタック
- TypeScript
- React
- Node.js
- PostgreSQL

## コーディング規約
- ESLint + Prettier
- strict TypeScript
- テストカバレッジ80%以上

## 重要なルール
- API変更前にチームに確認
- データベーススキーマ変更は慎重に
- セキュリティチェックリスト参照 → @docs/security.md
EOF
```

---

### Roo Codeの利用（本プロジェクト）

#### 依存関係

```bash
# プロジェクトのクローン
git clone https://github.com/your-org/roo-code
cd roo-code

# 依存関係インストール
npm install
```

#### 基本設定

```typescript
// src/config/context-management.ts
export const contextConfig = {
  autoCondenseContext: true,
  autoCondenseContextPercent: 75,
  profileThresholds: {
    "claude-opus-4": 80,
    "claude-sonnet-3.5": 75,
    "claude-haiku": 60
  },
  enableCheckpoints: true,
  checkpointTimeout: 30 // seconds
}
```

---

## 公式Claude Codeの実装

### ステップ1: CLAUDE.mdの最適化

```markdown
# My E-Commerce API

## プロジェクト概要
RESTful API for e-commerce platform with microservices architecture

## 技術スタック
Node.js 18+, TypeScript, PostgreSQL, Redis, Kafka

## アーキテクチャ
詳細: @docs/architecture.md

主要サービス:
- Auth Service (port 3001)
- Product Service (port 3002)
- Order Service (port 3003)

## 開発ワークフロー

### ブランチ戦略
- main: 本番環境
- develop: 開発環境
- feature/*: 新機能
- bugfix/*: バグ修正

### コミットルール
Conventional Commits使用:
- feat: 新機能
- fix: バグ修正
- docs: ドキュメント
- refactor: リファクタリング

## テスト戦略
- ユニットテスト: Jest
- 統合テスト: Supertest
- E2E: Playwright

カバレッジ要件:
- 関数: 80%+
- ブランチ: 70%+

## API設計
OpenAPI 3.0仕様書: @docs/openapi.yaml

エラーレスポンス形式:
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
\`\`\`

## セキュリティ
- すべてのエンドポイントに認証
- 入力バリデーション必須
- レート制限: 100 req/min
- 詳細: @docs/security-checklist.md

## 禁止事項
❌ `src/legacy/` - 削除禁止
❌ 直接本番DBアクセス
❌ ハードコードされた秘密情報
```

### ステップ2: Subagentsの作成

#### コードレビュアー Subagent

```markdown
# .claude/agents/code-reviewer.md
---
name: code-reviewer
description: コードレビューを実施し、品質とセキュリティを確認
tools: Read, Grep, Glob
---

# Code Reviewer

あなたは経験豊富なシニアエンジニアです。

## レビュー観点

### 1. コード品質
- [ ] 命名は明確で一貫性があるか
- [ ] 関数は適切なサイズか（<50行）
- [ ] 複雑度は適切か（Cyclomatic Complexity < 10）
- [ ] DRY原則に従っているか

### 2. TypeScript
- [ ] strict mode有効か
- [ ] any型を避けているか
- [ ] 適切な型定義があるか
- [ ] nullチェックは適切か

### 3. セキュリティ
- [ ] 入力バリデーション
- [ ] SQLインジェクション対策
- [ ] XSS対策
- [ ] 認証/認可

### 4. パフォーマンス
- [ ] N+1クエリ問題
- [ ] 不要なループ
- [ ] メモリリーク

### 5. テスト
- [ ] テストカバレッジ
- [ ] エッジケース
- [ ] エラーハンドリング

## レビューフォーマット

**ファイル**: [パス]
**評価**: ✅ Approved / ⚠️ Needs Changes / ❌ Major Issues

**コメント**:
1. [具体的なフィードバック]
2. [改善提案]

**推奨変更**:
\`\`\`typescript
// Before
[既存コード]

// After
[改善コード]
\`\`\`
```

#### テストライター Subagent

```markdown
# .claude/agents/test-writer.md
---
name: test-writer
description: 包括的なテストスイートを作成
tools: Read, Write, Edit, Bash, Glob, Grep
---

# Test Writer

## テスト作成ガイドライン

### ユニットテスト
\`\`\`typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      // Arrange
      const userData = {
        name: 'John Doe',
        email: 'john@example.com'
      }

      // Act
      const user = await userService.createUser(userData)

      // Assert
      expect(user).toBeDefined()
      expect(user.id).toBeDefined()
      expect(user.name).toBe('John Doe')
    })

    it('should reject invalid email', async () => {
      // Arrange
      const invalidData = {
        name: 'John',
        email: 'not-an-email'
      }

      // Act & Assert
      await expect(userService.createUser(invalidData))
        .rejects.toThrow('Invalid email')
    })

    it('should handle edge cases', async () => {
      // Empty string, special characters, etc.
    })
  })
})
\`\`\`

### 統合テスト
\`\`\`typescript
describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ name: 'John', email: 'john@example.com' })
      .expect(201)

    expect(response.body.user).toBeDefined()
  })
})
\`\`\`

## カバレッジ目標
- ブランチ: 80%+
- 関数: 90%+
- 行: 85%+
```

### ステップ3: 条件付きルール

```markdown
# .claude/rules/api-rules.md
---
paths:
  - "src/api/**/*.ts"
  - "src/routes/**/*.ts"
---

# API開発ルール

すべてのAPIエンドポイントは以下を満たすこと：

## 必須要件
1. **OpenAPI仕様**: JSDocで仕様を記述
2. **バリデーション**: Zod/Joi等でスキーマ定義
3. **エラーハンドリング**: 統一フォーマット
4. **認証**: JWTトークン検証
5. **レート制限**: デフォルト100 req/min
6. **ロギング**: すべてのリクエスト/レスポンス

## 例
\`\`\`typescript
/**
 * @openapi
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *     responses:
 *       201:
 *         description: User created
 */
router.post('/users',
  authenticate,
  rateLimit({ max: 100 }),
  validate(createUserSchema),
  async (req, res) => {
    try {
      const user = await userService.create(req.body)
      res.status(201).json({ user })
    } catch (error) {
      handleError(error, res)
    }
  }
)
\`\`\`
```

### ステップ4: 使用フロー

```bash
# セッション開始
claude-code

# 機能開発
> "ユーザー認証APIを実装"

# コードレビュー（Subagent）
> @code-reviewer "認証コードをレビュー"

# テスト作成（Subagent）
> @test-writer "認証機能のテストを作成"

# 機能完了後、コンテキストクリア
> /clear

# 次の機能へ
> "商品検索APIを実装"
```

---

## Roo Codeスタイルの実装

### ステップ1: コンテキスト管理の統合

```typescript
// src/services/ai-assistant.ts
import { manageContext, getEffectiveApiHistory } from './core/context-management'
import { ApiHandler } from './api'

export class AIAssistant {
  private apiHandler: ApiHandler
  private conversationHistory: ApiMessage[] = []
  private contextConfig: ContextConfig

  constructor(config: ContextConfig) {
    this.contextConfig = config
    this.apiHandler = buildApiHandler(config.apiConfig)
  }

  async sendMessage(userMessage: string): Promise<string> {
    // ステップ1: ユーザーメッセージを追加
    this.conversationHistory.push({
      role: "user",
      content: userMessage,
      ts: Date.now()
    })

    // ステップ2: トークン数を計算
    const totalTokens = await this.calculateTotalTokens()

    // ステップ3: コンテキスト管理を実行
    const managementResult = await manageContext({
      messages: this.conversationHistory,
      totalTokens,
      contextWindow: this.getContextWindow(),
      maxTokens: 4096,
      apiHandler: this.apiHandler,
      autoCondenseContext: this.contextConfig.autoCondenseContext,
      autoCondenseContextPercent: this.contextConfig.autoCondenseContextPercent,
      systemPrompt: this.getSystemPrompt(),
      taskId: this.getTaskId(),
      profileThresholds: this.contextConfig.profileThresholds,
      currentProfileId: this.getCurrentProfileId(),
      useNativeTools: true
    })

    // ステップ4: 結果を保存
    this.conversationHistory = managementResult.messages

    // ステップ5: UIイベント送信（凝縮またはトランケーション）
    if (managementResult.condenseId) {
      this.emitCondenseEvent(managementResult)
    } else if (managementResult.truncationId) {
      this.emitTruncationEvent(managementResult)
    }

    // ステップ6: API送信用にフィルタリング
    const effectiveHistory = getEffectiveApiHistory(this.conversationHistory)

    // ステップ7: APIリクエスト送信
    const response = await this.apiHandler.createMessage(
      this.getSystemPrompt(),
      effectiveHistory
    )

    // ステップ8: アシスタントレスポンスを履歴に追加
    this.conversationHistory.push({
      role: "assistant",
      content: response.content,
      ts: Date.now()
    })

    return this.extractTextFromResponse(response)
  }

  private async calculateTotalTokens(): Promise<number> {
    // 最後のメッセージを除くすべてのトークンを計算
    const messagesExceptLast = this.conversationHistory.slice(0, -1)
    return this.apiHandler.countTokens(messagesExceptLast)
  }

  private getContextWindow(): number {
    const model = this.contextConfig.apiConfig.modelId
    if (model.includes('opus-4')) return 200000
    if (model.includes('sonnet-4')) return 1000000
    return 200000
  }

  private emitCondenseEvent(result: ContextManagementResult): void {
    this.emit('condense', {
      cost: result.cost,
      prevTokens: result.prevContextTokens,
      newTokens: result.newContextTokens,
      summary: result.summary
    })
  }

  private emitTruncationEvent(result: ContextManagementResult): void {
    this.emit('truncation', {
      messagesRemoved: result.messagesRemoved,
      prevTokens: result.prevContextTokens,
      newTokens: result.newContextTokensAfterTruncation
    })
  }
}
```

### ステップ2: 設定ファイル

```typescript
// config/context-management.ts
export interface ContextConfig {
  apiConfig: {
    provider: 'anthropic' | 'openai'
    modelId: string
    apiKey: string
  }
  autoCondenseContext: boolean
  autoCondenseContextPercent: number
  profileThresholds: Record<string, number>
  customCondensingPrompt?: string
  condensingApiHandler?: {
    provider: string
    modelId: string
  }
}

export const defaultConfig: ContextConfig = {
  apiConfig: {
    provider: 'anthropic',
    modelId: 'claude-3-5-sonnet-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY!
  },
  autoCondenseContext: true,
  autoCondenseContextPercent: 75,
  profileThresholds: {
    'claude-opus-4-5-20251101': 80,
    'claude-3-5-sonnet-20241022': 75,
    'claude-3-5-haiku-20241022': 60
  }
}
```

### ステップ3: UIコンポーネント（React）

```typescript
// components/ContextProgressBar.tsx
import React from 'react'

interface Props {
  contextTokens: number
  contextWindow: number
  maxTokens: number
}

export const ContextProgressBar: React.FC<Props> = ({
  contextTokens,
  contextWindow,
  maxTokens
}) => {
  const usedPercent = (contextTokens / contextWindow) * 100
  const reservedPercent = (maxTokens / contextWindow) * 100 + 10 // +10% buffer
  const availablePercent = 100 - usedPercent - reservedPercent

  return (
    <div className="context-progress">
      <div className="progress-bar">
        <div
          className="used"
          style={{ width: `${usedPercent}%` }}
          title={`Used: ${contextTokens.toLocaleString()} tokens`}
        />
        <div
          className="reserved"
          style={{ width: `${reservedPercent}%` }}
          title={`Reserved: ${maxTokens.toLocaleString()} tokens + buffer`}
        />
        <div
          className="available"
          style={{ width: `${availablePercent}%` }}
          title="Available"
        />
      </div>
      <div className="labels">
        <span className="used-label">
          Used: {Math.round(usedPercent)}%
        </span>
        <span className="reserved-label">
          Reserved: {Math.round(reservedPercent)}%
        </span>
        <span className="available-label">
          Available: {Math.round(availablePercent)}%
        </span>
      </div>
    </div>
  )
}
```

```css
/* styles/context-progress.css */
.context-progress {
  margin: 1rem 0;
}

.progress-bar {
  display: flex;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
}

.used {
  background-color: #3b82f6; /* blue */
}

.reserved {
  background-color: #eab308; /* yellow */
}

.available {
  background-color: #6b7280; /* gray */
}

.labels {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  font-size: 0.875rem;
}
```

---

## ハイブリッドアプローチ

### シナリオ: Claude Code + Roo Code技術

```typescript
// hybrid-context-manager.ts
export class HybridContextManager {
  private rooCodeManager: RooCodeContextManager
  private claudeCodeClient: AnthropicClient

  async manage(messages: Message[]): Promise<Message[]> {
    // ステップ1: Roo CodeのCondensationで大幅削減（70-90%）
    const condensed = await this.rooCodeManager.condense(messages, {
      autoCondenseContextPercent: 70,
      useNativeTools: true
    })

    // 凝縮成功?
    if (!condensed.error) {
      console.log(`Roo Code condensation: ${condensed.prevContextTokens} → ${condensed.newContextTokens} tokens`)

      // ステップ2: Claude CodeのContext Editingで追加最適化
      const response = await this.claudeCodeClient.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: getEffectiveApiHistory(condensed.messages)
        // Context Editingが自動適用され、さらに29-39%削減
      })

      return response
    }

    // 凝縮失敗時はRoo CodeのTruncation
    return this.rooCodeManager.truncate(messages, 0.5)
  }
}
```

### 使用例

```typescript
const hybridManager = new HybridContextManager({
  rooCodeConfig: {
    autoCondenseContext: true,
    autoCondenseContextPercent: 70
  },
  claudeCodeConfig: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514'
  }
})

const optimizedMessages = await hybridManager.manage(conversationHistory)
```

**期待される削減率**:
- Roo Code Condensation: 70-90%
- Claude Code Context Editing: 追加29-39%
- **合計**: 最大95%のトークン削減

---

## トラブルシューティング

### 問題1: 凝縮後にコンテキストが増大

**症状**:
```
Error: Condensation failed - context grew
```

**原因**:
- サマリーが元のメッセージより長い
- LLMが過度に詳細な要約を生成

**解決策**:

1. カスタムプロンプトで長さ制限:
```typescript
const customPrompt = `
Summarize in under 500 words. Focus only on:
1. Key decisions
2. Current work
3. Next steps

Be concise. Omit redundant details.
`

manageContext({
  ...options,
  customCondensingPrompt: customPrompt
})
```

2. より小さいモデルを使用:
```typescript
const condensingApiHandler = buildApiHandler({
  apiProvider: 'anthropic',
  apiModelId: 'claude-3-5-haiku-20241022' // Haikuは簡潔
})

manageContext({
  ...options,
  condensingApiHandler
})
```

---

### 問題2: tool_resultエラー

**症状**:
```
Error: tool_result blocks require matching tool_use blocks
```

**原因**:
- Native Toolsプロトコル使用時、`tool_use`と`tool_result`のペアが必要

**解決策**:
```typescript
manageContext({
  ...options,
  useNativeTools: true  // ← 必須
})
```

---

### 問題3: 頻繁な凝縮でコスト増加

**症状**:
- 凝縮が頻繁に実行される
- LLM APIコストが高い

**解決策**:

1. しきい値を上げる:
```typescript
{
  autoCondenseContextPercent: 85  // 75% → 85%
}
```

2. プロファイル別に最適化:
```typescript
profileThresholds: {
  'claude-opus-4': 90,  // 高性能モデルは最大限活用
  'claude-haiku': 70    // 低コストモデルは通常
}
```

3. Truncationのみ使用（コストゼロ）:
```typescript
{
  autoCondenseContext: false  // 凝縮無効
  // Truncationのみ（無料）
}
```

---

### 問題4: メッセージ巻き戻し後に復元されない

**症状**:
- チェックポイント復元後、古いメッセージが表示されない

**原因**:
- `cleanupAfterTruncation()`が実行されていない

**解決策**:
```typescript
// ✅ 正しい
await task.messageManager.rewindToTimestamp(ts)

// ❌ 間違い
task.apiConversationHistory = task.apiConversationHistory.filter(m => m.ts < ts)
```

---

## パフォーマンス最適化

### 1. トークンカウントのキャッシング

```typescript
class TokenCountCache {
  private cache = new LRUCache<string, number>({ max: 1000 })

  async count(content: ContentBlock[], apiHandler: ApiHandler): Promise<number> {
    const key = this.generateKey(content)

    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    const count = await apiHandler.countTokens(content)
    this.cache.set(key, count)
    return count
  }

  private generateKey(content: ContentBlock[]): string {
    return JSON.stringify(content)
  }
}
```

### 2. 並列凝縮

```typescript
// 複数の会話を並列処理
async function condenseMultipleConversations(
  conversations: Conversation[]
): Promise<CondensedConversation[]> {
  return Promise.all(
    conversations.map(conv =>
      summarizeConversation(conv.messages, apiHandler, systemPrompt, conv.taskId)
    )
  )
}
```

### 3. デバウンス処理

```typescript
import debounce from 'lodash.debounce'

class OptimizedAssistant {
  private debouncedEmitTokenUsage = debounce(
    () => {
      this.emit('tokenUsage', this.getTokenUsage())
    },
    500,  // 500ms
    { maxWait: 1000 }  // 最大1秒
  )

  async processMessage(message: string): Promise<void> {
    // メッセージ処理...

    // トークン使用状況更新（デバウンス）
    this.debouncedEmitTokenUsage()
  }
}
```

---

## モニタリングとデバッグ

### 1. ログ出力

```typescript
class InstrumentedContextManager {
  async manageContext(options: ContextManagementOptions): Promise<ContextManagementResult> {
    console.log('[ContextManager] Starting context management')
    console.log(`  Total tokens: ${options.totalTokens}`)
    console.log(`  Context window: ${options.contextWindow}`)
    console.log(`  Threshold: ${options.autoCondenseContextPercent}%`)

    const startTime = Date.now()

    try {
      const result = await manageContext(options)

      const duration = Date.now() - startTime

      if (result.condenseId) {
        console.log('[ContextManager] Condensation succeeded')
        console.log(`  Duration: ${duration}ms`)
        console.log(`  Tokens: ${result.prevContextTokens} → ${result.newContextTokens}`)
        console.log(`  Reduction: ${Math.round((1 - result.newContextTokens! / result.prevContextTokens) * 100)}%`)
        console.log(`  Cost: $${result.cost.toFixed(4)}`)
      } else if (result.truncationId) {
        console.log('[ContextManager] Truncation executed')
        console.log(`  Messages removed: ${result.messagesRemoved}`)
        console.log(`  Tokens: ${result.prevContextTokens} → ${result.newContextTokensAfterTruncation}`)
      } else {
        console.log('[ContextManager] No action needed')
      }

      return result
    } catch (error) {
      console.error('[ContextManager] Error:', error)
      throw error
    }
  }
}
```

### 2. メトリクス収集

```typescript
interface ContextMetrics {
  condensationCount: number
  truncationCount: number
  totalTokensSaved: number
  totalCost: number
  averageReductionPercent: number
}

class MetricsCollector {
  private metrics: ContextMetrics = {
    condensationCount: 0,
    truncationCount: 0,
    totalTokensSaved: 0,
    totalCost: 0,
    averageReductionPercent: 0
  }

  recordCondensation(result: ContextManagementResult): void {
    this.metrics.condensationCount++
    this.metrics.totalTokensSaved += result.prevContextTokens - result.newContextTokens!
    this.metrics.totalCost += result.cost

    this.updateAverageReduction()
  }

  recordTruncation(result: ContextManagementResult): void {
    this.metrics.truncationCount++
    this.metrics.totalTokensSaved += result.prevContextTokens - result.newContextTokensAfterTruncation!

    this.updateAverageReduction()
  }

  getMetrics(): ContextMetrics {
    return { ...this.metrics }
  }

  private updateAverageReduction(): void {
    const totalOperations = this.metrics.condensationCount + this.metrics.truncationCount
    if (totalOperations > 0) {
      this.metrics.averageReductionPercent = (this.metrics.totalTokensSaved / totalOperations) / 200000 * 100
    }
  }
}
```

### 3. デバッグツール

```typescript
function debugMessages(messages: ApiMessage[]): void {
  console.log('=== Message Structure ===')

  messages.forEach((msg, i) => {
    const tags = []
    if (msg.isSummary) tags.push('SUMMARY')
    if (msg.isTruncationMarker) tags.push('MARKER')
    if (msg.condenseParent) tags.push(`condenseParent=${msg.condenseParent.substring(0, 8)}`)
    if (msg.truncationParent) tags.push(`truncationParent=${msg.truncationParent.substring(0, 8)}`)

    const tagStr = tags.length > 0 ? ` | ${tags.join(', ')}` : ''
    console.log(`[${i.toString().padStart(3)}] ${msg.role.padEnd(9)}${tagStr} | ts=${msg.ts}`)
  })

  console.log('\n=== Effective History ===')
  const effective = getEffectiveApiHistory(messages)
  console.log(`Original: ${messages.length}, Effective: ${effective.length} (${Math.round((1 - effective.length / messages.length) * 100)}% reduction)`)
}
```

---

## まとめ

このガイドでは、以下を解説しました：

1. **セットアップ**: 公式Claude CodeとRoo Codeの初期設定
2. **公式Claude Code**: CLAUDE.md、Subagents、ルールの作成
3. **Roo Code**: コンテキスト管理の統合、UIコンポーネント
4. **ハイブリッド**: 両方の技術を組み合わせた実装
5. **トラブルシューティング**: よくある問題と解決策
6. **最適化**: パフォーマンス改善のテクニック
7. **モニタリング**: メトリクス収集とデバッグ

これらの知識を使って、効果的なコンテキスト管理システムを構築できます。

---

## 関連ドキュメント

- [01-official-claude-code.md](./01-official-claude-code.md) - 公式Claude Codeの詳細
- [02-roo-code-implementation.md](./02-roo-code-implementation.md) - Roo Codeの実装
- [03-industry-patterns.md](./03-industry-patterns.md) - 業界標準パターン
- [04-comparative-analysis.md](./04-comparative-analysis.md) - アプローチの比較
- [Roo Code詳細ドキュメント](../context-management/) - 完全なAPIリファレンス

---

## Sources

- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Using CLAUDE.MD files](https://claude.com/blog/using-claude-md-files)
- [Subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [How I Use Every Claude Code Feature](https://blog.sshh.io/p/how-i-use-every-claude-code-feature)
- [Roo Code実装ドキュメント](../context-management/)

# Roo Code コンテキスト管理システム - APIリファレンス

## 目次
1. [コンテキスト管理コア](#コンテキスト管理コア)
2. [凝縮モジュール](#凝縮モジュール)
3. [メッセージマネージャー](#メッセージマネージャー)
4. [型定義](#型定義)
5. [ユーティリティ関数](#ユーティリティ関数)

---

## コンテキスト管理コア

**モジュール**: [`src/core/context-management/index.ts`](../../src/core/context-management/index.ts)

### 定数

#### `TOKEN_BUFFER_PERCENTAGE`

```typescript
export const TOKEN_BUFFER_PERCENTAGE = 0.1
```

**説明**: コンテキストウィンドウの何パーセントをバッファとして予約するか

**値**: `0.1` (10%)

**使用例**:
```typescript
const allowedTokens = contextWindow * (1 - TOKEN_BUFFER_PERCENTAGE) - reservedTokens
// contextWindow=200000の場合: 200000 * 0.9 - 4096 = 175904
```

---

### 関数

#### `manageContext()`

**シグネチャ**:
```typescript
export async function manageContext(
  options: ContextManagementOptions
): Promise<ContextManagementResult>
```

**説明**: コンテキスト管理のメインエントリーポイント。必要に応じて凝縮またはトランケーションを実行します。

**パラメータ**: `ContextManagementOptions`

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `messages` | `ApiMessage[]` | ✓ | 会話メッセージ配列 |
| `totalTokens` | `number` | ✓ | 現在の総トークン数（最後のメッセージを除く） |
| `contextWindow` | `number` | ✓ | モデルのコンテキストウィンドウサイズ |
| `maxTokens` | `number \| null` | | レスポンス用の最大トークン数（デフォルト: `ANTHROPIC_DEFAULT_MAX_TOKENS`） |
| `apiHandler` | `ApiHandler` | ✓ | API通信ハンドラー |
| `autoCondenseContext` | `boolean` | ✓ | 自動凝縮を有効にするか |
| `autoCondenseContextPercent` | `number` | ✓ | グローバル凝縮しきい値（5-100） |
| `systemPrompt` | `string` | ✓ | システムプロンプト（トークン計算用） |
| `taskId` | `string` | ✓ | タスクID（テレメトリ用） |
| `customCondensingPrompt` | `string` | | カスタム凝縮プロンプト |
| `condensingApiHandler` | `ApiHandler` | | 凝縮専用のAPIハンドラー |
| `profileThresholds` | `Record<string, number>` | ✓ | プロファイル別しきい値マップ |
| `currentProfileId` | `string` | ✓ | 現在のプロファイルID |
| `useNativeTools` | `boolean` | | Native Toolsプロトコルを使用するか |

**戻り値**: `ContextManagementResult`

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | 処理後のメッセージ配列 |
| `summary` | `string` | 生成されたサマリー（凝縮時のみ） |
| `cost` | `number` | 凝縮のコスト（USD） |
| `prevContextTokens` | `number` | 処理前のコンテキストトークン数 |
| `newContextTokens` | `number` | 処理後のコンテキストトークン数（凝縮時のみ） |
| `error` | `string` | エラーメッセージ（失敗時のみ） |
| `condenseId` | `string` | 凝縮ID（凝縮成功時のみ） |
| `truncationId` | `string` | トランケーションID（トランケーション時のみ） |
| `messagesRemoved` | `number` | 削除されたメッセージ数（トランケーション時のみ） |
| `newContextTokensAfterTruncation` | `number` | トランケーション後のトークン数（トランケーション時のみ） |

**使用例**:
```typescript
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
  profileThresholds: { "default": -1 },
  currentProfileId: "default",
  useNativeTools: true
})

if (result.condenseId) {
  console.log(`Condensed: ${result.prevContextTokens} → ${result.newContextTokens} tokens`)
} else if (result.truncationId) {
  console.log(`Truncated: ${result.messagesRemoved} messages removed`)
}
```

**スローする例外**: なし（エラーは`result.error`に格納）

**副作用**:
- テレメトリイベント送信（`TelemetryService`経由）
- LLM API呼び出し（凝縮時のみ）

---

#### `willManageContext()`

**シグネチャ**:
```typescript
export function willManageContext(
  options: WillManageContextOptions
): boolean
```

**説明**: コンテキスト管理が実行される可能性があるかを事前にチェックします。UI進行状況インジケータの表示に使用します。

**パラメータ**: `WillManageContextOptions`

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `totalTokens` | `number` | ✓ | 現在の総トークン数 |
| `contextWindow` | `number` | ✓ | コンテキストウィンドウサイズ |
| `maxTokens` | `number \| null` | | 最大トークン数 |
| `autoCondenseContext` | `boolean` | ✓ | 自動凝縮が有効か |
| `autoCondenseContextPercent` | `number` | ✓ | 凝縮しきい値 |
| `profileThresholds` | `Record<string, number>` | ✓ | プロファイル別しきい値 |
| `currentProfileId` | `string` | ✓ | 現在のプロファイルID |
| `lastMessageTokens` | `number` | ✓ | 最後のメッセージのトークン数 |

**戻り値**: `boolean` - コンテキスト管理が実行される可能性がある場合は`true`

**使用例**:
```typescript
const willManage = willManageContext({
  totalTokens: 140000,
  contextWindow: 200000,
  maxTokens: 4096,
  autoCondenseContext: true,
  autoCondenseContextPercent: 75,
  profileThresholds: {},
  currentProfileId: "default",
  lastMessageTokens: 500
})

if (willManage) {
  showSpinner("Context management in progress...")
}
```

---

#### `truncateConversation()`

**シグネチャ**:
```typescript
export function truncateConversation(
  messages: ApiMessage[],
  fracToRemove: number,
  taskId: string
): TruncationResult
```

**説明**: スライディングウィンドウ方式で会話をトランケートします。メッセージは削除されず、`truncationParent`タグでマークされます。

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | 会話メッセージ配列 |
| `fracToRemove` | `number` | 削除する割合（0.0-1.0）。通常は`0.5`（50%） |
| `taskId` | `string` | タスクID（テレメトリ用） |

**戻り値**: `TruncationResult`

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | タグ付けされたメッセージ配列 |
| `truncationId` | `string` | トランケーションマーカーの一意ID |
| `messagesRemoved` | `number` | 隠されたメッセージ数 |

**アルゴリズム**:
1. 既にトランケートされていないメッセージのみをカウント
2. 最初のメッセージを除外して削除数を計算
3. 偶数個のメッセージを削除（user/assistantペアを保持）
4. 削除対象メッセージに`truncationParent`タグを追加
5. トランケーションマーカーを挿入

**使用例**:
```typescript
const result = truncateConversation(messages, 0.5, "task-123")

console.log(`Truncated ${result.messagesRemoved} messages`)
console.log(`Truncation ID: ${result.truncationId}`)

// 有効なメッセージのみフィルタ
const effectiveMessages = result.messages.filter(
  msg => !msg.truncationParent && !msg.isTruncationMarker
)
```

**副作用**:
- テレメトリイベント送信

---

#### `estimateTokenCount()`

**シグネチャ**:
```typescript
export async function estimateTokenCount(
  content: Array<Anthropic.Messages.ContentBlockParam>,
  apiHandler: ApiHandler
): Promise<number>
```

**説明**: コンテンツブロック配列のトークン数を推定します。

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `content` | `Anthropic.Messages.ContentBlockParam[]` | コンテンツブロック配列 |
| `apiHandler` | `ApiHandler` | トークンカウント用のAPIハンドラー |

**戻り値**: `Promise<number>` - 推定トークン数

**使用例**:
```typescript
const content = [
  { type: "text", text: "Hello, world!" },
  { type: "image", source: { type: "base64", data: "..." } }
]

const tokenCount = await estimateTokenCount(content, apiHandler)
console.log(`Estimated tokens: ${tokenCount}`)
```

---

## 凝縮モジュール

**モジュール**: [`src/core/condense/index.ts`](../../src/core/condense/index.ts)

### 定数

#### `N_MESSAGES_TO_KEEP`

```typescript
export const N_MESSAGES_TO_KEEP = 3
```

**説明**: 凝縮時に常に保持する最新メッセージ数

**理由**:
- 直近の会話文脈を保持
- tool_use/tool_resultペアが分断されないように

---

#### `MIN_CONDENSE_THRESHOLD`

```typescript
export const MIN_CONDENSE_THRESHOLD = 5
```

**説明**: 凝縮しきい値の最小値（パーセンテージ）

---

#### `MAX_CONDENSE_THRESHOLD`

```typescript
export const MAX_CONDENSE_THRESHOLD = 100
```

**説明**: 凝縮しきい値の最大値（パーセンテージ）

---

#### `SUMMARY_PROMPT`

```typescript
const SUMMARY_PROMPT = `...`  // 長いプロンプト文字列
```

**説明**: デフォルトの凝縮プロンプト

**構造**:
1. Previous Conversation
2. Current Work
3. Key Technical Concepts
4. Relevant Files and Code
5. Problem Solving
6. Pending Tasks and Next Steps

**ソース**: [`src/core/condense/index.ts:109-147`](../../src/core/condense/index.ts#L109-L147)

---

### 関数

#### `summarizeConversation()`

**シグネチャ**:
```typescript
export async function summarizeConversation(
  messages: ApiMessage[],
  apiHandler: ApiHandler,
  systemPrompt: string,
  taskId: string,
  prevContextTokens: number,
  isAutomaticTrigger?: boolean,
  customCondensingPrompt?: string,
  condensingApiHandler?: ApiHandler,
  useNativeTools?: boolean
): Promise<SummarizeResponse>
```

**説明**: LLMを使って会話を要約し、メッセージを凝縮します。

**パラメータ**:

| パラメータ | 型 | 必須 | デフォルト | 説明 |
|-----------|-----|------|-----------|------|
| `messages` | `ApiMessage[]` | ✓ | - | 会話メッセージ配列 |
| `apiHandler` | `ApiHandler` | ✓ | - | フォールバックAPIハンドラー |
| `systemPrompt` | `string` | ✓ | - | システムプロンプト |
| `taskId` | `string` | ✓ | - | タスクID |
| `prevContextTokens` | `number` | ✓ | - | 凝縮前のトークン数 |
| `isAutomaticTrigger` | `boolean` | | `false` | 自動トリガーか手動か |
| `customCondensingPrompt` | `string` | | | カスタムプロンプト |
| `condensingApiHandler` | `ApiHandler` | | | 凝縮専用ハンドラー |
| `useNativeTools` | `boolean` | | `false` | Native Toolsプロトコル使用 |

**戻り値**: `SummarizeResponse`

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | 凝縮後のメッセージ配列 |
| `summary` | `string` | 生成されたサマリーテキスト |
| `cost` | `number` | LLM APIコスト（USD） |
| `newContextTokens` | `number` | 凝縮後のトークン数（成功時のみ） |
| `error` | `string` | エラーメッセージ（失敗時のみ） |
| `condenseId` | `string` | サマリーメッセージのID（成功時のみ） |

**エラーケース**:

| エラー | 条件 |
|--------|------|
| `"common:errors.condense_not_enough_messages"` | 要約対象メッセージが1件以下 |
| `"common:errors.condensed_recently"` | 最近凝縮済み |
| `"common:errors.condense_failed"` | サマリー生成失敗 |
| `"common:errors.condense_handler_invalid"` | APIハンドラーが無効 |
| `"common:errors.condense_context_grew"` | 凝縮後にトークン数が増加 |

**使用例**:
```typescript
const result = await summarizeConversation(
  messages,
  apiHandler,
  systemPrompt,
  "task-123",
  150000,
  true,  // automatic
  undefined,  // use default prompt
  undefined,  // use main handler
  true  // native tools
)

if (result.error) {
  console.error(`Condensation failed: ${result.error}`)
} else {
  console.log(`Summary: ${result.summary.substring(0, 100)}...`)
  console.log(`Tokens: ${prevContextTokens} → ${result.newContextTokens}`)
}
```

---

#### `getMessagesSinceLastSummary()`

**シグネチャ**:
```typescript
export function getMessagesSinceLastSummary(
  messages: ApiMessage[]
): ApiMessage[]
```

**説明**: 最後のサマリーメッセージ以降のメッセージを取得します。サマリーがない場合は全メッセージを返します。

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | 全メッセージ配列 |

**戻り値**: `ApiMessage[]` - サマリー以降のメッセージ（サマリー含む）

**使用例**:
```typescript
const messagesToSummarize = getMessagesSinceLastSummary(allMessages)
console.log(`Messages to summarize: ${messagesToSummarize.length}`)
```

**特殊処理**:
- Bedrockの場合、最初のメッセージが`user`でない場合、元の最初のメッセージを追加

---

#### `getEffectiveApiHistory()`

**シグネチャ**:
```typescript
export function getEffectiveApiHistory(
  messages: ApiMessage[]
): ApiMessage[]
```

**説明**: API送信用の有効なメッセージをフィルタリングします。`condenseParent`や`truncationParent`を持つメッセージを除外します。

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | 全メッセージ配列 |

**戻り値**: `ApiMessage[]` - フィルタリング後のメッセージ

**フィルタリングルール**:
1. `condenseParent`が存在し、対応するサマリーが存在する場合は除外
2. `truncationParent`が存在し、対応するマーカーが存在する場合は除外
3. 孤立した親参照を持つメッセージは**含める**（復元済み）

**使用例**:
```typescript
const effectiveHistory = getEffectiveApiHistory(apiConversationHistory)

// API送信
const response = await api.createMessage(systemPrompt, effectiveHistory)
```

---

#### `cleanupAfterTruncation()`

**シグネチャ**:
```typescript
export function cleanupAfterTruncation(
  messages: ApiMessage[]
): ApiMessage[]
```

**説明**: 孤立した`condenseParent`と`truncationParent`参照をクリーンアップします。

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | クリーンアップ対象のメッセージ配列 |

**戻り値**: `ApiMessage[]` - クリーンアップ後のメッセージ

**処理内容**:
1. 存在するサマリー/マーカーのIDを収集
2. 各メッセージの親参照をチェック
3. 孤立した参照を削除

**使用例**:
```typescript
// サマリー削除後
const cleanedMessages = cleanupAfterTruncation(messages)

// 孤立したcondenseParent/truncationParentが削除される
```

---

#### `getKeepMessagesWithToolBlocks()`

**シグネチャ**:
```typescript
export function getKeepMessagesWithToolBlocks(
  messages: ApiMessage[],
  keepCount: number
): KeepMessagesResult
```

**説明**: 保持するメッセージと、必要な`tool_use`/`reasoning`ブロックを抽出します。

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `messages` | `ApiMessage[]` | 全メッセージ配列 |
| `keepCount` | `number` | 保持するメッセージ数 |

**戻り値**: `KeepMessagesResult`

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `keepMessages` | `ApiMessage[]` | 保持するメッセージ |
| `toolUseBlocksToPreserve` | `Anthropic.Messages.ToolUseBlock[]` | 保持する`tool_use`ブロック |
| `reasoningBlocksToPreserve` | `Anthropic.Messages.ContentBlockParam[]` | 保持する`reasoning`ブロック |

**使用例**:
```typescript
const { keepMessages, toolUseBlocksToPreserve, reasoningBlocksToPreserve } =
  getKeepMessagesWithToolBlocks(messages, 3)

if (toolUseBlocksToPreserve.length > 0) {
  console.log(`Preserving ${toolUseBlocksToPreserve.length} tool_use blocks`)
}
```

---

## メッセージマネージャー

**モジュール**: [`src/core/message-manager/index.ts`](../../src/core/message-manager/index.ts)

### クラス: `MessageManager`

**説明**: 会話の巻き戻し操作を一元管理するクラス

**コンストラクタ**:
```typescript
constructor(private task: Task)
```

**アクセス方法**:
```typescript
// Task経由でアクセス（遅延初期化）
const messageManager = task.messageManager
```

---

#### メソッド: `rewindToTimestamp()`

**シグネチャ**:
```typescript
async rewindToTimestamp(
  ts: number,
  options: RewindOptions = {}
): Promise<void>
```

**説明**: タイムスタンプを指定して会話を巻き戻します。

**パラメータ**:

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `ts` | `number` | - | 巻き戻し先のタイムスタンプ |
| `options` | `RewindOptions` | `{}` | オプション |

**`RewindOptions`**:

| フィールド | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| `includeTargetMessage` | `boolean` | `false` | 対象メッセージも削除するか（`true`=削除、`false`=保持） |
| `skipCleanup` | `boolean` | `false` | クリーンアップをスキップ（特殊ケース用） |

**スローする例外**:
- `Error`: タイムスタンプが見つからない場合

**使用例**:
```typescript
// メッセージ削除（対象メッセージも削除）
await task.messageManager.rewindToTimestamp(messageTs, {
  includeTargetMessage: true
})

// メッセージ編集（対象メッセージは保持）
await task.messageManager.rewindToTimestamp(messageTs, {
  includeTargetMessage: false
})
```

---

#### メソッド: `rewindToIndex()`

**シグネチャ**:
```typescript
async rewindToIndex(
  toIndex: number,
  options: RewindOptions = {}
): Promise<void>
```

**説明**: インデックスを指定して会話を巻き戻します。

**パラメータ**:

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `toIndex` | `number` | 保持する範囲の終了インデックス（排他的） |
| `options` | `RewindOptions` | オプション |

**動作**:
- `[0, toIndex)` のメッセージを保持
- `[toIndex, end]` のメッセージを削除

**使用例**:
```typescript
// 最初の10件のメッセージのみ保持
await task.messageManager.rewindToIndex(10)
```

---

## 型定義

### `ApiMessage`

**モジュール**: [`src/core/task-persistence/apiMessages.ts`](../../src/core/task-persistence/apiMessages.ts)

```typescript
export type ApiMessage = Anthropic.MessageParam & {
  ts?: number
  isSummary?: boolean
  id?: string
  type?: "reasoning"
  summary?: any[]
  encrypted_content?: string
  text?: string
  reasoning_details?: any[]
  reasoning_content?: string
  condenseId?: string
  condenseParent?: string
  truncationId?: string
  truncationParent?: string
  isTruncationMarker?: boolean
}
```

**フィールド説明**:

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `ts` | `number` | タイムスタンプ（ミリ秒） |
| `isSummary` | `boolean` | サマリーメッセージフラグ |
| `condenseId` | `string` | サマリーの一意識別子 |
| `condenseParent` | `string` | このメッセージを置き換えたサマリーのID |
| `truncationId` | `string` | トランケーションマーカーの一意識別子 |
| `truncationParent` | `string` | このメッセージを隠したマーカーのID |
| `isTruncationMarker` | `boolean` | トランケーションマーカーフラグ |
| `reasoning_content` | `string` | DeepSeek/Z.ai用の推論コンテンツ |

---

### `ContextManagementOptions`

```typescript
export type ContextManagementOptions = {
  messages: ApiMessage[]
  totalTokens: number
  contextWindow: number
  maxTokens?: number | null
  apiHandler: ApiHandler
  autoCondenseContext: boolean
  autoCondenseContextPercent: number
  systemPrompt: string
  taskId: string
  customCondensingPrompt?: string
  condensingApiHandler?: ApiHandler
  profileThresholds: Record<string, number>
  currentProfileId: string
  useNativeTools?: boolean
}
```

---

### `ContextManagementResult`

```typescript
export type ContextManagementResult = SummarizeResponse & {
  prevContextTokens: number
  truncationId?: string
  messagesRemoved?: number
  newContextTokensAfterTruncation?: number
}
```

---

### `TruncationResult`

```typescript
export type TruncationResult = {
  messages: ApiMessage[]
  truncationId: string
  messagesRemoved: number
}
```

---

### `SummarizeResponse`

```typescript
export type SummarizeResponse = {
  messages: ApiMessage[]
  summary: string
  cost: number
  newContextTokens?: number
  error?: string
  condenseId?: string
}
```

---

### `KeepMessagesResult`

```typescript
export type KeepMessagesResult = {
  keepMessages: ApiMessage[]
  toolUseBlocksToPreserve: Anthropic.Messages.ToolUseBlock[]
  reasoningBlocksToPreserve: Anthropic.Messages.ContentBlockParam[]
}
```

---

### `RewindOptions`

```typescript
export interface RewindOptions {
  includeTargetMessage?: boolean
  skipCleanup?: boolean
}
```

---

### `WillManageContextOptions`

```typescript
export type WillManageContextOptions = {
  totalTokens: number
  contextWindow: number
  maxTokens?: number | null
  autoCondenseContext: boolean
  autoCondenseContextPercent: number
  profileThresholds: Record<string, number>
  currentProfileId: string
  lastMessageTokens: number
}
```

---

## ユーティリティ関数

### トークンカウンティング

**モジュール**: [`src/utils/tiktoken.ts`](../../src/utils/tiktoken.ts)

#### `tiktoken()`

**シグネチャ**:
```typescript
export async function tiktoken(
  content: Anthropic.Messages.ContentBlockParam[]
): Promise<number>
```

**説明**: Tiktokenを使ってコンテンツブロックのトークン数を計算します。

**サポートするブロックタイプ**:
- `text`: テキストブロック
- `image`: 画像ブロック（base64サイズから推定）
- `tool_use`: ツール使用ブロック（シリアライズしてカウント）
- `tool_result`: ツール結果ブロック（シリアライズしてカウント）

**使用するエンコーダー**: `o200k_base`

**誤差調整**: `TOKEN_FUDGE_FACTOR = 1.5`

**使用例**:
```typescript
const content = [
  { type: "text", text: "Hello" },
  { type: "tool_use", id: "123", name: "read_file", input: { path: "test.js" } }
]

const tokens = await tiktoken(content)
console.log(`Tokens: ${tokens}`)
```

---

### タスク永続化

**モジュール**: [`src/core/task-persistence/apiMessages.ts`](../../src/core/task-persistence/apiMessages.ts)

#### `readApiMessages()`

**シグネチャ**:
```typescript
export async function readApiMessages({
  taskId,
  globalStoragePath
}: {
  taskId: string
  globalStoragePath: string
}): Promise<ApiMessage[]>
```

**説明**: タスクのAPI会話履歴を読み込みます。

**戻り値**: `ApiMessage[]` - 空配列またはメッセージ配列

---

#### `saveApiMessages()`

**シグネチャ**:
```typescript
export async function saveApiMessages({
  messages,
  taskId,
  globalStoragePath
}: {
  messages: ApiMessage[]
  taskId: string
  globalStoragePath: string
}): Promise<void>
```

**説明**: タスクのAPI会話履歴を保存します。

---

### コンテキストウィンドウエラー検出

**モジュール**: [`src/core/context/context-management/context-error-handling.ts`](../../src/core/context/context-management/context-error-handling.ts)

#### `checkContextWindowExceededError()`

**シグネチャ**:
```typescript
export function checkContextWindowExceededError(
  error: any,
  apiProvider?: string
): boolean
```

**説明**: エラーがコンテキストウィンドウ超過エラーかどうかをチェックします。

**サポートするプロバイダー**:
- Anthropic
- OpenAI
- OpenRouter
- Cerebras

**使用例**:
```typescript
try {
  await api.createMessage(systemPrompt, messages)
} catch (error) {
  if (checkContextWindowExceededError(error, "anthropic")) {
    console.log("Context window exceeded, applying forced reduction...")
    // 強制削減処理
  }
}
```

---

## まとめ

このAPIリファレンスでは、Roo Codeのコンテキスト管理システムで使用されるすべての主要な関数、クラス、型定義について解説しました。

### 主要なエントリーポイント

1. **`manageContext()`** - コンテキスト管理のメイン関数
2. **`task.messageManager.rewindToTimestamp()`** - メッセージ巻き戻し
3. **`getEffectiveApiHistory()`** - API送信用フィルタリング

### 次のステップ

より高度なトピックについては、以下のドキュメントをご覧ください：
- [**04-advanced-topics.md**](./04-advanced-topics.md) - チェックポイント統合、プロファイル設定など

## 参考リソース

### ソースコード
- [コンテキスト管理コア](../../src/core/context-management/index.ts)
- [凝縮モジュール](../../src/core/condense/index.ts)
- [メッセージマネージャー](../../src/core/message-manager/index.ts)
- [タスク永続化](../../src/core/task-persistence/apiMessages.ts)
- [トークンカウンティング](../../src/utils/tiktoken.ts)

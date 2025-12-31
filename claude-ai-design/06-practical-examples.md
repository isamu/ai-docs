# 実践例とコードテンプレート

## 概要

このドキュメントでは、これまでの内容を統合した**実際に動作するコード例**を提供します。

各例はそのままコピーして使えるように設計されています。

---

## 🎯 例1: 最小限のClaude風エージェント

最もシンプルな実装です。

### minimal_agent.ts

```typescript
/**
 * 最小限のClaude風エージェント
 *
 * 依存関係:
 * npm install @langchain/langgraph @langchain/anthropic @langchain/core
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

// === State定義 ===

interface MinimalState {
    messages: BaseMessage[];
    goal: string;
    status: 'working' | 'done';
    iteration: number;
}

const MinimalStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    goal: Annotation<string>(),
    status: Annotation<'working' | 'done'>(),
    iteration: Annotation<number>()
});

// === LLM初期化 ===

const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20251101",
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0
});

const SYSTEM_PROMPT = `
あなたは有益で誠実なアシスタントです。

原則:
1. ユーザーの目標達成を支援する
2. 不確実な情報は明示する
3. 有害な出力を避ける

タスクを1ステップずつ実行してください。
各ステップの後、目標が達成されたか判断してください。
`;

// === ノード定義 ===

async function thinkNode(state: typeof MinimalStateAnnotation.State): Promise<Partial<MinimalState>> {
    /**思考ノード*/
    console.log(`\n[Iteration ${state.iteration}] Thinking...`);

    const messages = [
        new SystemMessage(SYSTEM_PROMPT),
        ...state.messages,
        new HumanMessage(`
<goal>${state.goal}</goal>

次に何をすべきか考えてください。
目標が達成されている場合は「DONE」と明示してください。

回答形式:
<next_action>
行うべきこと、または「DONE」
</next_action>
<reasoning>
理由
</reasoning>
`)
    ];

    const response = await llm.invoke(messages);

    // DONEチェック
    if (response.content.toString().includes("DONE")) {
        return {
            status: "done",
            messages: [response]
        };
    }

    return {
        iteration: state.iteration + 1,
        messages: [response]
    };
}

function shouldContinue(state: typeof MinimalStateAnnotation.State): string {
    /**継続判定*/
    if (state.status === "done") {
        return "end";
    }

    if (state.iteration >= 10) {
        console.log("Max iterations reached");
        return "end";
    }

    return "continue";
}

// === グラフ構築 ===

const workflow = new StateGraph(MinimalStateAnnotation)
    .addNode("think", thinkNode)
    .addEdge("__start__", "think")
    .addConditionalEdges(
        "think",
        shouldContinue,
        {
            "continue": "think",
            "end": END
        }
    );

const app = workflow.compile();

// === 実行 ===

async function runAgent(goal: string): Promise<void> {
    /**エージェントを実行*/
    const initialState: MinimalState = {
        messages: [],
        goal: goal,
        status: "working",
        iteration: 0
    };

    console.log(`🎯 Goal: ${goal}\n`);
    console.log("=".repeat(60));

    const result = await app.invoke(initialState);

    console.log("\n" + "=".repeat(60));
    console.log(`✅ Completed in ${result.iteration} iterations`);
    console.log("\nFinal messages:");

    for (const msg of result.messages) {
        const role = msg.constructor.name;
        const content = msg.content.toString();
        const displayContent = content.length > 200 ? content.slice(0, 200) + "..." : content;
        console.log(`\n[${role}]\n${displayContent}`);
    }
}

// メイン実行
if (require.main === module) {
    runAgent("Calculate 15 * 23 and explain the process");
}
```

### 実行

```bash
export ANTHROPIC_API_KEY="your-key-here"
npx tsx minimal_agent.ts
```

---

## 🔧 例2: ツール統合エージェント

ツールを使えるエージェントです。

### tool_agent.ts

```typescript
/**
 * ツール統合エージェント
 *
 * 追加の依存関係:
 * npm install axios cheerio @langchain/core
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import axios from "axios";
import * as cheerio from "cheerio";

// === ツール定義 ===

const webSearchTool = tool(
    async ({ query }: { query: string }): Promise<string> => {
        /**
         * Web検索を実行します。
         */
        // DuckDuckGo Instant Answer API（無料）
        const url = "https://api.duckduckgo.com/";
        const params = { q: query, format: "json" };

        try {
            const response = await axios.get(url, { params, timeout: 10000 });
            const data = response.data;

            // 結果を整形
            const results: string[] = [];

            if (data.AbstractText) {
                results.push(`Summary: ${data.AbstractText}`);
            }

            if (data.RelatedTopics) {
                results.push("\nRelated:");
                for (const topic of data.RelatedTopics.slice(0, 3)) {
                    if (topic.Text) {
                        results.push(`- ${topic.Text}`);
                    }
                }
            }

            return results.length > 0 ? results.join("\n") : "No results found";
        } catch (error) {
            return `Search failed: ${error}`;
        }
    },
    {
        name: "web_search",
        description: "Web検索を実行します。",
        schema: z.object({
            query: z.string().describe("検索クエリ")
        })
    }
);

const fetchUrlTool = tool(
    async ({ url }: { url: string }): Promise<string> => {
        /**
         * URLのコンテンツを取得します。
         */
        try {
            const response = await axios.get(url, { timeout: 10000 });
            const $ = cheerio.load(response.data);

            // テキストを抽出
            const text = $('body').text().replace(/\s+/g, ' ').trim();

            // 最初の2000文字のみ
            return text.slice(0, 2000);
        } catch (error) {
            return `Failed to fetch URL: ${error}`;
        }
    },
    {
        name: "fetch_url",
        description: "URLのコンテンツを取得します。",
        schema: z.object({
            url: z.string().describe("取得するURL")
        })
    }
);

const calculateTool = tool(
    async ({ expression }: { expression: string }): Promise<string> => {
        /**
         * 数式を計算します。
         */
        try {
            // 安全な評価（Functionコンストラクタを使用）
            const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
            const result = Function(`'use strict'; return (${sanitized})`)();
            return String(result);
        } catch (error) {
            return `Calculation failed: ${error}`;
        }
    },
    {
        name: "calculate",
        description: "数式を計算します。",
        schema: z.object({
            expression: z.string().describe("計算式（例: \"2 + 2\"）")
        })
    }
);

// ツールリスト
const tools = [webSearchTool, fetchUrlTool, calculateTool];

// === State定義 ===

interface ToolAgentState {
    messages: BaseMessage[];
    goal: string;
    status: 'planning' | 'acting' | 'done';
}

const ToolAgentStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    goal: Annotation<string>(),
    status: Annotation<'planning' | 'acting' | 'done'>()
});

// === LLM初期化（ツールバインド） ===

const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20251101",
    temperature: 0
}).bindTools(tools);

const SYSTEM_PROMPT = `
あなたは有益なアシスタントです。

利用可能なツール:
- web_search: Web検索
- fetch_url: URLの内容取得
- calculate: 計算

原則:
1. まず内部知識で回答できるか検討
2. 必要な場合のみツールを使用
3. ツール結果を検証してから回答
`;

// === ノード定義 ===

async function agentNode(state: typeof ToolAgentStateAnnotation.State): Promise<Partial<ToolAgentState>> {
    /**エージェントノード*/
    const messages = [
        new SystemMessage(SYSTEM_PROMPT),
        ...state.messages
    ];

    const response = await llm.invoke(messages);

    return {
        messages: [response]
    };
}

async function toolNode(state: typeof ToolAgentStateAnnotation.State): Promise<Partial<ToolAgentState>> {
    /**ツール実行ノード*/
    const lastMessage = state.messages[state.messages.length - 1];

    const toolCalls = (lastMessage as any).tool_calls || [];

    const toolMessages: ToolMessage[] = [];

    for (const toolCall of toolCalls) {
        const toolName = toolCall.name;
        const toolArgs = toolCall.args;

        console.log(`\n🔧 Calling tool: ${toolName}`);
        console.log(`   Args:`, toolArgs);

        // ツール実行
        const toolMap: Record<string, any> = {
            web_search: webSearchTool,
            fetch_url: fetchUrlTool,
            calculate: calculateTool
        };
        const selectedTool = toolMap[toolName];
        const result = await selectedTool.invoke(toolArgs);

        console.log(`   Result: ${String(result).slice(0, 100)}...`);

        toolMessages.push(
            new ToolMessage({
                content: String(result),
                tool_call_id: toolCall.id
            })
        );
    }

    return {
        messages: toolMessages
    };
}

function shouldContinue(state: typeof ToolAgentStateAnnotation.State): string {
    /**継続判定*/
    const lastMessage = state.messages[state.messages.length - 1];

    // ツール呼び出しがあれば実行
    if ((lastMessage as any).tool_calls && (lastMessage as any).tool_calls.length > 0) {
        return "tools";
    }

    // なければ終了
    return "end";
}

// === グラフ構築 ===

const workflow = new StateGraph(ToolAgentStateAnnotation)
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges(
        "agent",
        shouldContinue,
        {
            "tools": "tools",
            "end": END
        }
    )
    .addEdge("tools", "agent");

const app = workflow.compile();

// === 実行 ===

async function runToolAgent(goal: string): Promise<void> {
    /**ツールエージェントを実行*/
    const initialState: ToolAgentState = {
        messages: [new HumanMessage(goal)],
        goal: goal,
        status: "planning"
    };

    console.log(`🎯 Goal: ${goal}\n`);
    console.log("=".repeat(60));

    const result = await app.invoke(initialState);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Completed\n");

    // 最終回答を抽出
    for (let i = result.messages.length - 1; i >= 0; i--) {
        const msg = result.messages[i];
        if (msg.content && !(msg as any).tool_calls) {
            console.log(`Answer:\n${msg.content}`);
            break;
        }
    }
}

// メイン実行
if (require.main === module) {
    (async () => {
        // 例1: 計算
        await runToolAgent("What is 456 * 789?");

        console.log("\n\n");

        // 例2: Web検索
        await runToolAgent("What is LangGraph?");
    })();
}
```

---

## 📚 例3: RAG統合エージェント

ドキュメント検索を使うエージェントです。

### rag_agent.ts

```typescript
/**
 * RAG統合エージェント
 *
 * 追加の依存関係:
 * npm install chromadb
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";
import { ChromaClient, OpenAIEmbeddingFunction } from "chromadb";

// === RAGシステム ===

interface Document {
    id: string;
    text: string;
    metadata?: Record<string, any>;
}

interface SearchResult {
    text: string;
    metadata: Record<string, any>;
}

class SimpleRAG {
    private client: ChromaClient;
    private collection: any;
    private collectionName: string;

    constructor(collectionName: string = "knowledge") {
        // ChromaDBクライアント
        this.client = new ChromaClient();
        this.collectionName = collectionName;
    }

    async initialize(): Promise<void> {
        // コレクション作成
        this.collection = await this.client.getOrCreateCollection({
            name: this.collectionName,
            embeddingFunction: new OpenAIEmbeddingFunction({
                openai_api_key: process.env.OPENAI_API_KEY || ""
            })
        });
    }

    async addDocuments(documents: Document[]): Promise<void> {
        /**ドキュメントを追加*/
        await this.collection.add({
            ids: documents.map(doc => doc.id),
            documents: documents.map(doc => doc.text),
            metadatas: documents.map(doc => doc.metadata || {})
        });

        console.log(`✅ Added ${documents.length} documents`);
    }

    async search(query: string, nResults: number = 3): Promise<SearchResult[]> {
        /**検索*/
        const results = await this.collection.query({
            queryTexts: [query],
            nResults: nResults
        });

        return results.documents[0].map((doc: string, idx: number) => ({
            text: doc,
            metadata: results.metadatas[0][idx]
        }));
    }
}

// === State定義 ===

interface RAGAgentState {
    messages: BaseMessage[];
    query: string;
    retrievedDocs: SearchResult[];
    status: string;
}

const RAGAgentStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    query: Annotation<string>(),
    retrievedDocs: Annotation<SearchResult[]>(),
    status: Annotation<string>()
});

// === ノード定義 ===

async function retrieveNode(
    state: typeof RAGAgentStateAnnotation.State,
    rag: SimpleRAG
): Promise<Partial<RAGAgentState>> {
    /**検索ノード*/
    console.log("\n🔍 Retrieving documents...");

    const docs = await rag.search(state.query, 3);

    console.log(`   Found ${docs.length} relevant documents`);

    return {
        retrievedDocs: docs
    };
}

async function generateNode(
    state: typeof RAGAgentStateAnnotation.State,
    llm: ChatAnthropic
): Promise<Partial<RAGAgentState>> {
    /**生成ノード*/
    console.log("\n🤖 Generating answer...");

    // コンテキスト構築
    const context = state.retrievedDocs
        .map(doc => `<document>\n${doc.text}\n</document>`)
        .join("\n\n");

    const prompt = `
<context>
${context}
</context>

<query>
${state.query}
</query>

上記のコンテキストに基づいて、質問に回答してください。
コンテキストに情報がない場合は、その旨を伝えてください。
`;

    const messages = [
        new SystemMessage("あなたは提供されたコンテキストに基づいて回答するアシスタントです。"),
        new HumanMessage(prompt)
    ];

    const response = await llm.invoke(messages);

    return {
        messages: [response],
        status: "done"
    };
}

// === グラフ構築 ===

function createRagAgent(rag: SimpleRAG) {
    /**RAGエージェントを作成*/
    const llm = new ChatAnthropic({
        model: "claude-sonnet-4-5-20251101",
        temperature: 0
    });

    const workflow = new StateGraph(RAGAgentStateAnnotation)
        .addNode("retrieve", (s) => retrieveNode(s, rag))
        .addNode("generate", (s) => generateNode(s, llm))
        .addEdge("__start__", "retrieve")
        .addEdge("retrieve", "generate")
        .addEdge("generate", END);

    return workflow.compile();
}

// === 実行 ===

async function main() {
    // RAGシステム初期化
    const rag = new SimpleRAG();
    await rag.initialize();

    // サンプルドキュメントを追加
    const sampleDocs: Document[] = [
        {
            id: "doc1",
            text: "LangGraphは、LangChainチームが開発したステートフルなマルチアクターアプリケーションを構築するためのライブラリです。グラフベースの実行モデルを使用します。",
            metadata: { source: "docs", topic: "langgraph" }
        },
        {
            id: "doc2",
            text: "Model Context Protocol (MCP)は、Anthropicが開発したLLMアプリケーションとデータソースを接続するための標準プロトコルです。",
            metadata: { source: "docs", topic: "mcp" }
        },
        {
            id: "doc3",
            text: "Claude 3.5 Sonnetは、Anthropicの最新AIモデルで、コーディング、推論、視覚処理に優れています。200Kトークンのコンテキストウィンドウを持ちます。",
            metadata: { source: "docs", topic: "claude" }
        }
    ];

    await rag.addDocuments(sampleDocs);

    // エージェント作成
    const app = createRagAgent(rag);

    // 質問
    const queries = [
        "LangGraphとは何ですか？",
        "MCPの目的は？",
        "Claudeのコンテキストウィンドウは？"
    ];

    for (const query of queries) {
        console.log("\n" + "=".repeat(60));
        console.log(`❓ Query: ${query}`);
        console.log("=".repeat(60));

        const result = await app.invoke({
            messages: [],
            query: query,
            retrievedDocs: [],
            status: "searching"
        });

        // 回答を表示
        const answer = result.messages[result.messages.length - 1].content;
        console.log(`\n💡 Answer:\n${answer}`);
    }
}

// メイン実行
if (require.main === module) {
    main();
}
```

---

## 🎬 例4: マルチモーダルエージェント

画像・ドキュメントを扱うエージェントです。

### multimodal_agent.ts

```typescript
/**
 * マルチモーダルエージェント
 *
 * 追加の依存関係:
 * npm install @anthropic-ai/sdk fs path
 */

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { extname } from "path";

interface ImageContent {
    type: "image";
    source: {
        type: "base64";
        media_type: string;
        data: string;
    };
}

interface TextContent {
    type: "text";
    text: string;
}

type MessageContent = ImageContent | TextContent;

class MultimodalAgent {
    private client: Anthropic;

    constructor(apiKey: string) {
        this.client = new Anthropic({ apiKey });
    }

    encodeImage(imagePath: string): ImageContent {
        /**画像をBase64エンコード*/
        const imageData = readFileSync(imagePath);
        const base64Data = imageData.toString("base64");

        // MIMEタイプ判定
        const suffix = extname(imagePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp"
        };

        return {
            type: "image",
            source: {
                type: "base64",
                media_type: mimeTypes[suffix] || "image/jpeg",
                data: base64Data
            }
        };
    }

    async analyzeImage(imagePath: string, query: string): Promise<string> {
        /**画像を分析*/
        console.log(`\n🖼️  Analyzing image: ${imagePath}`);
        console.log(`   Query: ${query}`);

        const imageContent = this.encodeImage(imagePath);

        const message = await this.client.messages.create({
            model: "claude-sonnet-4-5-20251101",
            max_tokens: 1024,
            messages: [
                {
                    role: "user",
                    content: [
                        imageContent,
                        {
                            type: "text",
                            text: query
                        }
                    ]
                }
            ]
        });

        return (message.content[0] as any).text;
    }

    async analyzeDocumentWithImages(
        images: string[],
        query: string
    ): Promise<string> {
        /**複数画像を含むドキュメントを分析*/
        console.log(`\n📄 Analyzing document with ${images.length} images`);

        const content: MessageContent[] = [];

        // すべての画像を追加
        for (const imgPath of images) {
            content.push(this.encodeImage(imgPath));
        }

        // クエリを追加
        content.push({
            type: "text",
            text: `
以下の画像は1つのドキュメントから抽出されたものです。

質問: ${query}

すべての画像を参照して、包括的に回答してください。
`
        });

        const message = await this.client.messages.create({
            model: "claude-sonnet-4-5-20251101",
            max_tokens: 2048,
            messages: [
                {
                    role: "user",
                    content: content
                }
            ]
        });

        return (message.content[0] as any).text;
    }

    async compareImages(image1: string, image2: string): Promise<string> {
        /**2つの画像を比較*/
        console.log("\n🔍 Comparing images:");
        console.log(`   Image 1: ${image1}`);
        console.log(`   Image 2: ${image2}`);

        const content: MessageContent[] = [
            this.encodeImage(image1),
            this.encodeImage(image2),
            {
                type: "text",
                text: "これら2つの画像を比較して、違いと共通点を説明してください。"
            }
        ];

        const message = await this.client.messages.create({
            model: "claude-sonnet-4-5-20251101",
            max_tokens: 1024,
            messages: [
                {
                    role: "user",
                    content: content
                }
            ]
        });

        return (message.content[0] as any).text;
    }
}

// === 使用例 ===

async function main() {
    const agent = new MultimodalAgent(process.env.ANTHROPIC_API_KEY || "");

    // 例1: 単一画像分析
    // const result = await agent.analyzeImage(
    //     "path/to/image.jpg",
    //     "この画像に何が写っていますか？"
    // );
    // console.log(`\n回答:\n${result}`);

    // 例2: 複数画像分析
    // const result = await agent.analyzeDocumentWithImages(
    //     ["page1.jpg", "page2.jpg", "page3.jpg"],
    //     "このドキュメントの主なポイントは何ですか？"
    // );
    // console.log(`\n回答:\n${result}`);

    // 例3: 画像比較
    // const result = await agent.compareImages(
    //     "before.jpg",
    //     "after.jpg"
    // );
    // console.log(`\n比較結果:\n${result}`);

    console.log("✅ Multimodal agent ready");
    console.log("   Uncomment examples in main() to test");
}

// メイン実行
if (require.main === module) {
    main();
}
```

---

## 🧪 例5: デバッグとモニタリング

エージェントの動作を可視化します。

### debug_tools.ts

```typescript
/**
 * デバッグとモニタリングツール
 */

import { writeFileSync } from "fs";

interface LogEntry {
    timestamp: number;
    type: string;
    data: any;
}

class AgentMonitor {
    private logs: LogEntry[] = [];
    private startTime: number | null = null;

    start(): void {
        /**モニタリング開始*/
        this.startTime = Date.now();
        this.logs = [];
    }

    log(eventType: string, data: any): void {
        /**イベントをログ*/
        if (this.startTime === null) {
            throw new Error("Monitor not started. Call start() first.");
        }

        this.logs.push({
            timestamp: (Date.now() - this.startTime) / 1000,
            type: eventType,
            data: data
        });
    }

    printSummary(): void {
        /**サマリーを表示*/
        console.log("\n" + "=".repeat(60));
        console.log("📊 Agent Execution Summary");
        console.log("=".repeat(60));

        // 実行時間
        const totalTime = this.logs.length > 0 ? this.logs[this.logs.length - 1].timestamp : 0;
        console.log(`\n⏱️  Total time: ${totalTime.toFixed(2)}s`);

        // イベント数
        const eventCounts: Record<string, number> = {};
        for (const log of this.logs) {
            const eventType = log.type;
            eventCounts[eventType] = (eventCounts[eventType] || 0) + 1;
        }

        console.log("\n📈 Events:");
        for (const [eventType, count] of Object.entries(eventCounts)) {
            console.log(`   ${eventType}: ${count}`);
        }

        // トークン使用量（もしあれば）
        const totalTokens = this.logs.reduce((sum, log) => {
            if (typeof log.data === "object" && log.data !== null && "tokens" in log.data) {
                return sum + (log.data.tokens as number);
            }
            return sum;
        }, 0);

        if (totalTokens > 0) {
            console.log(`\n🎫 Total tokens: ${totalTokens.toLocaleString()}`);
        }
    }

    saveLogs(filepath: string): void {
        /**ログをファイルに保存*/
        writeFileSync(filepath, JSON.stringify(this.logs, null, 2));
        console.log(`💾 Logs saved to ${filepath}`);
    }
}

// デコレータ関数

function monitorNode<T extends any[], R>(
    monitor: AgentMonitor,
    func: (...args: T) => R
): (...args: T) => R {
    /**ノード実行をモニター*/
    return function(...args: T): R {
        const nodeName = func.name;

        // 開始ログ
        monitor.log("node_start", {
            node: nodeName,
            state_keys: typeof args[0] === "object" ? Object.keys(args[0]) : []
        });

        const start = Date.now();

        // 実行
        const result = func(...args);

        // 終了ログ
        const duration = (Date.now() - start) / 1000;
        monitor.log("node_end", {
            node: nodeName,
            duration: duration
        });

        console.log(`   [${nodeName}] ${duration.toFixed(2)}s`);

        return result;
    };
}

// === 使用例 ===

const monitor = new AgentMonitor();

function exampleNode(state: any): any {
    /**例ノード*/
    // 処理のシミュレーション
    const start = Date.now();
    while (Date.now() - start < 500) {
        // 0.5秒待機
    }
    return state;
}

const monitoredExampleNode = monitorNode(monitor, exampleNode);

// 実行
monitor.start();

let state = { test: "data" };

for (let i = 0; i < 3; i++) {
    state = monitoredExampleNode(state);
}

monitor.printSummary();
monitor.saveLogs("agent_logs.json");
```

---

## 📝 テンプレート: カスタムエージェント

自分専用のエージェントを作る際のテンプレートです。

### custom_agent_template.ts

```typescript
/**
 * カスタムエージェントテンプレート
 *
 * このテンプレートをコピーして、独自のエージェントを作成してください。
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, SystemMessage, BaseMessage } from "@langchain/core/messages";

// ===========================
// 1. State定義
// ===========================

/**
 * エージェントの状態を定義
 *
 * ここに必要なフィールドを追加してください
 */
interface CustomState {
    messages: BaseMessage[];
    // カスタムフィールド（例）
    goal: string;
    currentStep: number;
    maxSteps: number;
    status: 'working' | 'done' | 'failed';
    // 以下に追加...
}

const CustomStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => []
    }),
    goal: Annotation<string>(),
    currentStep: Annotation<number>(),
    maxSteps: Annotation<number>(),
    status: Annotation<'working' | 'done' | 'failed'>()
});

// ===========================
// 2. システムプロンプト
// ===========================

const SYSTEM_PROMPT = `
あなたの役割とルールをここに記述してください。

例:
あなたは〇〇を支援するアシスタントです。

原則:
1. ...
2. ...
3. ...
`;

// ===========================
// 3. LLM初期化
// ===========================

const llm = new ChatAnthropic({
    model: "claude-sonnet-4-5-20251101",  // または他のモデル
    temperature: 0,  // 必要に応じて調整
    maxTokens: 4096
});

// ===========================
// 4. ノード定義
// ===========================

async function myNode1(state: typeof CustomStateAnnotation.State): Promise<Partial<CustomState>> {
    /**
     * 最初のノード
     *
     * ここで何をするか説明してください
     */
    console.log(`\n[Node 1] Step ${state.currentStep}`);

    // 処理をここに実装
    // ...

    return {
        currentStep: state.currentStep + 1
    };
}

async function myNode2(state: typeof CustomStateAnnotation.State): Promise<Partial<CustomState>> {
    /**
     * 2番目のノード
     */
    console.log("\n[Node 2] Processing...");

    // LLM呼び出しの例
    const messages = [
        new SystemMessage(SYSTEM_PROMPT),
        ...state.messages,
        new HumanMessage("...")  // プロンプトを構築
    ];

    const response = await llm.invoke(messages);

    return {
        messages: [response]
    };
}

// ===========================
// 5. ルーティング関数
// ===========================

function shouldContinue(state: typeof CustomStateAnnotation.State): string {
    /**
     * 次にどのノードに進むか決定
     */
    if (state.status === "done") {
        return "end";
    }

    if (state.currentStep >= state.maxSteps) {
        return "end";
    }

    // 条件に応じてルーティング
    // ...

    return "continue";
}

// ===========================
// 6. グラフ構築
// ===========================

const workflow = new StateGraph(CustomStateAnnotation);

// ノードを追加
workflow.addNode("node1", myNode1);
workflow.addNode("node2", myNode2);
// ... 他のノードを追加

// エントリーポイント
workflow.addEdge("__start__", "node1");

// エッジを定義
workflow.addEdge("node1", "node2");

// 条件付きエッジ
workflow.addConditionalEdges(
    "node2",
    shouldContinue,
    {
        "continue": "node1",  // ループ
        "end": END
    }
);

// コンパイル
const app = workflow.compile();

// ===========================
// 7. 実行関数
// ===========================

async function run(goal: string, maxSteps: number = 10): Promise<CustomState> {
    /**
     * エージェントを実行
     *
     * @param goal - 達成したい目標
     * @param maxSteps - 最大ステップ数
     */
    const initialState: CustomState = {
        messages: [],
        goal: goal,
        currentStep: 0,
        maxSteps: maxSteps,
        status: "working"
    };

    console.log("🚀 Starting agent");
    console.log(`   Goal: ${goal}`);
    console.log(`   Max steps: ${maxSteps}`);
    console.log("=".repeat(60));

    const result = await app.invoke(initialState);

    console.log("\n" + "=".repeat(60));
    console.log("✅ Completed");
    console.log(`   Steps: ${result.currentStep}`);
    console.log(`   Status: ${result.status}`);

    return result;
}

// ===========================
// 8. メイン
// ===========================

if (require.main === module) {
    // テスト実行
    run(
        "Your goal here",
        5
    );
}
```

---

## 📚 参考資料

### すべての例で使用したライブラリ

```bash
npm install @langchain/langgraph @langchain/anthropic @langchain/core
npm install chromadb
npm install axios cheerio
npm install @anthropic-ai/sdk
npm install zod tsx
```

### 関連ドキュメント

- [01-claude-design-philosophy.md](./01-claude-design-philosophy.md) - 設計思想
- [02-context-engineering.md](./02-context-engineering.md) - Context Engineering
- [03-agent-architecture.md](./03-agent-architecture.md) - アーキテクチャ
- [04-implementation-guide.md](./04-implementation-guide.md) - 実装ガイド
- [05-multimodal-implementation.md](./05-multimodal-implementation.md) - マルチモーダル

---

## 🎯 次のステップ

1. **最小限の例から始める**: `minimal_agent.ts` を実行
2. **ツールを追加**: `tool_agent.ts` でツール統合を学ぶ
3. **RAGを統合**: `rag_agent.ts` で知識ベース統合
4. **カスタマイズ**: テンプレートを使って独自エージェントを作成

---

これで、Claude風システムを実装するための完全なガイドが完成しました！

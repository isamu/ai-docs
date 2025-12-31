# Claude風システム実装ガイド

## 概要

このドキュメントでは、OSSツールを使ってClaude風のエージェントシステムを実装する具体的な手順を解説します。

---

## 🛠️ 必要なツールスタック

### 推奨構成

| カテゴリ | ツール | 用途 | 理由 |
|---------|-------|------|------|
| **エージェント** | LangGraph | 状態機械・実行ループ | Anthropic推奨 |
| **LLM接続** | LangChain | LLM抽象化 | エコシステムが豊富 |
| **ツール接続** | Model Context Protocol (MCP) | 統一インターフェース | Anthropic公式 |
| **ベクトルDB** | Chroma / Qdrant | セマンティック検索 | 軽量・高速 |
| **推論サーバー** | vLLM / Ollama | ローカルLLM | 低コスト |

### インストール

```bash
# Node.js環境（推奨: 18+）
npm install @langchain/langgraph @langchain/core @langchain/anthropic
npm install chromadb
npm install js-tiktoken  # トークンカウント

# または pnpm を使用
pnpm add @langchain/langgraph @langchain/core @langchain/anthropic
pnpm add chromadb js-tiktoken

# Model Context Protocol SDK
npm install @modelcontextprotocol/sdk

# ドキュメント処理
npm install pdf-parse mammoth unstructured-client

# 動画処理（オプション）
npm install @ffmpeg-installer/ffmpeg fluent-ffmpeg
```

---

## 🏗️ ステップ1: Stateスキーマの定義

LangGraphのStateGraphを使います。

### state.ts

```typescript
import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// 事実の定義
export interface Fact {
  content: string;
  source: 'user' | 'tool' | 'inference';
  confidence: 'high' | 'medium' | 'low';
  timestamp: number;
}

// 質問の定義
export interface Question {
  question: string;
  priority: 'high' | 'medium' | 'low';
  blocks_progress: boolean;
}

// 計画ステップの定義
export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  result: string | null;
}

// エージェント状態の定義
export interface AgentState {
  // 目標
  goal: string;
  original_goal: string;

  // 知識
  known_facts: Fact[];
  open_questions: Question[];

  // 計画
  plan_steps: PlanStep[];
  current_step_index: number;

  // 会話履歴（LangGraphの組み込み）
  messages: BaseMessage[];

  // 観測
  observations: Array<Record<string, any>>;

  // メタ情報
  iteration_count: number;
  status: 'planning' | 'executing' | 'blocked' | 'completed';
}

// LangGraphのAnnotation定義
export const AgentStateAnnotation = Annotation.Root({
  goal: Annotation<string>(),
  original_goal: Annotation<string>(),
  known_facts: Annotation<Fact[]>(),
  open_questions: Annotation<Question[]>(),
  plan_steps: Annotation<PlanStep[]>(),
  current_step_index: Annotation<number>(),
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
  }),
  observations: Annotation<Array<Record<string, any>>>(),
  iteration_count: Annotation<number>(),
  status: Annotation<'planning' | 'executing' | 'blocked' | 'completed'>(),
});
```

---

## 🔄 ステップ2: Plan-Act-Observe-Reflectの実装

LangGraphでノードとエッジを定義します。

### agent.ts

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { AgentState, AgentStateAnnotation, PlanStep } from "./state";

// LLMの初期化
const llm = new ChatAnthropic({
  model: "claude-opus-4-5-20251101",
  temperature: 0,
});

// ノード定義

async function planNode(state: AgentState): Promise<Partial<AgentState>> {
  /**計画フェーズ*/
  console.log(`[PLAN] Planning for goal: ${state.goal}`);

  // Context Builderでコンテキスト構築
  const context = buildPlanningContext(state);

  // LLMに計画を依頼
  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(context),
  ];

  const response = await llm.invoke(messages);
  const planSteps = parsePlan(response.content as string);

  return {
    plan_steps: planSteps,
    current_step_index: 0,
    status: "executing",
    messages: [response],
  };
}

async function actNode(state: AgentState): Promise<Partial<AgentState>> {
  /**実行フェーズ*/
  const currentStep = state.plan_steps[state.current_step_index];
  console.log(`[ACT] Executing step: ${currentStep.description}`);

  // ツール必要性の判断
  const context = buildActionContext(state, currentStep);

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(context),
  ];

  const response = await llm.invoke(messages);
  const action = parseAction(response.content as string);

  // アクション実行
  const newObservations = [...state.observations];

  if (action.type === "use_tool") {
    // ツール実行
    const toolResult = await executeTool(action.tool, action.params);

    newObservations.push({
      source: action.tool,
      content: toolResult,
      timestamp: Date.now(),
    });
  }

  return {
    observations: newObservations,
    messages: [response],
  };
}

async function observeNode(state: AgentState): Promise<Partial<AgentState>> {
  /**観察フェーズ*/
  console.log("[OBSERVE] Analyzing observations");

  if (state.observations.length === 0) {
    return {};
  }

  const latestObs = state.observations[state.observations.length - 1];

  // 観測結果の解釈
  const context = buildObservationContext(state, latestObs);

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(context),
  ];

  const response = await llm.invoke(messages);
  const interpretation = parseInterpretation(response.content as string);

  // 新しい事実を追加
  const newFacts = [...state.known_facts, ...interpretation.new_facts];

  // ステップのステータス更新
  const planSteps = [...state.plan_steps];
  if (interpretation.step_impact === "completed") {
    planSteps[state.current_step_index].status = "completed";
  }

  return {
    known_facts: newFacts,
    plan_steps: planSteps,
    messages: [response],
  };
}

async function reflectNode(state: AgentState): Promise<Partial<AgentState>> {
  /**反省フェーズ*/
  console.log("[REFLECT] Evaluating progress");

  const context = buildReflectionContext(state);

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(context),
  ];

  const response = await llm.invoke(messages);
  const reflection = parseReflection(response.content as string);

  const updates: Partial<AgentState> = {
    iteration_count: state.iteration_count + 1,
    messages: [response],
  };

  // 次の状態を決定
  if (reflection.goal_achieved) {
    updates.status = "completed";
  } else if (reflection.needs_replanning) {
    updates.status = "planning";
    updates.plan_steps = [];
  } else if (reflection.needs_user_input) {
    updates.status = "blocked";
  } else {
    // 次のステップへ
    const nextIndex = state.current_step_index + 1;
    updates.current_step_index = nextIndex;
    if (nextIndex >= state.plan_steps.length) {
      updates.status = "completed";
    }
  }

  return updates;
}

// ルーティング関数

function shouldContinue(state: AgentState): string {
  /**次のノードを決定*/
  const status = state.status;

  if (status === "completed") {
    return "end";
  } else if (status === "planning") {
    return "plan";
  } else if (status === "blocked") {
    return "wait_user";
  } else if (status === "executing") {
    return "act";
  } else {
    return "end";
  }
}

function afterReflect(state: AgentState): string {
  /**Reflect後の遷移*/
  if (state.status === "completed") {
    return "end";
  } else if (state.status === "planning") {
    return "plan";
  } else if (state.status === "blocked") {
    return "wait_user";
  } else {
    return "act";
  }
}

// グラフ構築

const workflow = new StateGraph(AgentStateAnnotation);

// ノードを追加
workflow.addNode("plan", planNode);
workflow.addNode("act", actNode);
workflow.addNode("observe", observeNode);
workflow.addNode("reflect", reflectNode);

// エントリーポイント
workflow.addEdge("__start__", "plan");

// エッジ
workflow.addEdge("plan", "act");
workflow.addEdge("act", "observe");
workflow.addEdge("observe", "reflect");

// 条件付きエッジ
workflow.addConditionalEdges(
  "reflect",
  afterReflect,
  {
    plan: "plan",
    act: "act",
    wait_user: END,  // ユーザー入力待ち
    end: END,
  }
);

// コンパイル
export const app = workflow.compile();
```

---

## 🧠 ステップ3: Context Builderの実装

### context_builder.ts

```typescript
import { Tiktoken } from "js-tiktoken";
import { AgentState, Fact, PlanStep } from "./state";

export class ContextBuilder {
  private maxTokens: number;
  private encoder: Tiktoken;

  constructor(maxTokens: number = 180000) {
    this.maxTokens = maxTokens;
    // Claude用のo200k_baseエンコーディング
    this.encoder = new Tiktoken("o200k_base");
  }

  buildPlanningContext(state: AgentState): string {
    /**計画フェーズ用コンテキスト*/
    const context = `
<goal>
${state.goal}
</goal>

<known_facts>
${this.formatFacts(state.known_facts)}
</known_facts>

<open_questions>
${this.formatQuestions(state.open_questions)}
</open_questions>

タスク: 上記の目標を達成するための詳細な計画を立ててください。

計画形式:
<plan>
  <strategy>全体戦略</strategy>
  <steps>
    <step id="1">ステップ1</step>
    <step id="2" depends_on="1">ステップ2</step>
  </steps>
</plan>
`;
    return this.compressIfNeeded(context);
  }

  buildActionContext(state: AgentState, currentStep: PlanStep): string {
    /**実行フェーズ用コンテキスト*/
    const context = `
<current_step>
${currentStep.description}
</current_step>

<recent_observations>
${this.formatRecentObservations(state.observations, 5)}
</recent_observations>

<available_tools>
${this.formatTools(AVAILABLE_TOOLS)}
</available_tools>

タスク: このステップを実行するアクションを選択してください。

以下の形式で回答:
<action type="use_tool|no_tool|ask_user">
  <tool>ツール名（use_toolの場合）</tool>
  <params>パラメータJSON</params>
  <reason>理由</reason>
</action>
`;
    return this.compressIfNeeded(context);
  }

  private formatFacts(facts: Fact[]): string {
    /**事実をXML形式で整形*/
    if (facts.length === 0) {
      return "<none />";
    }

    return facts
      .map(
        (f) =>
          `<fact source="${f.source}" confidence="${f.confidence}">` +
          `${f.content}` +
          `</fact>`
      )
      .join("\n");
  }

  private formatObservations(
    observations: Array<Record<string, any>>,
    maxCount: number = 10
  ): string {
    /**観測をXML形式で整形*/
    const recent = observations.slice(-maxCount);

    if (recent.length === 0) {
      return "<none />";
    }

    return recent
      .map(
        (o) =>
          `<observation source="${o.source}">` +
          `${o.content}` +
          `</observation>`
      )
      .join("\n");
  }

  private formatRecentObservations(
    observations: Array<Record<string, any>>,
    maxCount: number
  ): string {
    return this.formatObservations(observations, maxCount);
  }

  private formatQuestions(questions: Array<any>): string {
    if (questions.length === 0) {
      return "<none />";
    }

    return questions
      .map(
        (q) =>
          `<question priority="${q.priority}">` +
          `${q.question}` +
          `</question>`
      )
      .join("\n");
  }

  private formatTools(tools: Array<any>): string {
    return tools
      .map(
        (t) =>
          `<tool name="${t.name}">` +
          `${t.description}` +
          `</tool>`
      )
      .join("\n");
  }

  private compressIfNeeded(context: string): string {
    /**必要に応じて圧縮*/
    const tokenCount = this.encoder.encode(context).length;

    if (tokenCount > this.maxTokens * 0.8) {
      // 圧縮戦略を適用
      // 例: 古い観測を削除、要約など
      // TODO: 実装
    }

    return context;
  }

  countTokens(text: string): number {
    /**トークン数をカウント*/
    return this.encoder.encode(text).length;
  }

  free(): void {
    /**エンコーダーのリソース解放*/
    this.encoder.free();
  }
}
```

---

## 🔌 ステップ4: Model Context Protocol (MCP)統合

MCPを使ってツールを標準化します。

### mcp_tools.ts

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";

// MCPサーバーの定義

const server = new Server(
  {
    name: "claude-style-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ツールリストのハンドラ
server.setRequestHandler(ListToolsRequestSchema, async () => {
  /**利用可能なツールのリスト*/
  return {
    tools: [
      {
        name: "web_search",
        description: "Search the web for information",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query",
            },
            max_results: {
              type: "number",
              description: "Max results",
              default: 5,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "read_file",
        description: "Read contents of a file",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "File path",
            },
          },
          required: ["path"],
        },
      },
    ] as Tool[],
  };
});

// ツール実行のハンドラ
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  /**ツールの実行*/
  const { name, arguments: args } = request.params;

  try {
    if (name === "web_search") {
      const result = await webSearch(
        args.query as string,
        (args.max_results as number) || 5
      );
      return {
        content: [{ type: "text", text: result }],
      };
    } else if (name === "read_file") {
      const result = await readFile(args.path as string);
      return {
        content: [{ type: "text", text: result }],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// ツール実装

async function webSearch(query: string, maxResults: number): Promise<string> {
  /**Web検索の実装*/
  // 実際の検索API呼び出し
  // 例: SerpAPI, Brave Search API, etc.
  const results = await performSearch(query, maxResults);

  return JSON.stringify(results, null, 2);
}

async function readFile(path: string): Promise<string> {
  /**ファイル読み込みの実装*/
  try {
    const content = await fs.readFile(path, "utf-8");
    return content;
  } catch (error) {
    throw new Error(
      `Error reading file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function performSearch(
  query: string,
  maxResults: number
): Promise<any[]> {
  // TODO: 実際の検索API実装
  return [];
}

// サーバー起動

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
```

### エージェントからの利用

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export async function executeToolViaMcp(
  toolName: string,
  params: Record<string, any>
): Promise<string> {
  /**MCPを通じてツールを実行*/
  const transport = new StdioClientTransport({
    command: "node",
    args: ["mcp_tools.js"],
  });

  const client = new Client(
    {
      name: "claude-agent-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);

  try {
    // ツール呼び出し
    const result = await client.callTool({
      name: toolName,
      arguments: params,
    });

    return result.content[0].text;
  } finally {
    await client.close();
  }
}
```

---

## 📚 ステップ5: RAG統合（オプション）

外部知識を取り込みます。

### rag.ts

```typescript
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { AgentState } from "./state";

export class RAGSystem {
  private embeddings: HuggingFaceTransformersEmbeddings;
  private vectorstore: Chroma | null;
  private persistDirectory: string;

  constructor(persistDirectory: string = "./chroma_db") {
    this.embeddings = new HuggingFaceTransformersEmbeddings({
      modelName: "Xenova/all-MiniLM-L6-v2",
    });
    this.vectorstore = null;
    this.persistDirectory = persistDirectory;
  }

  async indexDocuments(docsPath: string): Promise<void> {
    /**ドキュメントをインデックス*/
    // ドキュメント読み込み
    const loader = new DirectoryLoader(docsPath, {
      ".md": (path) => new TextLoader(path),
      ".txt": (path) => new TextLoader(path),
    });
    const documents = await loader.load();

    // チャンク分割
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await textSplitter.splitDocuments(documents);

    // ベクトル化
    this.vectorstore = await Chroma.fromDocuments(chunks, this.embeddings, {
      collectionName: "documents",
      url: "http://localhost:8000", // Chroma server URL
    });
  }

  async retrieve(query: string, k: number = 5): Promise<string[]> {
    /**関連文書を取得*/
    if (!this.vectorstore) {
      // 永続化されたDBから読み込み
      this.vectorstore = await Chroma.fromExistingCollection(this.embeddings, {
        collectionName: "documents",
        url: "http://localhost:8000",
      });
    }

    const docs = await this.vectorstore.similaritySearch(query, k);

    return docs.map((doc) => doc.pageContent);
  }
}

// エージェントへの統合

export function buildContextWithRag(
  state: AgentState,
  relevantDocs: string[]
): string {
  /**RAGを使ったコンテキスト構築*/
  const context = `
<goal>
${state.goal}
</goal>

<relevant_knowledge>
${relevantDocs.map((doc) => `<doc>${doc}</doc>`).join("\n")}
</relevant_knowledge>

<known_facts>
${formatFacts(state.known_facts)}
</known_facts>

...
`;
  return context;
}

function formatFacts(facts: any[]): string {
  // TODO: 実装
  return facts
    .map((f) => `<fact>${f.content}</fact>`)
    .join("\n");
}
```

---

## 🎨 ステップ6: UIとモニタリング

### Express + React ダッシュボード

#### バックエンド (server.ts)

```typescript
import express from "express";
import cors from "cors";
import { app } from "./agent";
import { AgentState } from "./state";

const server = express();
server.use(cors());
server.use(express.json());

// エージェント実行エンドポイント
server.post("/api/execute", async (req, res) => {
  try {
    const { goal } = req.body;

    if (!goal) {
      return res.status(400).json({ error: "Goal is required" });
    }

    // 初期状態
    const initialState: AgentState = {
      goal,
      original_goal: goal,
      known_facts: [],
      open_questions: [],
      plan_steps: [],
      current_step_index: 0,
      messages: [],
      observations: [],
      iteration_count: 0,
      status: "planning",
    };

    // エージェント実行
    const result = await app.invoke(initialState);

    res.json(result);
  } catch (error) {
    console.error("Error executing agent:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

#### フロントエンド (Dashboard.tsx)

```typescript
import React, { useState } from "react";
import { AgentState } from "./types";

export function Dashboard() {
  const [goal, setGoal] = useState("");
  const [state, setState] = useState<AgentState | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    if (!goal) return;

    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ goal }),
      });

      const result = await response.json();
      setState(result);
    } catch (error) {
      console.error("Error:", error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      completed: "✅",
      in_progress: "🔄",
      pending: "⏳",
      failed: "❌",
    };
    return icons[status] || "❓";
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1>Claude-Style Agent</h1>

      {/* 入力フォーム */}
      <div style={{ marginBottom: "20px" }}>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="目標を入力してください..."
          style={{ width: "100%", height: "100px", padding: "10px" }}
        />
        <button
          onClick={handleExecute}
          disabled={loading || !goal}
          style={{ marginTop: "10px", padding: "10px 20px" }}
        >
          {loading ? "実行中..." : "実行"}
        </button>
      </div>

      {/* 進捗表示 */}
      {state && state.plan_steps.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2>計画</h2>
          {state.plan_steps.map((step, i) => (
            <div key={i} style={{ marginBottom: "10px" }}>
              {getStatusIcon(step.status)} <strong>Step {i + 1}:</strong>{" "}
              {step.description}
            </div>
          ))}
        </div>
      )}

      {/* 事実表示 */}
      {state && state.known_facts.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h2>判明した事実</h2>
          <ul>
            {state.known_facts.map((fact, i) => (
              <li key={i}>
                {fact.content} ({fact.confidence})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 観測表示 */}
      {state && state.observations.length > 0 && (
        <div>
          <h2>観測結果</h2>
          {state.observations.slice(-5).map((obs, i) => (
            <details key={i} style={{ marginBottom: "10px" }}>
              <summary>📊 {obs.source}</summary>
              <pre style={{ background: "#f5f5f5", padding: "10px" }}>
                {obs.content}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 ステップ7: テスト

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { planNode, actNode } from "./agent";
import { AgentState } from "./state";
import { ContextBuilder } from "./context_builder";

describe("Agent Tests", () => {
  it("should execute plan node", async () => {
    /**計画ノードのテスト*/
    const initialState: AgentState = {
      goal: "Analyze sales data for Q1 2024",
      original_goal: "Analyze sales data for Q1 2024",
      known_facts: [],
      open_questions: [],
      plan_steps: [],
      current_step_index: 0,
      messages: [],
      observations: [],
      iteration_count: 0,
      status: "planning",
    };

    const result = await planNode(initialState);

    expect(result.status).toBe("executing");
    expect(result.plan_steps).toBeDefined();
    expect(result.plan_steps!.length).toBeGreaterThan(0);
    expect(result.plan_steps![0].id).toBe("1");
  });

  it("should build planning context", () => {
    /**Context Builderのテスト*/
    const builder = new ContextBuilder(100000);

    const state: AgentState = {
      goal: "Test goal",
      original_goal: "Test goal",
      known_facts: [
        {
          content: "Fact 1",
          source: "user",
          confidence: "high",
          timestamp: Date.now(),
        },
      ],
      open_questions: [],
      plan_steps: [],
      current_step_index: 0,
      messages: [],
      observations: [],
      iteration_count: 0,
      status: "planning",
    };

    const context = builder.buildPlanningContext(state);

    expect(context).toContain("<goal>Test goal</goal>");
    expect(context).toContain("<fact");
    expect(builder.countTokens(context)).toBeLessThan(100000);

    // リソース解放
    builder.free();
  });
});

describe("Context Builder Tests", () => {
  let builder: ContextBuilder;

  beforeEach(() => {
    builder = new ContextBuilder(100000);
  });

  afterEach(() => {
    builder.free();
  });

  it("should format facts correctly", () => {
    const state: AgentState = {
      goal: "Test",
      original_goal: "Test",
      known_facts: [
        {
          content: "Test fact",
          source: "user",
          confidence: "high",
          timestamp: Date.now(),
        },
      ],
      open_questions: [],
      plan_steps: [],
      current_step_index: 0,
      messages: [],
      observations: [],
      iteration_count: 0,
      status: "planning",
    };

    const context = builder.buildPlanningContext(state);

    expect(context).toContain('source="user"');
    expect(context).toContain('confidence="high"');
    expect(context).toContain("Test fact");
  });
});
```

---

## 📦 完全な実装例

すべてを統合したサンプル：

### main.ts

```typescript
import { app } from "./agent";
import { AgentState } from "./state";
import { RAGSystem } from "./rag";
import { ContextBuilder } from "./context_builder";

async function main() {
  // RAGシステム初期化
  const rag = new RAGSystem();
  await rag.indexDocuments("./knowledge_base");

  // Context Builder初期化
  const contextBuilder = new ContextBuilder(180000);

  // 初期状態
  const initialState: AgentState = {
    goal: "TypeScriptでファイル読み込みの最適な方法を調べて、コード例を作成",
    original_goal: "TypeScriptでファイル読み込みの最適な方法を調べて、コード例を作成",
    known_facts: [],
    open_questions: [],
    plan_steps: [],
    current_step_index: 0,
    messages: [],
    observations: [],
    iteration_count: 0,
    status: "planning",
  };

  // エージェント実行
  console.log("🚀 Starting agent...");
  const finalState = await app.invoke(initialState);

  // 結果表示
  console.log("\n✅ Task completed!");
  console.log(`Status: ${finalState.status}`);
  console.log(`Iterations: ${finalState.iteration_count}`);

  console.log("\n📋 Completed Steps:");
  for (const step of finalState.plan_steps) {
    if (step.status === "completed") {
      console.log(`  ✓ ${step.description}`);
      if (step.result) {
        console.log(`    → ${step.result}`);
      }
    }
  }

  console.log("\n📚 Known Facts:");
  for (const fact of finalState.known_facts) {
    console.log(`  - ${fact.content} (${fact.confidence})`);
  }

  // リソース解放
  contextBuilder.free();
}

// エントリーポイント
if (require.main === module) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export { main };
```

---

## 🚀 実行

```bash
# 依存関係インストール
npm install
# または
pnpm install

# TypeScriptのコンパイル
npm run build
# または
npx tsc

# エージェント実行
npm run start
# または
node dist/main.js

# 開発モード（ウォッチモード）
npm run dev
# または
npx tsx watch src/main.ts

# ダッシュボード起動（バックエンド）
npm run server
# または
node dist/server.js

# フロントエンド起動（別ターミナル）
cd frontend
npm install
npm run dev
```

### package.json の例

```json
{
  "name": "claude-style-agent",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/main.js",
    "dev": "tsx watch src/main.ts",
    "server": "node dist/server.js",
    "test": "vitest"
  },
  "dependencies": {
    "@langchain/langgraph": "^0.0.20",
    "@langchain/core": "^0.1.50",
    "@langchain/anthropic": "^0.1.10",
    "@langchain/community": "^0.0.40",
    "@modelcontextprotocol/sdk": "^0.5.0",
    "chromadb": "^1.8.1",
    "js-tiktoken": "^1.0.10",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "vitest": "^1.2.0"
  }
}
```

### tsconfig.json の例

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 📚 参考資料

### 公式ドキュメント

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Anthropic API Docs](https://docs.anthropic.com/)

### 関連ドキュメント

- [03-agent-architecture.md](./03-agent-architecture.md) - アーキテクチャ設計
- [05-multimodal-implementation.md](./05-multimodal-implementation.md) - マルチモーダル対応
- [06-practical-examples.md](./06-practical-examples.md) - 実践例

---

**次**: [05-multimodal-implementation.md](./05-multimodal-implementation.md) - ドキュメント・動画処理の実装

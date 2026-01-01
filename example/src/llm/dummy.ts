/**
 * Dummy LLM Provider for Testing
 */

import {
  LLMProvider,
  LLMProviderConfig,
  ToolSchema,
  BaseMessage,
  ToolResult,
  LLMResponse,
  ContentBlock,
  StreamCallback,
} from "./types";

// 固定レスポンスのマッピング
interface MockResponse {
  pattern: RegExp;
  response: LLMResponse;
}

// デフォルトのモックレスポンス
const DEFAULT_MOCK_RESPONSES: MockResponse[] = [
  {
    pattern: /こんにちは|hello|hi/i,
    response: {
      content: [{ type: "text", text: "こんにちは！何かお手伝いできることはありますか？" }],
      stopReason: "end_turn",
    },
  },
  {
    pattern: /計算|calculate|(\d+\s*[+\-*/]\s*\d+)/i,
    response: {
      content: [
        { type: "text", text: "計算を実行します。" },
        {
          type: "tool_use",
          toolUse: {
            id: "tool_calc_001",
            name: "calculator",
            input: { expression: "5 + 3" },
          },
        },
      ],
      stopReason: "tool_use",
    },
  },
  {
    pattern: /ファイル.*読|read.*file/i,
    response: {
      content: [
        { type: "text", text: "ファイルを読み込みます。" },
        {
          type: "tool_use",
          toolUse: {
            id: "tool_read_001",
            name: "read_file",
            input: { path: "example.txt" },
          },
        },
      ],
      stopReason: "tool_use",
    },
  },
  {
    pattern: /ファイル.*書|write.*file/i,
    response: {
      content: [
        { type: "text", text: "ファイルに書き込みます。" },
        {
          type: "tool_use",
          toolUse: {
            id: "tool_write_001",
            name: "write_file",
            input: { path: "output.txt", content: "テスト内容" },
          },
        },
      ],
      stopReason: "tool_use",
    },
  },
  {
    pattern: /一覧|list/i,
    response: {
      content: [
        { type: "text", text: "ファイル一覧を取得します。" },
        {
          type: "tool_use",
          toolUse: {
            id: "tool_list_001",
            name: "list_files",
            input: {},
          },
        },
      ],
      stopReason: "tool_use",
    },
  },
  {
    pattern: /時間|time/i,
    response: {
      content: [
        { type: "text", text: "現在時刻を確認します。" },
        {
          type: "tool_use",
          toolUse: {
            id: "tool_time_001",
            name: "get_current_time",
            input: {},
          },
        },
      ],
      stopReason: "tool_use",
    },
  },
  {
    pattern: /完了|done|finish/i,
    response: {
      content: [
        {
          type: "tool_use",
          toolUse: {
            id: "tool_complete_001",
            name: "attempt_completion",
            input: { result: "タスクが完了しました。" },
          },
        },
      ],
      stopReason: "tool_use",
    },
  },
];

// ツール結果後のデフォルトレスポンス
const TOOL_RESULT_RESPONSE: LLMResponse = {
  content: [
    {
      type: "tool_use",
      toolUse: {
        id: "tool_complete_002",
        name: "attempt_completion",
        input: { result: "ツールの実行結果を確認しました。タスク完了です。" },
      },
    },
  ],
  stopReason: "tool_use",
};

// デフォルトフォールバックレスポンス
const FALLBACK_RESPONSE: LLMResponse = {
  content: [{ type: "text", text: "申し訳ありませんが、そのリクエストは理解できませんでした。" }],
  stopReason: "end_turn",
};

export class DummyProvider implements LLMProvider {
  readonly name = "dummy";
  private readonly mockResponses: MockResponse[];
  private readonly toolResultResponse: LLMResponse;
  private readonly fallbackResponse: LLMResponse;

  constructor(
    _config?: LLMProviderConfig,
    options?: {
      mockResponses?: MockResponse[];
      toolResultResponse?: LLMResponse;
      fallbackResponse?: LLMResponse;
    }
  ) {
    this.mockResponses = options?.mockResponses ?? DEFAULT_MOCK_RESPONSES;
    this.toolResultResponse = options?.toolResultResponse ?? TOOL_RESULT_RESPONSE;
    this.fallbackResponse = options?.fallbackResponse ?? FALLBACK_RESPONSE;
  }

  formatTools(_tools: ToolSchema[]): unknown[] {
    return [];
  }

  formatMessages(_messages: BaseMessage[]): unknown[] {
    return [];
  }

  formatToolResults(_results: ToolResult[]): unknown {
    return {};
  }

  async call(
    messages: BaseMessage[],
    _tools: ToolSchema[],
    onStream?: StreamCallback,
    _systemPrompt?: string
  ): Promise<LLMResponse> {
    const lastMessage = messages[messages.length - 1];
    const response = this.findResponse(lastMessage);

    // ストリームコールバックをシミュレート
    if (onStream) {
      response.content.forEach((block) => {
        if (block.type === "text") {
          onStream({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          onStream({ type: "tool_use_start", toolName: block.toolUse.name });
        }
      });
      onStream({ type: "done" });
    }

    return response;
  }

  private findResponse(message: BaseMessage): LLMResponse {
    // ツール結果の場合
    if (this.isToolResultMessage(message)) {
      return this.toolResultResponse;
    }

    // テキストメッセージの場合
    const text = this.extractText(message);
    if (!text) {
      return this.fallbackResponse;
    }

    // パターンマッチング
    const matched = this.mockResponses.find((mock) => mock.pattern.test(text));
    return matched?.response ?? this.fallbackResponse;
  }

  private isToolResultMessage(message: BaseMessage): boolean {
    if (!Array.isArray(message.content)) {
      return false;
    }
    const firstItem = message.content[0];
    return firstItem !== undefined && "toolUseId" in firstItem;
  }

  private extractText(message: BaseMessage): string | null {
    if (typeof message.content === "string") {
      return message.content;
    }

    if (!Array.isArray(message.content)) {
      return null;
    }

    const textBlocks = message.content.filter(
      (block): block is ContentBlock & { type: "text" } => "type" in block && block.type === "text"
    );

    return textBlocks.map((block) => block.text).join(" ") || null;
  }
}

// テスト用のヘルパー関数
export function createMockResponse(
  text: string,
  stopReason: LLMResponse["stopReason"] = "end_turn"
): LLMResponse {
  return {
    content: [{ type: "text", text }],
    stopReason,
  };
}

export function createToolUseResponse(
  toolName: string,
  input: Record<string, unknown>,
  toolUseId: string = `tool_${Date.now()}`
): LLMResponse {
  return {
    content: [
      {
        type: "tool_use",
        toolUse: { id: toolUseId, name: toolName, input },
      },
    ],
    stopReason: "tool_use",
  };
}

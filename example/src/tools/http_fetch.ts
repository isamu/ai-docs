/**
 * HTTP Fetch Tool - URLからコンテンツを取得
 */

import { ToolDefinition } from "./types";

const MAX_RESPONSE_LENGTH = 50000;
const DEFAULT_TIMEOUT = 30000; // 30秒

// 許可されたプロトコル
const ALLOWED_PROTOCOLS = ["http:", "https:"];

// 禁止されたホスト（内部ネットワーク）
const FORBIDDEN_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.", // リンクローカル
  "10.", // プライベート
  "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.",
  "172.24.", "172.25.", "172.26.", "172.27.",
  "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
];

function isUrlAllowed(urlString: string): { allowed: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    // プロトコルチェック
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
      return { allowed: false, reason: `プロトコル '${url.protocol}' は許可されていません` };
    }

    // ホストチェック
    const hostname = url.hostname.toLowerCase();
    for (const forbidden of FORBIDDEN_HOSTS) {
      if (hostname === forbidden || hostname.startsWith(forbidden)) {
        return { allowed: false, reason: "内部ネットワークへのアクセスは許可されていません" };
      }
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "無効なURL形式です" };
  }
}

function truncateResponse(content: string): string {
  if (content.length <= MAX_RESPONSE_LENGTH) {
    return content;
  }
  return content.substring(0, MAX_RESPONSE_LENGTH) +
    `\n... (レスポンスが${MAX_RESPONSE_LENGTH}文字で切り詰められました)`;
}

export const httpFetchTool: ToolDefinition = {
  definition: {
    name: "http_fetch",
    description: "URLからコンテンツを取得します。HTTPSを推奨します。内部ネットワークへのアクセスは禁止されています。",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "取得するURL",
        },
        method: {
          type: "string",
          description: "HTTPメソッド（GET, POST等。省略時はGET）",
        },
        headers: {
          type: "string",
          description: "追加ヘッダー（JSON形式）",
        },
        body: {
          type: "string",
          description: "リクエストボディ（POST等の場合）",
        },
      },
      required: ["url"],
    },
  },
  execute: async (input) => {
    const url = input.url as string;
    const method = (input.method as string)?.toUpperCase() || "GET";
    const headersJson = input.headers as string | undefined;
    const body = input.body as string | undefined;

    // URLチェック
    const check = isUrlAllowed(url);
    if (!check.allowed) {
      return `エラー: ${check.reason}`;
    }

    try {
      // ヘッダーのパース
      let headers: Record<string, string> = {
        "User-Agent": "AI-Agent-Fetch/1.0",
      };
      if (headersJson) {
        try {
          const parsedHeaders = JSON.parse(headersJson);
          headers = { ...headers, ...parsedHeaders };
        } catch {
          return "エラー: ヘッダーのJSON形式が不正です";
        }
      }

      // リクエスト実行
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      const response = await fetch(url, {
        method,
        headers,
        body: method !== "GET" && method !== "HEAD" ? body : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // レスポンス処理
      const contentType = response.headers.get("content-type") || "";
      const status = response.status;
      const statusText = response.statusText;

      let content: string;
      if (contentType.includes("application/json")) {
        const json = await response.json();
        content = JSON.stringify(json, null, 2);
      } else if (contentType.includes("text/") || contentType.includes("application/xml")) {
        content = await response.text();
      } else {
        // バイナリの場合はサイズのみ返す
        const buffer = await response.arrayBuffer();
        content = `[バイナリデータ: ${buffer.byteLength} bytes, Content-Type: ${contentType}]`;
      }

      const result = [
        `HTTP ${status} ${statusText}`,
        `Content-Type: ${contentType}`,
        "",
        truncateResponse(content),
      ].join("\n");

      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return `エラー: リクエストがタイムアウトしました（${DEFAULT_TIMEOUT / 1000}秒）`;
        }
        return `エラー: ${error.message}`;
      }
      return `エラー: ${String(error)}`;
    }
  },
};

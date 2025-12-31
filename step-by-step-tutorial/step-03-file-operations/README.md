# Step 3: ファイル操作

## 🎯 このステップで学ぶこと

- ファイル読み込み・書き込みツールの実装
- 非同期ファイル操作（promises API）
- エラーハンドリングとセキュリティ考慮
- 実用的なコーディング補助エージェントへの進化

## 📝 概要

Step 2のツールに加えて、ファイル操作ツールを追加します。これにより、実際のコーディング作業に近いタスクが可能になります。

### 追加するツール

1. **read_file** - ファイルの内容を読み取る
2. **write_file** - ファイルに内容を書き込む
3. **list_files** - ディレクトリ内のファイル一覧を取得

### 動作の流れ

```
ユーザー: "example.txtファイルを読んで、全て大文字に変換してoutput.txtに保存して"
   ↓
LLM: [read_file(path="example.txt")を使う]
   ↓
Tool: "hello world"
   ↓
LLM: [write_file(path="output.txt", content="HELLO WORLD")を使う]
   ↓
Tool: "ファイルを書き込みました"
   ↓
LLM: "example.txtの内容を大文字に変換してoutput.txtに保存しました"
```

## 🔑 重要な概念

### 1. 非同期ファイル操作

Node.jsのファイル操作は非同期で行うのが推奨されます：

```typescript
import { readFile, writeFile, readdir } from "fs/promises";

// 非同期で読み込み
const content = await readFile(filePath, "utf-8");

// 非同期で書き込み
await writeFile(filePath, content, "utf-8");

// 非同期でディレクトリ一覧取得
const files = await readdir(dirPath);
```

### 2. パスの安全性チェック

ユーザーが任意のパスを指定できる場合、セキュリティリスクがあります：

```typescript
import path from "path";

// 安全なパスかチェック
function isSafePath(filePath: string, baseDir: string): boolean {
  // 絶対パスに解決
  const resolvedPath = path.resolve(baseDir, filePath);
  const resolvedBase = path.resolve(baseDir);

  // baseDirの外に出ていないかチェック
  return resolvedPath.startsWith(resolvedBase);
}
```

### 3. エラーハンドリング

ファイル操作は失敗する可能性が高いため、適切なエラー処理が必須：

```typescript
try {
  const content = await readFile(filePath, "utf-8");
  return content;
} catch (error) {
  if (error.code === "ENOENT") {
    return "エラー: ファイルが見つかりません";
  } else if (error.code === "EACCES") {
    return "エラー: 読み取り権限がありません";
  } else {
    return `エラー: ${error.message}`;
  }
}
```

### 4. ツール定義の拡充

ファイル操作ツールには詳細な説明が重要：

```typescript
{
  name: "read_file",
  description: "指定されたパスのファイルの内容を読み取ります。" +
               "相対パスまたは絶対パスを指定できます。",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "読み取るファイルのパス（例: './data.txt', '/tmp/file.json'）"
      }
    },
    required: ["path"]
  }
}
```

## 💻 コードの構造

```
step-03-file-operations/
├── README.md          # このファイル
├── package.json       # 依存関係
├── .env.example       # 環境変数のサンプル
├── agent.ts           # メインの実装
└── workspace/         # テスト用ワークスペース
    ├── example.txt
    └── data.json
```

## 🚀 実行方法

### 1. セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env ファイルにAPIキーを記入
```

### 2. 実行

```bash
npx tsx agent.ts
```

### 3. 試してみよう

以下のようなタスクを試してみてください：

- "workspaceディレクトリのファイル一覧を表示して"
- "workspace/example.txtを読んで内容を教えて"
- "workspace/output.txtに'Hello, AI!'と書き込んで"
- "workspace/example.txtを読んで、大文字に変換してworkspace/upper.txtに保存して"
- "workspace/data.jsonを読んでパースして、pretty printしてworkspace/formatted.jsonに保存して"

## 📊 動作例

```
$ npx tsx agent.ts

タスクを入力してください: workspace/test.txtに"Hello from AI"と書いて、その後読み込んで内容を確認して

--- イテレーション 1 ---
🤖 LLMの応答:
🔧 ツール使用: write_file
   入力: {"path":"workspace/test.txt","content":"Hello from AI"}
   結果: ✅ ファイルを書き込みました: workspace/test.txt

--- イテレーション 2 ---
🤖 LLMの応答:
🔧 ツール使用: read_file
   入力: {"path":"workspace/test.txt"}
   結果: Hello from AI

--- イテレーション 3 ---
🤖 LLMの応答:
ファイルworkspace/test.txtに"Hello from AI"と書き込み、
確認したところ、正しく保存されていることを確認しました。

✅ タスク完了: workspace/test.txtに内容を書き込み、確認しました
```

## 🔍 コードの詳細解説

### ファイル操作ツールの実装

```typescript
import { readFile, writeFile, readdir } from "fs/promises";
import path from "path";

// ベースディレクトリ（これより外には出られない）
const WORKSPACE = path.join(process.cwd(), "workspace");

async function executeTool(toolName: string, input: any): Promise<string> {
  switch (toolName) {
    case "read_file": {
      const filePath = path.resolve(WORKSPACE, input.path);

      // セキュリティチェック
      if (!filePath.startsWith(WORKSPACE)) {
        return "エラー: ワークスペース外のファイルにはアクセスできません";
      }

      try {
        const content = await readFile(filePath, "utf-8");
        return content;
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return `エラー: ファイルが見つかりません: ${input.path}`;
        }
        return `エラー: ${error.message}`;
      }
    }

    case "write_file": {
      const filePath = path.resolve(WORKSPACE, input.path);

      if (!filePath.startsWith(WORKSPACE)) {
        return "エラー: ワークスペース外のファイルには書き込めません";
      }

      try {
        await writeFile(filePath, input.content, "utf-8");
        return `✅ ファイルを書き込みました: ${input.path}`;
      } catch (error: any) {
        return `エラー: ${error.message}`;
      }
    }

    case "list_files": {
      const dirPath = input.path
        ? path.resolve(WORKSPACE, input.path)
        : WORKSPACE;

      if (!dirPath.startsWith(WORKSPACE)) {
        return "エラー: ワークスペース外にはアクセスできません";
      }

      try {
        const files = await readdir(dirPath);
        return files.join("\n");
      } catch (error: any) {
        return `エラー: ${error.message}`;
      }
    }

    // ... 他のツール
  }
}
```

### ツール定義

```typescript
const TOOLS = [
  {
    name: "read_file",
    description: "指定されたパスのファイルの内容を読み取ります。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "読み取るファイルのパス（workspace/からの相対パス）",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "指定されたパスにコンテンツを書き込みます。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "書き込むファイルのパス（workspace/からの相対パス）",
        },
        content: {
          type: "string",
          description: "ファイルに書き込む内容",
        },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "指定されたディレクトリ内のファイルとディレクトリの一覧を取得します。",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "一覧を取得するディレクトリのパス（省略時はworkspace/）",
        },
      },
    },
  },
  // ... calculator, get_current_time, attempt_completion
];
```

## 🎨 セキュリティのベストプラクティス

### ✅ DO（推奨）

1. **ワークスペースを制限**
   - ファイルアクセスを特定のディレクトリに制限
   - `path.resolve()`と`startsWith()`でパスを検証

2. **エラーメッセージを詳細に**
   - ファイルが見つからない、権限がない、など具体的に
   - LLMがエラーから学習できるように

3. **ファイルサイズ制限**
   - 巨大なファイルの読み込みを防ぐ
   - 実装例: ファイルサイズを事前チェック

### ❌ DON'T（非推奨）

1. **任意のパスへのアクセスを許可しない**
   - `/etc/passwd`などシステムファイルへのアクセスを防ぐ

2. **同期的なファイル操作を避ける**
   - `readFileSync()`ではなく`readFile()`を使う

3. **バイナリファイルを不用意に読まない**
   - テキストファイルのみに限定するか、エンコーディングを明示

## 🤔 よくある質問

### Q1: 大きなファイルを読むとメモリが足りなくなる？

A: はい。このシンプルな実装では、ファイル全体をメモリに読み込みます。本番環境では、ストリーミング読み込みやファイルサイズ制限が必要です。

### Q2: ディレクトリ作成は？

A: このステップでは扱いませんが、`mkdir`ツールを追加することで可能です。`fs/promises`の`mkdir()`を使います。

### Q3: 他の形式（JSON、YAML等）の読み書きは？

A: 基本的にはテキストとして読み書きし、LLMにパース・生成させます。必要に応じて専用ツールを追加することもできます。

## 🎓 次のステップへ

このステップでは、ファイル操作ツールを追加しました。しかし、会話が長くなるとトークン制限に引っかかります。次のステップでは、**コンテキスト管理**を実装して、長い会話にも対応します。

→ [Step 4: コンテキスト管理](../step-04-context-management/)

## 📚 参考リンク

- [Node.js fs/promises API](https://nodejs.org/api/fs.html#promises-api)
- [Path Module](https://nodejs.org/api/path.html)
- [File System Security](https://nodejs.org/en/learn/security/security-best-practices)

---

最終更新: 2026-01-01

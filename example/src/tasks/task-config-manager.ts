/**
 * Task Configuration Manager
 * タスク設定のロードと管理
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { TaskConfig, TaskConfigFile, TaskPhase, CORE_TOOLS } from "./types";

const DEFAULT_CONFIG_PATH = "./tasks.json";

export class TaskConfigManager {
  private configs: Map<string, TaskConfig> = new Map();
  private taskTools: Map<string, string[]> = new Map(); // タスク固有ツールの登録

  /**
   * 設定ファイルからロード
   */
  async loadFromFile(configPath: string = DEFAULT_CONFIG_PATH): Promise<void> {
    if (!existsSync(configPath)) {
      console.warn(`Task config file not found: ${configPath}, using defaults`);
      this.loadDefaults();
      return;
    }

    try {
      const content = await readFile(configPath, "utf-8");
      const configFile: TaskConfigFile = JSON.parse(content);
      this.loadFromObject(configFile);
    } catch (error) {
      console.error(`Failed to load task config: ${error}`);
      this.loadDefaults();
    }
  }

  /**
   * オブジェクトからロード
   */
  loadFromObject(configFile: TaskConfigFile): void {
    this.configs.clear();
    for (const [name, config] of Object.entries(configFile.tasks)) {
      this.validateConfig(name, config);
      this.configs.set(name, { ...config, name });
    }
  }

  /**
   * デフォルト設定をロード
   */
  loadDefaults(): void {
    this.configs.clear();
    for (const config of DEFAULT_TASK_CONFIGS) {
      this.configs.set(config.name, config);
    }
  }

  /**
   * 設定を検証
   */
  private validateConfig(name: string, config: TaskConfig): void {
    // コアツールの検証
    for (const tool of config.enabledCoreTools) {
      if (!CORE_TOOLS.includes(tool as (typeof CORE_TOOLS)[number])) {
        console.warn(`Unknown core tool '${tool}' in task '${name}'`);
      }
    }
  }

  /**
   * タスク固有ツールを登録
   */
  registerTaskTools(taskName: string, toolNames: string[]): void {
    this.taskTools.set(taskName, toolNames);
  }

  /**
   * タスク設定を取得
   */
  getConfig(taskName: string): TaskConfig | undefined {
    return this.configs.get(taskName);
  }

  /**
   * 全タスク名を取得
   */
  getTaskNames(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * タスクの有効ツール一覧を取得
   */
  getEnabledTools(taskName: string, phaseName?: string): string[] {
    const config = this.configs.get(taskName);
    if (!config) {
      return [];
    }

    // フェーズ固有のツール設定があればそれを使用
    if (phaseName && config.phases) {
      const phase = config.phases.find((p) => p.name === phaseName);
      if (phase?.enabledTools) {
        return phase.enabledTools;
      }
    }

    // デフォルトはコアツール + タスク固有ツール
    const taskSpecificTools = this.taskTools.get(taskName) ?? [];
    const enabledTaskTools = config.enabledTaskTools.filter((t) =>
      taskSpecificTools.includes(t)
    );

    return [...config.enabledCoreTools, ...enabledTaskTools];
  }

  /**
   * タスクのシステムプロンプトを取得
   */
  getSystemPrompt(taskName: string, phaseName?: string): string {
    const config = this.configs.get(taskName);
    if (!config) {
      return "";
    }

    let prompt = config.systemPrompt;

    // フェーズ固有のプロンプトを追加
    if (phaseName && config.phases) {
      const phase = config.phases.find((p) => p.name === phaseName);
      if (phase?.systemPrompt) {
        prompt += `\n\n## 現在のフェーズ: ${phase.name}\n${phase.systemPrompt}`;
      }
    }

    // 完了条件を追加
    if (config.completionCriteria.length > 0) {
      prompt += `\n\n## 完了条件\n${config.completionCriteria.map((c) => `- ${c}`).join("\n")}`;
    }

    return prompt;
  }

  /**
   * フェーズ情報を取得
   */
  getPhase(taskName: string, phaseName: string): TaskPhase | undefined {
    const config = this.configs.get(taskName);
    return config?.phases?.find((p) => p.name === phaseName);
  }

  /**
   * 次のフェーズを取得
   */
  getNextPhase(taskName: string, currentPhaseName: string): TaskPhase | undefined {
    const config = this.configs.get(taskName);
    if (!config?.phases) {
      return undefined;
    }

    const currentIndex = config.phases.findIndex((p) => p.name === currentPhaseName);
    if (currentIndex === -1 || currentIndex >= config.phases.length - 1) {
      return undefined;
    }

    return config.phases[currentIndex + 1];
  }

  /**
   * 最初のフェーズを取得
   */
  getFirstPhase(taskName: string): TaskPhase | undefined {
    const config = this.configs.get(taskName);
    return config?.phases?.[0];
  }

  /**
   * タスクが存在するか確認
   */
  hasTask(taskName: string): boolean {
    return this.configs.has(taskName);
  }
}

/**
 * デフォルトのタスク設定
 */
const DEFAULT_TASK_CONFIGS: TaskConfig[] = [
  {
    name: "mulmo",
    displayName: "MulmoScript作成",
    description: "MulmoScript形式の動画スクリプトを作成",
    goal: "完成したMulmoScriptファイル",
    defaultMode: "implementation",
    systemPrompt: `あなたはMulmoScript作成の専門家です。

## MulmoScriptについて
- JSON形式の動画スクリプトフォーマット
- シーンごとにテキスト、画像、音声を定義
- ナレーションとビジュアルを組み合わせて動画を生成

## 作成手順
1. ユーザーの要望を理解
2. 全体構成を計画
3. 各シーンを詳細に作成
4. バリデーションで確認`,
    enabledCoreTools: ["read_file", "write_file", "list_files"],
    enabledTaskTools: ["validate_mulmo"],
    phases: [
      {
        name: "planning",
        description: "構成を計画",
        goal: "アウトラインの作成",
        systemPrompt: "まずユーザーの要望を確認し、動画の構成を計画してください。",
        requiresApproval: true,
        approvalPrompt: "この構成でよろしいですか？",
      },
      {
        name: "writing",
        description: "スクリプト作成",
        goal: "MulmoScriptファイルの完成",
        systemPrompt: "計画に基づいてMulmoScriptを作成してください。",
      },
      {
        name: "validation",
        description: "検証と修正",
        goal: "エラーのない完成品",
        systemPrompt: "作成したスクリプトを検証し、必要に応じて修正してください。",
        enabledTools: ["read_file", "write_file", "validate_mulmo"],
      },
    ],
    completionCriteria: [
      "MulmoScriptファイルが作成されている",
      "バリデーションエラーがない",
      "ユーザーの要望を満たしている",
    ],
  },
  {
    name: "codegen",
    displayName: "コード生成",
    description: "ユーザーの要望に基づいてコードを生成・修正",
    goal: "動作するコード",
    defaultMode: "implementation",
    systemPrompt: `あなたはコード生成の専門家です。

## 原則
- クリーンで読みやすいコードを書く
- 適切なエラーハンドリングを含める
- 既存のコードスタイルに従う
- 必要に応じてテストを作成

## 手順
1. 要件を理解
2. 既存コードを確認
3. 実装
4. テストで確認`,
    enabledCoreTools: ["read_file", "write_file", "list_files", "shell"],
    enabledTaskTools: ["run_tests", "lint_code"],
    phases: [
      {
        name: "analysis",
        description: "要件分析",
        goal: "実装方針の決定",
        systemPrompt: "要件を分析し、実装方針を決定してください。",
        enabledTools: ["read_file", "list_files"],
      },
      {
        name: "implementation",
        description: "コード実装",
        goal: "コードの完成",
        systemPrompt: "方針に基づいてコードを実装してください。",
      },
      {
        name: "testing",
        description: "テストと修正",
        goal: "テスト通過",
        systemPrompt: "コードをテストし、問題があれば修正してください。",
        enabledTools: ["read_file", "write_file", "shell", "run_tests"],
      },
    ],
    completionCriteria: [
      "コードが作成されている",
      "構文エラーがない",
      "テストが通過している（該当する場合）",
    ],
  },
  {
    name: "document",
    displayName: "ドキュメント作成",
    description: "ドキュメントやREADMEを作成",
    goal: "完成したドキュメント",
    defaultMode: "planning",
    systemPrompt: `あなたはテクニカルライターです。

## 原則
- 明確で簡潔な文章
- 適切な構造化
- コード例を含める
- 対象読者を意識`,
    enabledCoreTools: ["read_file", "write_file", "list_files"],
    enabledTaskTools: [],
    completionCriteria: [
      "ドキュメントが作成されている",
      "必要な情報が含まれている",
    ],
  },
  {
    name: "analysis",
    displayName: "コード分析",
    description: "コードベースを分析し、レポートを作成",
    goal: "分析レポート",
    defaultMode: "exploration",
    systemPrompt: `あなたはコード分析の専門家です。

## 分析観点
- アーキテクチャ
- コード品質
- 潜在的な問題
- 改善提案`,
    enabledCoreTools: ["read_file", "list_files"],
    enabledTaskTools: [],
    completionCriteria: [
      "分析が完了している",
      "レポートが作成されている",
    ],
  },
];

// シングルトンインスタンス
let instance: TaskConfigManager | null = null;

export function getTaskConfigManager(): TaskConfigManager {
  if (!instance) {
    instance = new TaskConfigManager();
    instance.loadDefaults();
  }
  return instance;
}

export function resetTaskConfigManager(): void {
  instance = null;
}

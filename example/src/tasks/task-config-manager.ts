/**
 * Task Configuration Manager
 * タスク設定のロードと管理
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { TaskConfig, TaskConfigFile, TaskPhase, TaskModule, CORE_TOOLS } from "./types";
import { ToolDefinition } from "../tools/types";
import { taskModules } from "./definitions";

const DEFAULT_CONFIG_PATH = "./tasks.json";

export class TaskConfigManager {
  private configs: Map<string, TaskConfig> = new Map();
  private taskTools: Map<string, ToolDefinition[]> = new Map();

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
   * デフォルト設定をロード（TaskModuleから）
   */
  loadDefaults(): void {
    this.configs.clear();
    this.taskTools.clear();

    for (const module of taskModules) {
      this.registerTaskModule(module);
    }
  }

  /**
   * タスクモジュールを登録
   */
  registerTaskModule(module: TaskModule): void {
    this.validateConfig(module.config.name, module.config);
    this.configs.set(module.config.name, module.config);
    this.taskTools.set(module.config.name, module.tools);
  }

  /**
   * 設定を検証
   */
  private validateConfig(name: string, config: TaskConfig): void {
    for (const tool of config.enabledCoreTools) {
      if (!CORE_TOOLS.includes(tool as (typeof CORE_TOOLS)[number])) {
        console.warn(`Unknown core tool '${tool}' in task '${name}'`);
      }
    }
  }

  /**
   * タスク固有ツールを取得
   */
  getTaskTools(taskName: string): ToolDefinition[] {
    return this.taskTools.get(taskName) ?? [];
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

    // コアツール + タスク固有ツール
    return [...config.enabledCoreTools, ...config.enabledTaskTools];
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

/**
 * Agent Context - Manages Mode and History
 */

import { ConversationHistory } from "../history";
import { ContentBlock, ToolSchema } from "../llm";
import { getToolDefinitions } from "../tools";
import { AgentMode, ModeConfig, ContextConfig, MODE_CONFIGS, DEFAULT_MODE } from "./types";

export class AgentContext {
  readonly history: ConversationHistory;
  private currentMode: AgentMode;

  constructor(config: ContextConfig = {}) {
    this.history = new ConversationHistory();
    this.currentMode = config.initialMode ?? DEFAULT_MODE;
  }

  // ========== Mode Management ==========

  getMode(): AgentMode {
    return this.currentMode;
  }

  getModeConfig(): ModeConfig {
    return MODE_CONFIGS[this.currentMode];
  }

  getSystemPrompt(): string {
    return this.getModeConfig().systemPrompt;
  }

  setMode(mode: AgentMode): void {
    this.currentMode = mode;
  }

  // ========== Tool Management ==========

  getEnabledTools(): ToolSchema[] {
    const enabledToolNames = this.getModeConfig().enabledTools;
    const allTools = getToolDefinitions();
    return allTools.filter((tool) => enabledToolNames.includes(tool.name));
  }

  isToolEnabled(toolName: string): boolean {
    return this.getModeConfig().enabledTools.includes(toolName);
  }

  // ========== Constraints ==========

  canWriteFiles(): boolean {
    return this.getModeConfig().allowFileWrite;
  }

  getMaxIterations(): number {
    return this.getModeConfig().maxIterations;
  }

  // ========== History Management ==========

  addUserMessage(content: string) {
    return this.history.addUserMessage(content);
  }

  addAssistantMessage(content: ContentBlock[]) {
    return this.history.addAssistantMessage(content);
  }

  addToolResult(toolName: string, toolUseId: string, result: string) {
    return this.history.addToolResult(toolName, toolUseId, result);
  }

  addTaskCompletion(result: string) {
    return this.history.addTaskCompletion(result);
  }

  addError(error: string) {
    return this.history.addError(error);
  }

  getMessages() {
    return this.history.getAll();
  }

  toBaseMessages() {
    return this.history.toBaseMessages();
  }

  // ========== Reset ==========

  reset(): void {
    this.history.clear();
    this.currentMode = DEFAULT_MODE;
  }
}

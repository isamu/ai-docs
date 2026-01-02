# AI Agent Framework

**Production-ready AI Agent with modular architecture, session management, and task-driven workflows.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Claude API](https://img.shields.io/badge/Claude-claude--sonnet--4-purple.svg)](https://www.anthropic.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```
[conversation] > 宇宙旅行の動画スクリプトを作って

🤖 LLMの応答:
MulmoScriptを作成しますね！まずヒアリングさせてください...

🔧 ツール使用: start_session
🔧 ツール使用: createBeatsOnMulmoScript

✅ MulmoScript作成完了！
📄 ファイル: space_travel_1704067200.mulmo.json
```

---

## Features

### Core Architecture

| Feature | Description |
|---------|-------------|
| **Mode Stack** | Push/pop execution modes (conversation → planning → implementation) |
| **Session Management** | Suspend/resume multiple concurrent tasks |
| **Task Pipelines** | Define multi-phase workflows with phase-specific tools |
| **History Isolation** | Each session maintains its own conversation history |
| **LLM Abstraction** | Swap providers (Anthropic, OpenAI, etc.) without code changes |

### Built-in Tools

```
read_file      Write files to workspace
write_file     Write files (with task-aware guards)
list_files     List directory contents
calculator     Safe mathematical expressions
get_current_time   Current timestamp
```

### Task System

Pre-configured task types with specialized workflows:

- **mulmo** - MulmoScript video script creation (3 phases: planning → writing → validation)
- **codegen** - Code generation (analysis → implementation → testing)
- **document** - Documentation writing
- **analysis** - Codebase exploration

---

## Quick Start

### Installation

```bash
git clone https://github.com/yourname/ai-agent-example.git
cd ai-agent-example
npm install
```

### Configuration

```bash
cp .env.example .env
# Add your ANTHROPIC_API_KEY
```

### Run

```bash
npm start
```

### Basic Usage

```
[conversation] > ファイル一覧を見せて
🔧 ツール使用: list_files
📁 workspace/
  - example.txt
  - output/

[conversation] > /mode implementation
[implementation] > 新しい機能を実装して
```

### Session Commands

```
[conversation] > 動画スクリプトを作って
🔧 ツール使用: start_session (task_type: mulmo)

[implementation:mulmo] > 一旦中断して別の作業をしたい
🔧 ツール使用: suspend_session

[conversation] > list_sessions
📋 中断中のセッション:
  - abc123: mulmo (suspended)

[conversation] > 再開して
🔧 ツール使用: resume_session

[implementation:mulmo] > 続きをお願い
```

---

## Architecture

```
src/
├── agent.ts                 # Main entry point
├── context/
│   ├── agent-context.ts     # Central state management
│   ├── mode-manager.ts      # Mode stack operations
│   ├── session-manager.ts   # Session lifecycle
│   └── types.ts             # Type definitions
├── tasks/
│   ├── definitions/         # Task modules (config + tools)
│   │   ├── mulmo.ts         # MulmoScript task
│   │   ├── codegen.ts       # Code generation task
│   │   └── ...
│   ├── types.ts             # TaskModule, TaskConfig types
│   └── task-config-manager.ts
├── tools/
│   ├── types.ts             # ToolDefinition interface
│   ├── index.ts             # Tool registry
│   └── *.ts                 # Individual tools
├── llm/
│   ├── types.ts             # LLMProvider interface
│   └── anthropic.ts         # Claude implementation
└── history/
    └── conversation-history.ts
```

---

## Developer Guide

### Adding a New Tool

```typescript
// src/tools/my-tool.ts
import { defineTool } from "./types";

export const myTool = defineTool({
  definition: {
    name: "my_tool",
    description: "Does something cool",
    inputSchema: {
      type: "object",
      properties: {
        param: { type: "string", description: "Input parameter" }
      },
      required: ["param"]
    }
  },

  // context is optional - use when session info is needed
  execute: async (input, context) => {
    const session = context?.getActiveSession();
    return `Result: ${input.param}`;
  }
});
```

### Adding a New Task

```typescript
// src/tasks/definitions/my-task.ts
import { defineTask, defineTool } from "../types";

const myCustomTool = defineTool({
  definition: { name: "custom_action", ... },
  execute: async (input, context) => { ... }
});

export const myTaskModule = defineTask({
  config: {
    name: "my-task",
    displayName: "My Task",
    description: "What this task does",
    goal: "Expected output",
    defaultMode: "implementation",

    systemPrompt: `You are an expert at...`,

    enabledCoreTools: ["read_file", "write_file"],
    enabledTaskTools: ["custom_action"],

    phases: [
      {
        name: "planning",
        description: "Plan the work",
        goal: "Clear plan",
        requiresApproval: true,
        approvalPrompt: "Proceed with this plan?",
        enabledTools: ["read_file"]  // Restricted tools
      },
      {
        name: "execution",
        description: "Do the work",
        goal: "Completed output"
        // Uses all enabledCoreTools + enabledTaskTools
      }
    ],

    completionCriteria: [
      "Output file created",
      "Validation passed"
    ]
  },

  tools: [myCustomTool]
});
```

### Task-Aware Tool Guards

Prevent LLM from using wrong tools:

```typescript
// In write_file tool
const TASK_RESTRICTIONS = {
  mulmo: {
    message: "Use createBeatsOnMulmoScript instead",
    suggestedTool: "createBeatsOnMulmoScript"
  }
};

execute: async (input, context) => {
  const session = context?.getActiveSession();
  if (session && TASK_RESTRICTIONS[session.taskType]) {
    return `⚠️ ${TASK_RESTRICTIONS[session.taskType].message}`;
  }
  // Normal execution...
}
```

---

## Why This Architecture?

### Mode Stack > Simple State

```typescript
// Traditional: loses context
agent.mode = "implementation";
// ...later...
agent.mode = "conversation"; // What was I doing?

// This framework: maintains context
context.pushMode("implementation", sessionId);
context.pushMode("review"); // Temporary switch
context.popMode(); // Back to implementation
context.popToBase(); // Clean exit
```

### Session Isolation

Each task gets its own conversation history. No cross-contamination.

```typescript
// Session A: "Build a REST API"
// Session B: "Write unit tests"
// Suspend A, work on B, resume A - context preserved
```

### Phase-Based Tool Control

LLMs can be... creative. Phases prevent premature actions:

```typescript
phases: [
  { name: "planning", enabledTools: ["read_file"] },      // Can only read
  { name: "implementation", enabledTools: ["write_file"] } // Now can write
]
```

---

## Testing

```bash
# Run all tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

265 tests covering:
- Context management
- Session lifecycle
- Mode stack operations
- Tool execution
- Task configuration

---

## Roadmap

### In Development

- [ ] **Parallel Tool Execution** - Run independent tools concurrently
- [ ] **Streaming Tool Results** - Progressive output for long operations
- [ ] **Memory/RAG Integration** - Long-term context persistence

### Planned

- [ ] **Multi-Agent Orchestration** - Spawn sub-agents for complex tasks
- [ ] **Plugin System** - Hot-reload tools and tasks
- [ ] **Web UI** - Visual session management
- [ ] **OpenAI Provider** - GPT-4 support
- [ ] **Local LLM Support** - Ollama integration

### Exploring

- [ ] **Auto-Recovery** - Resume from failures
- [ ] **Cost Tracking** - Token usage per session
- [ ] **Approval Workflows** - Human-in-the-loop for sensitive operations

---

## Related Projects

- [mulmocast](https://github.com/snakajima/mulmocast) - Video script format used in mulmo task
- [Claude API](https://docs.anthropic.com/) - Anthropic's Claude API

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests (`npm test`)
4. Commit your changes
5. Push to the branch
6. Open a Pull Request

See [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) for detailed development documentation.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with Claude API and TypeScript</sub>
</p>

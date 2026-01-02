/**
 * TaskConfigManager Unit Tests
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import {
  TaskConfigManager,
  getTaskConfigManager,
} from "../src/tasks/task-config-manager";
import { AgentContext } from "../src/context";
import {
  advancePhaseTool,
  getPhaseStatusTool,
  addArtifactTool,
  listTaskTypesTool,
  startSessionTool,
} from "../src/tools/session";

describe("TaskConfigManager", () => {
  let manager: TaskConfigManager;

  beforeEach(() => {
    manager = new TaskConfigManager();
    manager.loadDefaults();
  });

  describe("getConfig", () => {
    it("should return config for mulmo task", () => {
      const config = manager.getConfig("mulmo");
      assert.ok(config);
      assert.strictEqual(config.name, "mulmo");
      assert.strictEqual(config.displayName, "MulmoScript作成");
    });

    it("should return config for codegen task", () => {
      const config = manager.getConfig("codegen");
      assert.ok(config);
      assert.strictEqual(config.name, "codegen");
    });

    it("should return config for document task", () => {
      const config = manager.getConfig("document");
      assert.ok(config);
      assert.strictEqual(config.defaultMode, "planning");
    });

    it("should return config for analysis task", () => {
      const config = manager.getConfig("analysis");
      assert.ok(config);
      assert.strictEqual(config.defaultMode, "exploration");
    });

    it("should return undefined for unknown task", () => {
      const config = manager.getConfig("unknown");
      assert.strictEqual(config, undefined);
    });
  });

  describe("getTaskNames", () => {
    it("should return all task names", () => {
      const names = manager.getTaskNames();
      assert.ok(names.includes("mulmo"));
      assert.ok(names.includes("codegen"));
      assert.ok(names.includes("document"));
      assert.ok(names.includes("analysis"));
    });
  });

  describe("getEnabledTools", () => {
    it("should return enabled tools for task", () => {
      const tools = manager.getEnabledTools("mulmo");
      assert.ok(tools.includes("read_file"));
      // mulmoタスクでは write_file の代わりに createBeatsOnMulmoScript を使用
      assert.ok(tools.includes("createBeatsOnMulmoScript"));
    });

    it("should return empty array for unknown task", () => {
      const tools = manager.getEnabledTools("unknown");
      assert.deepStrictEqual(tools, []);
    });
  });

  describe("getSystemPrompt", () => {
    it("should return system prompt for task", () => {
      const prompt = manager.getSystemPrompt("mulmo");
      assert.ok(prompt.includes("MulmoScript"));
    });

    it("should return empty string for unknown task", () => {
      const prompt = manager.getSystemPrompt("unknown");
      assert.strictEqual(prompt, "");
    });
  });

  describe("phases", () => {
    it("should have phases for mulmo task", () => {
      const config = manager.getConfig("mulmo");
      assert.ok(config?.phases);
      assert.ok(config.phases.length > 0);
    });

    it("should get first phase", () => {
      const phase = manager.getFirstPhase("mulmo");
      assert.ok(phase);
      assert.strictEqual(phase.name, "planning");
    });

    it("should get phase by name", () => {
      const phase = manager.getPhase("mulmo", "writing");
      assert.ok(phase);
      assert.strictEqual(phase.name, "writing");
    });

    it("should get next phase", () => {
      const nextPhase = manager.getNextPhase("mulmo", "planning");
      assert.ok(nextPhase);
      assert.strictEqual(nextPhase.name, "writing");
    });

    it("should return undefined for last phase next", () => {
      const nextPhase = manager.getNextPhase("mulmo", "validation");
      assert.strictEqual(nextPhase, undefined);
    });
  });

  describe("singleton", () => {
    it("should return same instance", () => {
      const instance1 = getTaskConfigManager();
      const instance2 = getTaskConfigManager();
      assert.strictEqual(instance1, instance2);
    });
  });
});

describe("Phase Management Tools", () => {
  let context: AgentContext;

  beforeEach(() => {
    context = new AgentContext();
  });

  describe("advance_phase", () => {
    it("should have correct definition", () => {
      assert.strictEqual(advancePhaseTool.definition.name, "advance_phase");
      assert.ok(advancePhaseTool.definition.description.includes("次のフェーズ"));
    });

    it("should return error when no active session", async () => {
      const result = await advancePhaseTool.execute(
        { phase_summary: "完了" },
        context
      );
      assert.ok(result.includes("エラー"));
      assert.ok(result.includes("アクティブなセッションがありません"));
    });

    it("should advance to next phase", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      const result = await advancePhaseTool.execute(
        { phase_summary: "計画完了" },
        context
      );

      // mulmo planning requires approval
      assert.ok(result.includes("planning"));
      assert.ok(result.includes("完了"));
    });

    it("should update session state when advancing", async () => {
      // Use codegen which doesn't require approval for first phase
      await startSessionTool.execute(
        { task_type: "codegen", description: "test" },
        context
      );

      const result = await advancePhaseTool.execute({ phase_summary: "分析完了" }, context);

      assert.ok(result.includes("フェーズ完了"));

      const session = context.getActiveSession();
      const state = session?.state as {
        currentPhase: string;
        phaseIndex: number;
        phaseHistory: string[];
      };
      assert.strictEqual(state.currentPhase, "implementation");
      assert.strictEqual(state.phaseIndex, 1);
      assert.deepStrictEqual(state.phaseHistory, ["analysis", "implementation"]);
    });

    it("should indicate when at final phase", async () => {
      // Use codegen which doesn't require approval
      await startSessionTool.execute(
        { task_type: "codegen", description: "test" },
        context
      );

      // Advance through all phases: analysis -> implementation -> testing
      await advancePhaseTool.execute({ phase_summary: "1" }, context);
      await advancePhaseTool.execute({ phase_summary: "2" }, context);
      const result = await advancePhaseTool.execute(
        { phase_summary: "3" },
        context
      );

      assert.ok(result.includes("最終フェーズ"));
      assert.ok(result.includes("complete_session"));
    });
  });

  describe("get_phase_status", () => {
    it("should have correct definition", () => {
      assert.strictEqual(getPhaseStatusTool.definition.name, "get_phase_status");
    });

    it("should return error when no active session", async () => {
      const result = await getPhaseStatusTool.execute({}, context);
      assert.ok(result.includes("エラー"));
    });

    it("should show phase status", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "テスト動画" },
        context
      );

      const result = await getPhaseStatusTool.execute({}, context);

      assert.ok(result.includes("MulmoScript作成"));
      assert.ok(result.includes("テスト動画"));
      assert.ok(result.includes("planning"));
      assert.ok(result.includes("フェーズ履歴"));
    });

    it("should show artifacts when present", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );
      await addArtifactTool.execute({ path: "output/test.json" }, context);

      const result = await getPhaseStatusTool.execute({}, context);

      assert.ok(result.includes("成果物"));
      assert.ok(result.includes("output/test.json"));
    });
  });

  describe("add_artifact", () => {
    it("should have correct definition", () => {
      assert.strictEqual(addArtifactTool.definition.name, "add_artifact");
    });

    it("should return error when no active session", async () => {
      const result = await addArtifactTool.execute(
        { path: "file.txt" },
        context
      );
      assert.ok(result.includes("エラー"));
    });

    it("should add artifact to session state", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      const result = await addArtifactTool.execute(
        { path: "output/script.json" },
        context
      );

      assert.ok(result.includes("成果物を記録"));
      assert.ok(result.includes("output/script.json"));
    });

    it("should accumulate multiple artifacts", async () => {
      await startSessionTool.execute(
        { task_type: "mulmo", description: "test" },
        context
      );

      await addArtifactTool.execute({ path: "file1.json" }, context);
      await addArtifactTool.execute({ path: "file2.json" }, context);

      const session = context.getActiveSession();
      const state = session?.state as { artifacts: string[] };
      assert.strictEqual(state.artifacts.length, 2);
      assert.ok(state.artifacts.includes("file1.json"));
      assert.ok(state.artifacts.includes("file2.json"));
    });
  });

  describe("list_task_types", () => {
    it("should have correct definition", () => {
      assert.strictEqual(listTaskTypesTool.definition.name, "list_task_types");
    });

    it("should list all available task types", async () => {
      const result = await listTaskTypesTool.execute({}, context);

      assert.ok(result.includes("mulmo"));
      assert.ok(result.includes("codegen"));
      assert.ok(result.includes("document"));
      assert.ok(result.includes("analysis"));
      assert.ok(result.includes("フェーズ"));
    });
  });
});

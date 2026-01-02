/**
 * Task Definitions Index
 *
 * 全タスクモジュールをエクスポート
 * 新しいタスクを追加する場合はここにインポートを追加
 */

import { TaskModule } from "../types";
import { mulmoTaskModule } from "./mulmo";
import { codegenTaskModule } from "./codegen";
import { documentTaskModule } from "./document";
import { analysisTaskModule } from "./analysis";

// 全タスクモジュール
export const taskModules: TaskModule[] = [
  mulmoTaskModule,
  codegenTaskModule,
  documentTaskModule,
  analysisTaskModule,
];

// 個別エクスポート
export { mulmoTaskModule } from "./mulmo";
export { codegenTaskModule } from "./codegen";
export { documentTaskModule } from "./document";
export { analysisTaskModule } from "./analysis";

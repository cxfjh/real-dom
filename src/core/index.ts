/**
 * @module core
 * @description 核心模块统一导出
 * 汇聚响应式系统、依赖管理、表达式解析、DOM 处理和组件系统
 */
export { batchUpdater } from "./batch.ts";
export { DependencyManager } from "./dependency.ts";
export { expressionParser } from "./expression.ts";
export { createUpdateFn, processTextNode, processElement } from "./dom-processor.ts";
export { createRef } from "./ref.ts";
export { createReactive } from "./reactive.ts";
export { createComponent } from "./component.ts";

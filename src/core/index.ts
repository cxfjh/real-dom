/**
 * @module core
 * @description 核心模块统一导出（按依赖层级自底向上排列）
 */

// 基础设施
export { Dep } from "./dep.ts";          // 依赖追踪 — 整个响应式系统的基石
export { batch } from "./batch.ts";       // 批量异步更新 — DOM 更新调度器

// 响应式系统
export { ref } from "./ref.ts";          // 基本类型响应式
export { reactive } from "./reactive.ts"; // 对象/数组响应式
export { watch } from "./watch.ts";      // 响应式监听

// 编译系统
export { parser } from "./parser.ts";    // 表达式解析器
export { bind, bindText, compile } from "./compile.ts"; // DOM 模板编译

// 组件系统
export { comp } from "./comp.ts";        // 组件定义

import type { DirectiveHandler } from "../types";

/** 文本节点原始内容缓存（用于插值表达式的重复解析） */
export const nodeContentMap = new WeakMap<Node, string>();

/** 元素更新函数缓存（每个元素对应一个更新函数） */
export const elUpdateFns = new WeakMap<HTMLElement, Function>();

/** 元素依赖变量集合缓存 */
export const elDeps = new WeakMap<HTMLElement, Set<string>>();

/** 响应式对象 → 依赖管理器 映射表 */
export const depsMap = new WeakMap<object, import("../types/index.ts").Dependency>();

/** 当前活跃的更新函数栈（依赖收集时使用） */
export const activeFns: Function[] = [];

/** 已注册的指令处理器映射表 */
export const directives = new Map<string, DirectiveHandler>();

/** 组件模板片段缓存（组件名 → DocumentFragment） */
export const componentTemplates = new Map<string, DocumentFragment>();

/** 组件实例缓存（宿主元素 → 组件作用域） */
export const componentInstances = new WeakMap<HTMLElement, unknown>();

/** 待注入根作用域的 provide 数据队列 */
export const pendingProviders: [string, unknown][] = [];

/** onMounted 生命周期回调函数队列 */
export const mountedCallbacks: Function[] = [];

/** 空 src script 标签内联代码队列 */
export const inlineScripts: string[] = [];

import type { DepInterface, DirectiveFn, ReactiveInterface } from "../types";


/**
 * 元素依赖变量集合缓存
 */
export const elDeps = new WeakMap<HTMLElement, Set<string>>();


/**
 * 响应式对象依赖管理器映射表
 */
export const depMap = new WeakMap<object, DepInterface>();


/**
 * 当前活跃的更新函数栈
 */
export const activeFns: Function[] = [];


/**
 * 已注册的指令处理器映射表
 */
export const dirs = new Map<string, DirectiveFn>();


/**
 * 组件模板片段缓存
 */
export const domTpls = new Map<string, DocumentFragment>();


/**
 * 组件实例缓存
 */
export const cpInsts = new WeakMap<HTMLElement, unknown>();


/**
 * 待注入根作用域的 provide 数据队列
 */
export const pendProv: [string, unknown][] = [];


/**
 * onMounted 生命周期回调函数队列
 */
export const mountCbs: Function[] = [];


/**
 * 根作用域
 */
export let rootScope: ReactiveInterface | null = null;


/**
 * 设置根作用域
 *
 * @param scope - 新的根作用域实例
 */
export const setRootScope = (scope: ReactiveInterface): void => { rootScope = scope; };

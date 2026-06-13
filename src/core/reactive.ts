import type { ReactiveInterface } from "../types";
import { activeFns, depMap } from "../utils/shared.ts";
import { Dep } from "./dep.ts";


/**
 * 创建响应式代理对象
 *
 * @param target - 目标对象, 仅支持纯对象 `{}` 和数组 `[]`
 * @returns 响应式 Proxy 代理对象, 类型不兼容时返回原值
 */
export const reactive = (target: unknown): ReactiveInterface => {
    // 类型过滤
    if (typeof target !== "object" || target === null || target instanceof Date || target instanceof RegExp || target instanceof Function || target instanceof Map || target instanceof Set) {
        console.warn(`[reactive] 仅支持纯对象/数组类型, 当前类型: ${ typeof target } (${ (target as object)?.constructor?.name })`,);
        return target as ReactiveInterface;
    }

    // 防止重复代理
    const obj = target as ReactiveInterface;
    if (obj.__isReactiveProxy) return obj;
    if (obj.__isReactive) return (depMap.get(obj) as unknown as Record<string, unknown>)?.__proxy as ReactiveInterface || obj;

    // 保存原始对象引用并创建依赖管理器
    const original = obj;
    const dep = new Dep();
    depMap.set(original, dep);

    // 标记原始对象
    Object.defineProperties(original, {
        __isReactive: { value: true, enumerable: false, configurable: false },
        __raw: { value: original, enumerable: false, configurable: false },
    });

    /**
     * 数组变异方法代理
     *
     * @param arr - 需要代理变异方法的数组
     */
    const proxyArray = (arr: unknown[]): void => {
        // 创建以 Array.prototype 为原型的中间对象, 避免污染原始原型
        const arrayProto = Object.create(Array.prototype);

        ARR_MUT_METHODS.forEach(method => {
            (arrayProto as Record<string, Function>)[method] = function (this: unknown[], ...args: unknown[]) {
                // 保存当前暂停状态, 方法执行完毕后恢复
                const wasPaused = dep._paused;
                dep._paused = true;

                // 调用原始数组方法, 通过 apply 传入 this 和参数
                const result = (Array.prototype as unknown as Record<string, Function>)[method].apply(this, args);

                try {
                    // 新增元素自动转为响应式
                    if (["splice", "push", "unshift"].includes(method)) {
                        const items = method === "splice" ? args.slice(2) : args;
                        items.forEach(item => (typeof item === "object" && item !== null && !(item as ReactiveInterface).__isReactive) && reactive(item));
                    }

                    // 恢复通知状态, 若未被禁用则触发数组变更通知
                    dep._paused = wasPaused;
                    if (!dep._paused) dep.notify("array:mutate");
                    return result;
                } catch (e) {
                    // 异常时确保恢复通知状态, 避免状态残留导致后续通知永久禁用
                    console.error(`[reactive] 数组方法 ${ method } 执行失败:`, e);
                    dep._paused = wasPaused;
                    return result;
                }
            };
        });

        // 替换数组原型, 使后续的变异方法调用走代理逻辑
        Object.setPrototypeOf(arr, arrayProto);
    };

    // 深度递归处理嵌套对象
    if (Array.isArray(original)) {
        // 数组处理 先代理变异方法, 再递归处理每个元素
        proxyArray(original);
        original.forEach((item: unknown, index: number) => (typeof item === "object" && item !== null && !(item as ReactiveInterface).__isReactive) && (original[index] = reactive(item)));
    } else {
        // 普通对象处理 递归处理所有自有属性
        for (const key in original) {
            if (Object.prototype.hasOwnProperty.call(original, key)) {
                const value = original[key];
                if (typeof value === "object" && value !== null && !(value as ReactiveInterface).__isReactive) original[key] = reactive(value);
            }
        }
    }

    // 创建 Proxy 代理
    const proxy = new Proxy(original, {
        /**
         * get 拦截器 — 属性访问时收集依赖
         *
         * @param targetObj - 原始目标对象 (非代理)
         * @param prop - 访问的属性名或 Symbol
         * @param receiver - 代理对象本身, 用于原型链场景
         * @returns 属性值, 嵌套对象会自动转为响应式代理
         */
        get(targetObj: ReactiveInterface, prop: string | symbol, receiver: unknown): unknown {
            // 内置属性直接透传, 不收集依赖
            if (prop === "__proto__" || prop === "__isReactive" || prop === "__manual" || prop === "__isReactiveProxy") return Reflect.get(targetObj, prop, receiver);

            // 依赖收集将当前活跃的更新函数订阅到对应属性
            if (activeFns.length > 0) {
                const activeFn = activeFns[activeFns.length - 1];

                // 数组索引使用 index: 前缀, 确保与 set 拦截器的通知命名一致
                if (Array.isArray(targetObj) && /^\d+$/.test(String(prop))) dep.subscribe(activeFn, `index:${ String(prop) }`);
                else dep.subscribe(activeFn, prop as string);
            }

            const value = Reflect.get(targetObj, prop, receiver);

            // 惰性深层代理嵌套对象首次访问时才创建代理
            if (typeof value === "object" && value !== null && !(value as ReactiveInterface).__isReactive) return reactive(value);
            return value;
        },

        /**
         * set 拦截器 — 属性修改时通知依赖更新
         *
         * @param targetObj - 原始目标对象 (非代理)
         * @param prop - 修改的属性名或 Symbol
         * @param value - 新的属性值
         * @param receiver - 代理对象本身
         * @returns `true` 表示设置成功 (Proxy set 必须返回 true)
         */
        set(targetObj: ReactiveInterface, prop: string | symbol, value: unknown, receiver: unknown): boolean {
            // 禁止修改内置标记, 防止破坏响应式系统
            if (prop === "__isReactive" || prop === "__raw" || prop === "__isReactiveProxy") {
                console.warn(`[reactive] 禁止修改内置属性: ${ String(prop) }`);
                return true;
            }

            const oldValue = Reflect.get(targetObj, prop, receiver);

            // 新旧值比较: 严格相等或同为 NaN 时跳过更新
            if (oldValue === value || (Number.isNaN(oldValue as number) && Number.isNaN(value as number))) return true;

            // 数组长度变化特殊处理
            if (Array.isArray(targetObj) && prop === "length" && typeof value === "number") {
                const oldLength = targetObj.length;
                if (value === oldLength) return true;
                // 遍历被移除的索引范围, 逐一触发精准通知
                if (value < oldLength) for (let i = value; i < oldLength; i++) dep.notify(`index:${ i }`);
            }

            // 新值响应式化: 对象类型自动转为响应式代理
            const reactiveVal = typeof value === "object" && value !== null ? reactive(value) : value;
            const success = Reflect.set(targetObj, prop, reactiveVal, receiver);

            // 精准通知: 仅通知关心该属性的订阅者
            if (!dep._paused) {
                if (Array.isArray(targetObj) && /^\d+$/.test(prop as string)) dep.notify(`index:${ String(prop) }`);
                else dep.notify(prop as string);
            }

            return success;
        },

        /**
         * deleteProperty 拦截器 — 属性删除时通知依赖更新
         *
         * @param targetObj - 原始目标对象 (非代理)
         * @param prop - 删除的属性名或 Symbol
         * @returns `true` 表示删除成功, `false` 表示删除失败 (如内置属性保护)
         */
        deleteProperty(targetObj: ReactiveInterface, prop: string | symbol): boolean {
            // 禁止删除内置标记, 防止破坏响应式系统
            if (prop === "__isReactive" || prop === "__raw" || prop === "__isReactiveProxy") {
                console.warn(`[reactive] 禁止删除内置属性: ${ String(prop) }`);
                return false;
            }

            // 检查属性是否真实存在, 避免对不存在的属性触发通知
            const hadProp = Reflect.has(targetObj, prop);
            const deleteResult = Reflect.deleteProperty(targetObj, prop);

            // 删除成功且未被禁用通知时, 精准通知对应订阅者
            if (hadProp && deleteResult && !dep._paused) {
                if (Array.isArray(targetObj) && /^\d+$/.test(prop as string)) dep.notify(`index:${ String(prop) }`);
                else dep.notify(prop as string);
            }

            return deleteResult;
        },
    });

    // 标记代理对象
    Object.defineProperty(proxy, "__isReactiveProxy", { value: true, enumerable: false, configurable: false, });

    // 在依赖管理器中缓存代理对象引用
    (dep as unknown as Record<string, unknown>).__proxy = proxy;
    return proxy;
};


/**
 * 需要代理的数组变异方法列表
 */
const ARR_MUT_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] as const;

import type { ReactiveObject } from "../types";
import { activeFns, depsMap } from "../utils/shared.ts";
import { DependencyManager } from "./dependency.ts";

/** 需要代理的数组变异方法 */
const ARRAY_MUTATION_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"] as const;

/**
 * 创建响应式代理对象
 *
 * @param target - 目标对象（仅支持纯对象和数组）
 * @returns 响应式 Proxy 代理对象
 */
export const createReactive = (target: unknown): ReactiveObject => {
    // 类型过滤：仅支持纯对象和数组
    if (typeof target !== "object" || target === null || target instanceof Date || target instanceof RegExp || target instanceof Function || target instanceof Map || target instanceof Set) {
        console.warn(`[reactive] 仅支持纯对象/数组类型，当前类型: ${ typeof target } (${ (target as object)?.constructor?.name })`,);
        return target as ReactiveObject;
    }

    const targetObj = target as ReactiveObject;

    // 防止重复代理
    if (targetObj.__isReactiveProxy) return targetObj;
    if (targetObj.__isReactive) return (depsMap.get(targetObj) as unknown as Record<string, unknown>)?.__proxy as ReactiveObject || targetObj;

    // 原始对象
    const rawTarget = targetObj;
    const dep = new DependencyManager();
    depsMap.set(rawTarget, dep);

    // 标记原始对象（不可枚举，避免污染用户数据）
    Object.defineProperties(rawTarget, {
        __isReactive: { value: true, enumerable: false, configurable: false },
        __raw: { value: rawTarget, enumerable: false, configurable: false },
    });

    // 数组变异方法代理
    const optimizeArray = (arr: unknown[]): void => {
        const arrayProxyProto = Object.create(Array.prototype);

        ARRAY_MUTATION_METHODS.forEach(method => {
            (arrayProxyProto as Record<string, Function>)[method] = function (this: unknown[], ...args: unknown[]) {
                // 禁用通知
                const isNotificationDisabled = dep._notificationDisabled;
                dep._notificationDisabled = true;
                const originalResult = (Array.prototype as unknown as Record<string, Function>)[method].apply(this, args);

                try {
                    // 新增元素自动转为响应式
                    if (["splice", "push", "unshift"].includes(method)) {
                        const newItems = method === "splice" ? args.slice(2) : args;
                        newItems.forEach(item => {
                            if (typeof item === "object" && item !== null && !(item as ReactiveObject).__isReactive) createReactive(item);
                        });
                    }

                    // 恢复通知
                    dep._notificationDisabled = isNotificationDisabled;
                    if (!dep._notificationDisabled) dep.notify("array:mutate");
                    return originalResult;
                } catch (e) {
                    console.error(`[reactive] 数组方法 ${ method } 执行失败:`, e);
                    dep._notificationDisabled = isNotificationDisabled;
                    return originalResult;
                }
            };
        });

        Object.setPrototypeOf(arr, arrayProxyProto);
    };

    // 数组类型特殊处理
    if (Array.isArray(rawTarget)) {
        optimizeArray(rawTarget);
        rawTarget.forEach((item: unknown, index: number) => {
            if (typeof item === "object" && item !== null && !(item as ReactiveObject).__isReactive) rawTarget[index] = createReactive(item);
        });
    }

    // 创建 Proxy
    const proxy = new Proxy(rawTarget, {
        /**
         * get 拦截：属性访问时收集依赖
         */
        get(targetObj: ReactiveObject, prop: string | symbol, receiver: unknown): unknown {
            // 内置属性直接透传
            if (prop === "__proto__" || prop === "__isReactive" || prop === "__raw" || prop === "__isReactiveProxy") return Reflect.get(targetObj, prop, receiver);

            // 依赖收集
            if (activeFns.length > 0) {
                const activeFn = activeFns[activeFns.length - 1];
                if (Array.isArray(targetObj) && /^\d+$/.test(String(prop))) dep.subscribe(activeFn, `index:${ String(prop) }`);
                else dep.subscribe(activeFn, prop as string);
            }

            const value = Reflect.get(targetObj, prop, receiver);

            // 惰性深层代理：嵌套对象首次访问时创建代理
            if (typeof value === "object" && value !== null && !(value as ReactiveObject).__isReactive) return createReactive(value);
            return value;
        },

        /**
         * set 拦截：属性修改时通知依赖更新
         */
        set(targetObj: ReactiveObject, prop: string | symbol, value: unknown, receiver: unknown): boolean {
            // 禁止修改内置标记
            if (prop === "__isReactive" || prop === "__raw" || prop === "__isReactiveProxy") {
                console.warn(`[reactive] 禁止修改内置属性: ${ String(prop) }`);
                return true;
            }

            const oldValue = Reflect.get(targetObj, prop, receiver);

            // 新旧值严格相等或都为 NaN 时跳过
            if (oldValue === value || (Number.isNaN(oldValue as number) && Number.isNaN(value as number))) return true;

            // 数组长度变化特殊处理
            if (Array.isArray(targetObj) && prop === "length" && typeof value === "number") {
                const oldLength = targetObj.length;
                if (value === oldLength) return true;
                if (value < oldLength) {
                    for (let i = value; i < oldLength; i++) dep.notify(`index:${ i }`);
                }
            }

            // 新值响应式化
            const reactiveValue = typeof value === "object" && value !== null ? createReactive(value) : value;
            const setResult = Reflect.set(targetObj, prop, reactiveValue, receiver);

            // 精准通知
            if (!dep._notificationDisabled) {
                if (Array.isArray(targetObj) && /^\d+$/.test(prop as string)) dep.notify(`index:${ String(prop) }`);
                else dep.notify(prop as string);
            }

            return setResult;
        },

        /**
         * deleteProperty 拦截：属性删除时通知依赖更新
         */
        deleteProperty(targetObj: ReactiveObject, prop: string | symbol): boolean {
            if (prop === "__isReactive" || prop === "__raw" || prop === "__isReactiveProxy") {
                console.warn(`[reactive] 禁止删除内置属性: ${ String(prop) }`);
                return false;
            }

            const hadProp = Reflect.has(targetObj, prop);
            const deleteResult = Reflect.deleteProperty(targetObj, prop);

            if (hadProp && deleteResult && !dep._notificationDisabled) {
                if (Array.isArray(targetObj) && /^\d+$/.test(prop as string)) dep.notify(`index:${ String(prop) }`);
                else dep.notify(prop as string);
            }

            return deleteResult;
        },
    });

    // 标记代理对象
    Object.defineProperty(proxy, "__isReactiveProxy", { value: true, enumerable: false, configurable: false, });
    (dep as unknown as Record<string, unknown>).__proxy = proxy;

    return proxy;
};

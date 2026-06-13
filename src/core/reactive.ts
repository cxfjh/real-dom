import type { ReactiveInterface } from "../types";
import { activeFns, depMap } from "../utils/shared.ts";
import { Dep } from "./dep.ts";


/**
 * 创建响应式代理对象
 *
 * @param target - 目标对象, 仅支持纯对象 `{}` 和数组 `[]`
 */
export const reactive = (target: unknown): ReactiveInterface => {
    // 类型过滤
    if (typeof target !== "object" || target === null || target instanceof Date || target instanceof RegExp || target instanceof Function || target instanceof Map || target instanceof Set) {
        console.warn(`[reactive] 仅支持纯对象/数组类型, 当前类型: ${ typeof target } (${ (target as object)?.constructor?.name })`,);
        return target as ReactiveInterface;
    }

    // 去重检查
    const obj = target as ReactiveInterface;

    // 已是 Proxy 实例直接返回, 避免 Proxy 套 Proxy
    if (obj.__isReactiveProxy) return obj;

    // 已是 Ref 对象直接返回, 避免将 Ref 的 getter/setter 包裹在 Proxy 中
    if (obj.__isRef) return obj;

    // 已被标记为响应式原始对象从 depMap 取回缓存的 Proxy
    if (obj.__isReactive) return ((depMap.get(obj) as unknown as Record<string, unknown>)?.__proxy as ReactiveInterface) || obj;

    // 保存原始对象引用并创建依赖管理器
    const original = obj;
    const dep = new Dep();
    depMap.set(original, dep);

    // 标记原始对象, 不可枚举, 不可配置, 避免被外部遍历或删除
    Object.defineProperties(original, {
        __isReactive: { value: true, enumerable: false, configurable: false, },
        __raw: { value: original, enumerable: false, configurable: false, },
    });

    /**
     * 数组变异方法代理
     *
     * @param arr - 需要代理变异方法的数组 (已在 `reactive` 中标记过的原始数组)
     */
    const proxyArray = (arr: unknown[]): void => {
        // 创建原型链
        const arrayProto = Object.create(Array.prototype);

        ARR_MUT_METHODS.forEach(method => {
            // 在中间原型对象上定义方法覆盖
            (arrayProto as Record<string, Function>)[method] = function (this: unknown[], ...args: unknown[]) {
                // 保存当前暂停状态, 方法执行完毕后恢复
                const wasPaused = dep._paused;
                dep._paused = true;

                // 调用原始数组方法, 通过 apply 绑定 this 和参数
                const result = (Array.prototype as unknown as Record<string, Function>)[method].apply(this, args);

                try {
                    // 新增元素自动转为响应式
                    if (ARR_ADD_METHODS.has(method)) {
                        const items = method === "splice" ? args.slice(2) : args;
                        items.forEach(item => (typeof item === "object" && item !== null && !(item as ReactiveInterface).__isReactive) && reactive(item));
                    }

                    // 恢复通知状态, 若未被外部禁用则触发数组变更通知
                    dep._paused = wasPaused;
                    if (!dep._paused) dep.notify("array:mutate");
                    return result;
                } catch (e) {
                    console.error(`[reactive] 数组方法 ${ method } 执行失败:`, e);
                    dep._paused = wasPaused;
                    return result;
                }
            };
        });

        // 替换数组原型, 使后续变异方法调用走代理逻辑
        Object.setPrototypeOf(arr, arrayProto);
    };

    // 深度递归处理嵌套对象
    if (Array.isArray(original)) {
        proxyArray(original);
        original.forEach((item: unknown, index: number) => (typeof item === "object" && item !== null && !(item as ReactiveInterface).__isReactive) && (original[index] = reactive(item)));
    } else {
        // 普通对象递归处理所有自有属性
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
         * Get 陷阱 — 属性读取拦截
         *
         * @param targetObj - 原始目标对象
         * @param prop      - 被访问的属性名 (字符串或 Symbol)
         * @param receiver  - 触发访问的代理对象
         * @returns 属性值, 嵌套对象会被自动包装为响应式
         */
        get(targetObj: ReactiveInterface, prop: string | symbol, receiver: unknown,): unknown {
            // 内置属性跳过依赖收集, 直接返回原始值
            if (SKIP_GET_PROPS.has(prop as string)) return Reflect.get(targetObj, prop, receiver);

            // 依赖收集, 将当前 activeFn 订阅到对应 key 的 dep
            if (activeFns.length > 0) {
                const activeFn = activeFns[activeFns.length - 1];
                if (Array.isArray(targetObj) && /^\d+$/.test(String(prop))) dep.subscribe(activeFn, `index:${ String(prop) }`);
                else dep.subscribe(activeFn, prop as string);
            }

            // 通过 Reflect 获取原始值, 保持正确的 this 绑定
            const value = Reflect.get(targetObj, prop, receiver);

            // 惰性深层代理, 值是非响应式对象时递归包装
            if (typeof value === "object" && value !== null && !(value as ReactiveInterface).__isReactive) return reactive(value);
            return value;
        },

        /**
         * Set 陷阱 — 属性写入拦截
         *
         * @param targetObj - 原始目标对象
         * @param prop      - 被修改的属性名
         * @param value     - 新值
         * @param receiver  - 触发写入的代理对象
         * @returns 操作是否成功, 始终返回 `true` (失败时在内部 warn)
         */
        set(targetObj: ReactiveInterface, prop: string | symbol, value: unknown, receiver: unknown,): boolean {
            // 禁止修改内置标记属性
            if (SKIP_SET_PROPS.has(prop as string)) {
                console.warn(`[reactive] 禁止修改内置属性: ${ String(prop) }`);
                return true;
            }

            // 获取旧值, 相同则跳过通知
            const oldValue = Reflect.get(targetObj, prop, receiver);
            if (oldValue === value || (Number.isNaN(oldValue as number) && Number.isNaN(value as number))) return true;

            // 数组 length 缩小, 通知被删除的索引位置
            if (Array.isArray(targetObj) && prop === "length" && typeof value === "number") {
                const oldLength = targetObj.length;
                if (value === oldLength) return true;
                if (value < oldLength) for (let i = value; i < oldLength; i++) dep.notify(`index:${ i }`);
            }

            // 新值若是对象, 自动转为响应式再写入
            const reactiveVal = typeof value === "object" && value !== null ? reactive(value) : value;
            const success = Reflect.set(targetObj, prop, reactiveVal, receiver);

            // 通知订阅者
            if (!dep._paused) {
                if (Array.isArray(targetObj) && /^\d+$/.test(prop as string)) dep.notify(`index:${ String(prop) }`);
                else dep.notify(prop as string);
            }

            return success;
        },

        /**
         * DeleteProperty 陷阱 — 属性删除拦截
         *
         * @param targetObj - 原始目标对象
         * @param prop      - 被删除的属性名
         * @returns 删除是否成功; 内置属性返回 `false`
         */
        deleteProperty(targetObj: ReactiveInterface, prop: string | symbol,): boolean {
            // 禁止删除内置标记属性
            if (SKIP_DEL_PROPS.has(prop as string)) {
                console.warn(`[reactive] 禁止删除内置属性: ${ String(prop) }`);
                return false;
            }

            const hadProp = Reflect.has(targetObj, prop);
            const deleteResult = Reflect.deleteProperty(targetObj, prop);

            // 删除成功 + 属性原本存在 + 通知未暂停 → 通知订阅者
            if (hadProp && deleteResult && !dep._paused) {
                if (Array.isArray(targetObj) && /^\d+$/.test(prop as string)) dep.notify(`index:${ String(prop) }`);
                else dep.notify(prop as string);
            }

            return deleteResult;
        },
    });

    // 在 Proxy 上标记, 防止后续 reactive() 调用再次包装
    Object.defineProperty(proxy, "__isReactiveProxy", { value: true, enumerable: false, configurable: false, });

    // 在依赖管理器中缓存代理对象引用, 用于后续从原始对象找回 Proxy
    (dep as unknown as Record<string, unknown>).__proxy = proxy;
    return proxy;
};


/**
 * Get 陷阱跳过属性集合
 */
const SKIP_GET_PROPS = new Set(["__proto__", "__isReactive", "__manual", "__isReactiveProxy",]);


/**
 * Set 陷阱禁止修改属性集合
 */
const SKIP_SET_PROPS = new Set(["__isReactive", "__raw", "__isReactiveProxy"]);


/**
 * DeleteProperty 陷阱禁止删除属性集合
 */
const SKIP_DEL_PROPS = new Set(["__isReactive", "__raw", "__isReactiveProxy"]);


/**
 * 数组"新增元素"方法集合
 */
const ARR_ADD_METHODS = new Set(["splice", "push", "unshift"]);


/**
 * 数组变异方法列表
 */
const ARR_MUT_METHODS = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse",] as const;


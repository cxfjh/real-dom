import type { Ref } from "../types";
import { activeFns } from "../utils/shared.ts";
import { DependencyManager } from "./dependency.ts";

/**
 * 创建响应式引用
 *
 * @template T - 引用值的类型
 * @param initialValue - 初始值
 * @returns 包含 .value 访问器的 Ref 对象
 */
export function createRef<T>(initialValue: T): Ref<T> {
    const dep = new DependencyManager();
    let value = initialValue;

    return {
        get value(): T {
            if (activeFns.length > 0) dep.subscribe(activeFns[activeFns.length - 1]);
            return value;
        },

        set value(newValue: T) {
            if (value !== newValue) {
                value = newValue;
                dep.notify();
            }
        },

        __isRef: true,
    };
}

import { activeFns } from "../utils/shared.ts";
import { Dep } from "./dep.ts";


/**
 * 创建响应式引用
 *
 * @template T - 引用值的类型, 自动从初始值推断
 * @param init - 初始值, 可以是任意类型 (基础类型或对象)
 * @returns `RefInterface<T>` 对象, 包含 `.value` getter/setter 和 `__isRef` 标记
 */
export const ref = <T>(init: T) => {
    // 创建独立的依赖管理器
    const dep = new Dep();

    // 闭包变量存储内部值
    let value = init;

    return {
        /**
         * 获取响应式值
         *
         * @returns 当前存储的值
         */
        get value(): T {
            if (activeFns.length > 0) dep.subscribe(activeFns[activeFns.length - 1]);
            return value;
        },

        /**
         * 设置响应式值
         *
         * @param val - 新的值, 只有与当前值不同时才会触发更新
         */
        set value(val: T) {
            if (value !== val) {
                value = val;
                dep.notify();
            }
        },

        /**
         * Ref 标识属性
         */
        __isRef: true,
    };
};

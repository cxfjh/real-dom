import { activeFns } from "../utils/shared.ts";


/**
 * 监听响应式数据变化
 *
 * @template T - 监听值的类型, 从 source 函数的返回值自动推断
 * @param source - 响应式数据源的 getter 函数, 返回需要监听的值, 函数体中对响应式数据的访问会被自动追踪
 * @param callback - 变化回调函数, 参数 `(newValue, oldValue)`, oldValue 首次为 undefined
 * @param options - 配置项对象
 * @param options.immediate - 是否立即执行回调, 默认 false (惰性监听)
 * @param options.once - 是否仅监听一次, 默认 false (持续监听)
 * @returns 取消监听的函数 `stop()`, 调用后停止监听并清理所有资源
 */
export const watch = <T>(source: () => T, callback: (newValue: T, oldValue: T | undefined) => void, options: {immediate?: boolean; once?: boolean} = {}): () => void => {
    // 存储旧值, 初始为 undefined
    let oldValue: T | undefined = undefined;

    // 监听状态标志
    let active = true;

    // 清理调度标志
    let cleanupDone = false;

    /**
     * 监听执行函数 — watch 的核心调度器
     */
    const runner = (): void => {
        // 已停止监听或已调度清理时跳过执行
        if (!active || cleanupDone) return;

        // 将当前 runner 推入活跃函数栈, 用于依赖收集
        activeFns.push(runner);

        try {
            // 获取最新值, 访问响应式数据的 getter 时自动收集依赖
            const newValue = source();

            // 新旧值比较: 使用 Object.is 而非 === 或 !==
            if (!Object.is(newValue, oldValue)) {
                callback(newValue, oldValue);
                oldValue = newValue;

                // once 模式下执行一次后自动停止监听
                if (options.once) {
                    active = false;
                    cleanupDone = true;
                }
            }
        } catch (error) {
            // 回调执行异常时清理 runner, 避免持续报错
            console.error("监听器回调函数执行时发生错误:", error);
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    };

    // 立即执行模式: 先执行一次回调再开始监听
    if (options.immediate) {
        // 推入 runner 到 activeFns 栈, 确保 source() 内部的依赖收集
        activeFns.push(runner);

        try {
            runner();
        } catch (error) {
            console.error("立即执行 watch 函数时发生错误:", error);
        } finally {
            // 执行完成后从活跃栈中移除
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    } else {
        // 非立即模式: 仅初始化旧值, 不触发回调
        activeFns.push(runner);
        try {
            // 获取初始值作为旧值, 后续变化时与新值比较
            oldValue = source();
        } catch (error) {
            console.error("获取 watch 函数初始值时发生错误:", error);
        } finally {
            // 初始化完成后从活跃栈中移除
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    }

    /**
     * 取消监听函数 — 停止副作用侦听
     */
    return () => {
        if (!cleanupDone) {
            active = false;
            oldValue = undefined;
            cleanupDone = true;

            // 从活跃函数栈中移除 runner, 防止已停止的 runner 被意外调度
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    };
};

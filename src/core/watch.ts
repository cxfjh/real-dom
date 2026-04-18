import { activeFns } from "../utils/shared.ts";

/**
 * 监听响应式数据变化
 * @param source - 响应式数据源（函数）
 * @param callback - 变化回调
 * @param options - 配置项
 */
export const watch = <T>(
    source: () => T,
    callback: (newValue: T, oldValue: T | undefined) => void,
    options: {immediate?: boolean; once?: boolean} = {}
): () => void => {
    // 初始化 oldValue 为 undefined
    let oldValue: T | undefined = undefined;
    let isWatching = true;
    let cleanupScheduled = false;

    // 监听函数
    const runner = (): void => {
        if (!isWatching || cleanupScheduled) return;

        // 收集依赖
        activeFns.push(runner);
        try {
            // 获取最新值
            const newValue = source();

            // 检查是否有变化
            if (!Object.is(newValue, oldValue)) {
                callback(newValue, oldValue);
                oldValue = newValue;
                if (options.once) {
                    isWatching = false;
                    cleanupScheduled = true;
                }
            }
        } catch (error) {
            console.error("监听器回调函数执行时发生错误:", error);
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    };

    // 立即执行一次
    if (options.immediate) {
        activeFns.push(runner);
        try {
            runner();
        } catch (error) {
            console.error("立即执行 watch 函数时发生错误:", error);
        } finally {
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    } else {
        activeFns.push(runner);
        try {
            oldValue = source();
        } catch (error) {
            console.error("获取 watch 函数初始值时发生错误:", error);
        } finally {
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    }

    // 关闭监听
    return () => {
        if (!cleanupScheduled) {
            isWatching = false;
            oldValue = undefined;
            cleanupScheduled = true;
            const index = activeFns.indexOf(runner);
            if (index > -1) activeFns.splice(index, 1);
        }
    };
};

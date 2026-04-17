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

    // 监听函数
    const runner = (): void => {
        if (!isWatching) return;

        // 收集依赖
        activeFns.push(runner);
        try {
            // 获取最新值
            const newValue = source();

            // 检查是否有变化
            if (!Object.is(newValue, oldValue)) {
                callback(newValue, oldValue);
                oldValue = newValue;
                if (options.once) isWatching = false; // 如果 once 为 true，关闭监听
            }
        } finally {
            activeFns.pop();
        }
    };

    // 立即执行一次
    if (options.immediate) runner();
    else {
        activeFns.push(runner);
        try {
            oldValue = source();
        } finally {
            activeFns.pop();
        }
    }

    // 关闭监听
    return () => {
        isWatching = false;
        oldValue = undefined;
    };
};

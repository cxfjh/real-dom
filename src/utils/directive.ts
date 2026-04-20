import type { ReactiveObject } from "../types";

/**
 * 指令通用初始化工具
 *
 * @param el 元素
 * @param expr 指令表达式
 * @param scope 作用域
 * @param directiveName 指令名称（用于警告）
 * @param uniqueFlag 唯一标记（防止重复初始化）
 * @returns boolean 是否继续执行
 */
export const initDir = (el: HTMLElement, expr: string, scope: ReactiveObject | null | undefined, directiveName: string, uniqueFlag: string): boolean => {
    // 表达式不能为空
    if (!expr || expr.trim() === "") {
        console.warn(`[${ directiveName }] 表达式不能为空`);
        return false;
    }

    // 作用域必须有效
    if (!scope || typeof scope !== "object") {
        console.warn(`[${ directiveName }] 作用域无效`);
        return false;
    }

    // 防止重复初始化
    const flagKey = `__${ uniqueFlag }Processed`;
    if ((el as any)[flagKey]) {
        return false;
    }

    // 打上已处理标记
    (el as any)[flagKey] = true;
    return true;
};

/**
 * 元素从 DOM 中被删除时，自动执行清理
 *
 * @param el 要监听的元素
 * @param cleanup 清理函数
 */
export const watchElementRemove = (el: HTMLElement, cleanup: () => void) => {
    // 监听 DOM 变化
    const observer = new MutationObserver(() => {
        // 元素不在 DOM 里了
        if (!el.isConnected) {
            cleanup(); // 执行清理
            observer.disconnect(); // 停止监听
        }
    });

    // 观察整个文档，以便捕获任何可能导致元素被移除的变化
    observer.observe(document, {
        childList: true, // 子节点增删
        subtree: true   // 观察整个子树
    });
};

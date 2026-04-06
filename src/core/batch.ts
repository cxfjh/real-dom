import type { BatchUpdater } from "../types";

/**
 * 批量更新管理器单例
 */
export const batchUpdater: BatchUpdater = {
    /** 待执行的更新函数队列 */
    _queue: new Set<Function>(),

    /** 是否正在执行更新批次 */
    _isUpdating: false,

    /**
     * 添加更新函数到队列
     *
     * @param fn - 需要延迟执行的更新函数
     * @remarks 非函数类型参数将被静默忽略
     */
    add(fn: Function): void {
        if (typeof fn !== "function") return;
        this._queue.add(fn);
        if (!this._isUpdating) this._scheduleUpdate();
    },

    /**
     * 调度更新执行
     */
    _scheduleUpdate(): void {
        this._isUpdating = true;
        requestAnimationFrame(() => this._executeQueue());
    },

    /**
     * 执行队列中的所有更新函数
     */
    _executeQueue(): void {
        const queueCopy = new Set(this._queue);
        this._queue.clear();
        queueCopy.forEach((fn: Function): void => {
            try {
                fn.call(null);
            } catch (e) {
                console.error("[BatchUpdater] 更新执行失败：", e, "关联函数：", fn);
            }
        });
        this._isUpdating = false;
    },
};

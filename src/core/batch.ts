/**
 * 批量更新管理器
 */
export const batch: BatchInterface = {
    /**
     * 待执行的更新函数队列
     */
    _queue: new Set<Function>(),

    /**
     * 批次执行状态标志
     */
    _pending: false,

    /**
     * 将更新函数加入执行队列
     *
     * @param fn - 需要延迟执行的更新函数
     */
    add(fn: Function): void {
        if (typeof fn !== "function") return;
        this._queue.add(fn);
        if (!this._pending) this._schedule();
    },

    /**
     * 调度批次执行
     */
    _schedule(): void {
        this._pending = true;
        requestAnimationFrame(() => this._execute());
    },

    /**
     * 执行队列中的所有更新函数
     */
    _execute(): void {
        // 创建队列快照并清空原队列
        const snapshot = new Set(this._queue);
        this._queue.clear();

        // 逐个执行更新函数, 异常隔离
        snapshot.forEach((fn: Function): void => {
            try {
                fn.call(null);
            } catch (e) {
                console.error("[batch] 更新执行失败: ", e, "关联函数: ", fn);
            }
        });

        // 批次结束, 允许新的调度
        this._pending = false;
    },
};


/**
 * 批量更新管理器接口
 */
export interface BatchInterface {
    /**
     * 待执行的更新函数队列
     */
    _queue: Set<Function>;

    /**
     * 批次执行状态标志
     */
    _pending: boolean;

    /**
     * 将更新函数添加到队列
     */
    add(fn: Function): void;

    /**
     * 调度下一帧执行队列
     */
    _schedule(): void;

    /**
     * 执行队列中的所有更新函数
     */
    _execute(): void;
}

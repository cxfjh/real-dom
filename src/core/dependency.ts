import type { Dependency } from "../types";
import { batchUpdater } from "./batch.ts";

/**
 * 依赖管理类
 */
export class DependencyManager implements Dependency {
    /** 全量订阅者集合 */
    subscribers: Set<Function> = new Set();

    /** 按变量名分组的精准订阅者映射表 */
    varSubs: Map<string, Set<Function>> = new Map();

    /** 通知禁用标志 */
    _notificationDisabled: boolean | undefined;

    /**
     * 添加订阅者函数
     *
     * @param fn - 订阅函数（数据变化时将被调用）
     * @param variable - 可选的变量名（指定后仅在该变量变化时触发）
     * @remarks 非函数类型参数将被静默忽略
     */
    subscribe(fn: Function, variable: string | null = null): void {
        if (typeof fn !== "function") return;
        this.subscribers.add(fn);
        if (variable) {
            if (!this.varSubs.has(variable)) this.varSubs.set(variable, new Set());
            this.varSubs.get(variable)!.add(fn);
        }
    }

    /**
     * 通知订阅者执行更新
     * @param variable - 可选的变量名（指定后仅通知该变量的订阅者）
     */
    notify(variable: string | null = null): void {
        const targets = variable && this.varSubs.has(variable) ? this.varSubs.get(variable)! : this.subscribers;
        if (targets.size === 0) return;
        for (const fn of targets) batchUpdater.add(fn);
    }

    /**
     * 移除订阅者函数
     *
     * @param fn - 要移除的订阅函数
     * @param variable - 可选的变量名（指定后仅从该变量的订阅者中移除）
     */
    unsubscribe(fn: Function, variable: string | null = null): void {
        if (typeof fn !== "function") return;

        // 从全量订阅者集合中移除
        this.subscribers.delete(fn);

        // 如果指定了变量名，则从对应的变量订阅者映射中移除
        if (variable && this.varSubs.has(variable)) {
            const varSubs = this.varSubs.get(variable)!;
            varSubs.delete(fn);

            // 如果该变量的订阅者集合为空，删除整个条目
            if (varSubs.size === 0) this.varSubs.delete(variable);
        } else if (!variable) {
            // 如果没有指定变量名，从所有变量订阅者映射中移除
            for (const [_, varSubs] of this.varSubs) varSubs.delete(fn);

            // 清理空的变量订阅者映射
            for (const [varName, varSubs] of this.varSubs) {
                if (varSubs.size === 0) this.varSubs.delete(varName);
            }
        }
    }
}

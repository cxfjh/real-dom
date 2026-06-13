import type { DepInterface } from "../types";
import { batch } from "./batch.ts";

/**
 * 依赖管理类
 */
export class Dep implements DepInterface {
    /**
     * 全量订阅者集合
     */
    subs: Set<Function> = new Set();

    /**
     * 按变量名分组的精准订阅者映射表
     */
    varSubs: Map<string, Set<Function>> = new Map();

    /**
     * 通知禁用标志
     */
    _paused: boolean | undefined;

    /**
     * 添加订阅者函数
     *
     * @param fn - 订阅函数, 数据变化时将被 `notify()` 调度执行
     * @param variable - 可选的变量名字符串, 指定后建立精准订阅关系
     */
    subscribe(fn: Function, variable: string | null = null): void {
        // 类型守卫, 非函数类型静默忽略
        if (typeof fn !== "function") return;

        // 加入全量订阅者集合
        this.subs.add(fn);

        // 指定变量名时, 加入对应的精准订阅者集合
        if (variable) {
            if (!this.varSubs.has(variable)) this.varSubs.set(variable, new Set());
            this.varSubs.get(variable)!.add(fn);
        }
    }

    /**
     * 通知订阅者执行更新
     *
     * @param variable - 可选的变量名, 指定后尝试精准通知, 未指定或变量无订阅者时全量通知
     */
    notify(variable: string | null = null): void {
        // 确定通知目标
        const targets = variable && this.varSubs.has(variable) ? this.varSubs.get(variable)! : this.subs;

        // 无订阅者时直接返回, 避免无意义的遍历
        if (targets.size === 0) return;

        // 通过批量更新管理器调度执行
        for (const fn of targets) batch.add(fn);
    }

    /**
     * 移除订阅者函数
     *
     * @param fn - 要移除的订阅函数, 非函数类型会被静默忽略
     * @param variable - 可选的变量名, 指定后仅从该变量的精准集合中移除
     */
    unsubscribe(fn: Function, variable: string | null = null): void {
        // 类型守卫, 非函数类型静默忽略
        if (typeof fn !== "function") return;

        // 从全量订阅者集合中移除
        this.subs.delete(fn);

        if (variable && this.varSubs.has(variable)) {
            // 指定变量名, 从对应变量的精准订阅者集合中移除
            const targetSubs = this.varSubs.get(variable)!;
            targetSubs.delete(fn);

            // 订阅者集合为空时清理该条目, 防止 Map 中积累空 Set
            if (targetSubs.size === 0) this.varSubs.delete(variable);
        } else if (!variable) {
            // 未指定变量名, 从所有变量的精准订阅者映射中移除该函数
            for (const [_, entrySubs] of this.varSubs) entrySubs.delete(fn);

            // 清理所有已空的变量订阅者条目
            for (const [varName, entrySubs] of this.varSubs) if (entrySubs.size === 0) this.varSubs.delete(varName);
        }
    }
}

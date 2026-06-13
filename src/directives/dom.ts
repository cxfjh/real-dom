import type { ReactiveInterface } from "../types";
import { cpInsts, depMap, domTpls, rootScope } from "../utils/shared.ts";
import { parser } from "../core";
import { regDir } from "./regDir.ts";
import { initDir, onElRemove } from "../utils/directive.ts";

/**
 * 注册 r-dom 指令
 *
 * @param el    - 挂载目标元素, 组件将被渲染到此元素内部
 * @param expr  - 组件名称, 对应 `RealDom.dom(name, ...)` 定义的 name
 * @param scope - 当前数据作用域, 用于 props 表达式解析和组件工厂查找
 * @param deps  - 依赖收集容器, 用于追踪 props 中引用的响应式变量
 */
regDir("r-dom", (el: HTMLElement, expr: string, scope: ReactiveInterface, deps: Set<string>): void => {
    // 防重复处理
    if (!initDir(el, expr, scope, "r-dom", "rDom")) return;

    // 去除组件名首尾空格, 确保与 domTpls 中的键名一致
    const nameTrim = expr.trim();

    // 检查组件模板是否已定义, 如果没有对应的模板, 组件无法渲染
    if (!domTpls.has(nameTrim)) return void console.error(`[r-dom] 组件 "${ nameTrim }" 未定义`);
    const scopeDep = depMap.get(scope);

    // 组件实例引用, 用于卸载和重新渲染
    let inst: Record<string, unknown> | null = null;

    // 预提取 $ 前缀属性名列表
    const propAttrs: Array<{key: string; rawValue: string}> = [];
    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (attr.name.charCodeAt(0) === 36) {
            let propsKey = attr.name.slice(1);
            const dashIdx = propsKey.indexOf("-");
            if (dashIdx !== -1) propsKey = propsKey.replace(/-(\w)/g, (_m, c: string) => c.toUpperCase());
            propAttrs.push({ key: propsKey, rawValue: attr.value });
        }
    }

    /**
     * 提取组件 props — parser.parse 内部自动完成依赖收集到 deps
     *
     * @returns 解析后的 props 对象
     */
    const getProps = (): Record<string, unknown> => {
        const props: Record<string, unknown> = {};
        for (let i = 0; i < propAttrs.length; i++) {
            const { key, rawValue } = propAttrs[i];
            try {
                props[key] = parser.parse(rawValue, scope, deps, false);
            } catch (error) {
                console.warn(`[r-dom] 属性 "$${ key }" 解析失败:`, error);
                props[key] = rawValue;
            }
        }
        return props;
    };

    /**
     * 查找组件工厂函数
     *
     * @returns 组件工厂函数, 未找到返回 `undefined`
     */
    const findFactory = (): Function | undefined => (scope[nameTrim] as Function) || ((rootScope as Record<string, unknown>)[nameTrim] as Function);

    /**
     * 渲染组件实例
     *
     * @param factory - 组件工厂函数, 由 `findFactory()` 返回
     */
    const render = (factory: Function): void => {
        // 卸载旧组件实例, 避免内存泄漏和 DOM 残留
        if (inst) {
            try {
                if (typeof inst.unmount === "function") (inst.unmount as Function)();
            } catch (unmountError) {
                console.warn("[r-dom] 组件卸载失败:", unmountError);
            }
            inst = null;
        }

        // 获取最新的组件 props, 每次渲染时重新解析以确保响应式
        const props = getProps();

        // 创建组件实例, 支持两种工厂函数签名
        try {
            inst = factory({ props, to: el }) as unknown as Record<string, unknown>;
            if (!inst) new Error("组件工厂函数未返回有效实例"); // 校验返回值有效性
            cpInsts.set(el, inst); // 缓存组件实例到全局映射, 用于外部访问
        } catch (error) {
            console.error(`[r-dom] 组件 "${ nameTrim }" 渲染失败:`, error);
        }
    };

    /**
     * 挂载组件 — 入口函数
     */
    const mount = (): void => {
        const CompFact = findFactory();
        if (typeof CompFact === "function") render(CompFact);
    };

    // 首次渲染
    setTimeout(() => mount());

    // 订阅 mount 到所有已收集的依赖变量, 当变量变化时自动触发重新渲染
    if (scopeDep && deps.size > 0) deps.forEach(varName => scopeDep.subscribe(mount, varName));

    // 元素移除时自动清理
    onElRemove(el, () => {
        // 卸载组件实例
        if (inst) {
            try {
                if (typeof inst.unmount === "function") (inst.unmount as Function)();
            } catch (error) {
                console.warn("[r-dom] 组件卸载异常:", error);
            }
            inst = null;
        }

        // 从全局组件实例映射中移除, 释放引用
        cpInsts.delete(el);

        // 重置处理标记, 允许元素重新挂载时再次处理 r-dom
        (el as unknown as Record<string, unknown>).__domProcessed = false;

        // 取消所有依赖订阅, 防止内存泄漏
        if (scopeDep && deps.size > 0) deps.forEach(varName => scopeDep.unsubscribe(mount, varName));
    });
});

import type { ReactiveObject } from "../types";
import { EVENT_MAP, KEY_MAP } from "../utils/constants.ts";
import { registerDirective } from "./registry.ts";
import { initDir, watchElementRemove } from "../utils/directive.ts";

/**
 * 递归向上查找父节点中是否有 r-data 指令
 * @param element - 起始元素
 * @returns 找到的具有 r-data 指令的父元素，如果没有则返回 null
 */
/**
 * 向上查找最近带有 r-data 属性的祖先节点，最多到 body 节点
 * @param element 起始元素
 * @returns 找到的节点 / null
 */
const findParentWithRData = (element: HTMLElement | null): HTMLElement | null => {
    let current = element;

    while (current && current !== document.body) {
        if (current.hasAttribute("r-data")) return current;
        current = current.parentElement;
    }

    // 最后检查一下 body 自身是否有 r-data
    if (current === document.body && current.hasAttribute("r-data")) return current;
    return null;
};

/**
 * 注册 r-click 指令
 *
 * @remarks
 * - 自动检测元素上的事件类型属性
 * - 键盘事件支持按键名过滤
 * - 右键菜单事件自动阻止默认行为
 * - 预编译事件处理函数，避免每次事件触发时重复编译
 * - 支持事件处理器的自动清理
 */
registerDirective("r-click", (el: HTMLElement, code: string, scope: ReactiveObject): void => {
    if (!initDir(el, code, scope, "r-click", "rClick")) return;

    // 检测事件类型
    const eventType = ((): string => {
        for (const [attr, type] of Object.entries(EVENT_MAP)) if (el.hasAttribute(attr)) return type;
        return "click";
    })();

    // 判断是否为键盘事件
    const isKeyboardEvent = eventType.startsWith("key");
    const keyFilter = isKeyboardEvent ? (el.getAttribute(eventType)?.toLowerCase() || null) : null;

    // 避免重复绑定相同事件
    const elAny = el as unknown as Record<string, unknown>;
    if (elAny.__clickEventType === eventType && elAny.__clickCode === code) return;

    // 清理旧事件处理器
    const cleanup = (): void => {
        if (elAny.__clickHandler) {
            el.removeEventListener(elAny.__clickEventType as string, elAny.__clickHandler as EventListener);
            delete elAny.__clickHandler;
            delete elAny.__clickFn;
            delete elAny.__clickEventType;
            delete elAny.__clickCode;
        }
    };
    cleanup();

    // 预编译事件处理函数
    const validKeys = Object.keys(scope).filter(key => scope[key] !== undefined && typeof scope[key] !== "symbol",);
    let clickFn: Function;

    // 编译事件处理函数
    setTimeout(() => {
        try {
            const rData = findParentWithRData(el);
            if (rData) clickFn = (...args: any) => new Function(...validKeys, '_', `'use strict'; ${code}`)(...args, (rData as any).__dataScope);
            else clickFn = new Function(...validKeys, `"use strict"; ${ code }`);
            elAny.__clickFn = clickFn;
            elAny.__clickCode = code;
        } catch (err) {
            console.error(`[r-click] ${ eventType } 编译错误:`, (err as Error).message);
            return;
        }
    });

    // 事件处理器
    const eventHandler = (event: Event): void => {
        const e = event as KeyboardEvent | MouseEvent;

        // 键盘事件按键过滤
        if (isKeyboardEvent && keyFilter) {
            const normalizedFilter = KEY_MAP[keyFilter] || keyFilter;
            if ((e as KeyboardEvent).key.toLowerCase() !== normalizedFilter.toLowerCase() && (e as KeyboardEvent).key !== normalizedFilter) return;
            if (eventType === "keydown" && (e as KeyboardEvent).key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") event.preventDefault();
        }

        // 右键菜单阻止默认行为
        if (eventType === "contextmenu") event.preventDefault();

        // 执行用户函数
        try {
            const values = validKeys.map(key => scope[key]);
            clickFn(...values);
        } catch (err) {
            console.error("[r-click] 执行错误:", err);
        }
    };

    // 绑定事件
    elAny.__clickHandler = eventHandler;
    elAny.__clickEventType = eventType;
    el.addEventListener(eventType, eventHandler, { passive: !(eventType === "contextmenu" || eventType === "keydown" || eventType === "keyup") });

    // 自动清理
    watchElementRemove(el, cleanup);
});

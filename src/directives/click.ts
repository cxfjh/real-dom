import type { ReactiveInterface } from "../types";
import { EVENT_MAP, KEY_MAP } from "../utils/constants.ts";
import { regDir } from "./regDir.ts";
import { getKeys, initDir, onElRemove } from "../utils/directive.ts";


/**
 * 注册 r-click 指令
 *
 * @param el    - 绑定事件的 DOM 元素
 * @param expr  - 事件表达式, JavaScript 代码字符串, 如 `"count++"`, `"submit()"`
 * @param scope - 当前数据作用域, 其属性会作为参数注入到编译后的函数中
 */
regDir("r-click", (el: HTMLElement, expr: string, scope: ReactiveInterface): void => {
    // 防重复处理
    if (!initDir(el, expr, scope, "r-click", "rClick")) return;
    const elProps = el as unknown as Record<string, unknown>;

    // 事件类型检测
    let type = "click";
    for (let i = 0; i < EVENT_ENTRIES.length; i++) {
        if (el.hasAttribute(EVENT_ENTRIES[i][0])) {
            type = EVENT_ENTRIES[i][1];
            break;
        }
    }

    // 键盘事件按键过滤
    const isKey = type.startsWith("key");
    const targetKey = isKey ? (el.getAttribute(type)?.toLowerCase() || null) : null;

    // 避免 compile 重复执行时多次注册事件监听器
    if (elProps.__clickEventType === type && elProps.__clickCode === expr) return;

    /**
     * 清理旧事件处理器
     */
    const cleanup = (): void => {
        if (elProps.__clickHandler) {
            el.removeEventListener(elProps.__clickEventType as string, elProps.__clickHandler as EventListener);
            elProps.__clickHandler = undefined;
            elProps.__clickFn = undefined;
            elProps.__clickEventType = undefined;
            elProps.__clickCode = undefined;
            elProps.__clickRDataEl = undefined;
        }
    };

    cleanup();

    // 表达式编译
    const scopeKeys = getKeys(scope);
    let compiledFn: Function;
    try {
        compiledFn = new Function(...scopeKeys, "_", `"use strict"; ${expr}`);
    } catch (err) {
        console.error(`[r-click] ${type} 编译错误:`, (err as Error).message);
        return;
    }

    // 缓存编译后的函数, 用于后续事件触发时执行
    elProps.__clickFn = compiledFn;
    elProps.__clickCode = expr;

    /**
     * 事件处理器
     *
     * @param event - 原生 DOM 事件对象
     */
    const handler = (event: Event): void => {
        const evt = event as KeyboardEvent | MouseEvent;

        // 键盘事件按键过滤
        if (isKey && targetKey) {
            // 使用 KEY_MAP 进行别名映射
            const normKey = KEY_MAP[targetKey] || targetKey;
            const evtKey = (evt as KeyboardEvent).key;

            // 双重匹配
            if (evtKey.toLowerCase() !== normKey.toLowerCase() && evtKey !== normKey) return;
            if (type === "keydown" && evtKey === "Enter" && (evt.target as HTMLElement).tagName !== "TEXTAREA") event.preventDefault();
        }

        // 右键菜单阻止默认行为
        if (type === "contextmenu") event.preventDefault();

        // 从 scope 读取最新值
        const scopeLen = scopeKeys.length;
        const values = new Array(scopeLen + 1);
        for (let i = 0; i < scopeLen; i++) values[i] = scope[scopeKeys[i]];

        // r-data 作用域注入
        let rDataEl = elProps.__clickRDataEl as HTMLElement | null | undefined;
        if (rDataEl === undefined) {
            rDataEl = findRDataParent(el);
            elProps.__clickRDataEl = rDataEl || null; // null 标记"已查找但未找到"
        }

        // 将 r-data 的 _data 作为最后一个参数 "_" 注入
        values[scopeLen] = rDataEl ? (rDataEl as unknown as Record<string, unknown>)._data : undefined;

        // 执行表达式
        try {
            compiledFn(...values);
        } catch (error) {
            console.error("[r-click] 执行错误:", error);
        }
    };

    // 缓存事件处理器和事件类型, 用于后续清理和防重复绑定
    elProps.__clickHandler = handler;
    elProps.__clickEventType = type;

    // 注册事件监听
    el.addEventListener(type, handler, { passive: !NON_PASSIVE_EVENTS.has(type) });

    // 元素移除时自动清理事件监听器, 防止内存泄漏
    onElRemove(el, cleanup);
});


/**
 * EVENT_MAP 预提取 entries
 */
const EVENT_ENTRIES = Object.entries(EVENT_MAP);


/**
 * 需要非 passive 模式的事件类型集合
 */
const NON_PASSIVE_EVENTS = new Set(["contextmenu", "keydown", "keyup"]);


/**
 * 向上查找最近带有 r-data 属性的祖先节点
 *
 * @param el - 起始元素, 从此元素开始向上查找
 * @returns 找到的 r-data 祖先节点, 未找到返回 `null`
 */
const findRDataParent = (el: HTMLElement | null): HTMLElement | null => {
    let current = el;
    while (current && current !== document.body) {
        if (current.hasAttribute("r-data")) return current;
        current = current.parentElement;
    }
    if (current === document.body && current.hasAttribute("r-data")) return current;
    return null;
};

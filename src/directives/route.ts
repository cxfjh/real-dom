import type { ReactiveObject } from "../types";
import { expressionParser } from "../core";
import { registerDirective } from "./registry.ts";

import { watchElementRemove } from "../utils/directive.ts";

/**
 * 注册 r-route 指令
 *
 * @remarks
 * - 表达式求值为路由路径字符串
 * - 点击时阻止默认行为并调用 router.nav() 导航
 * - 仅当路径已注册时才执行导航
 * - 支持动态路由路径
 */
registerDirective("r-route", (el: HTMLElement, pathExpr: string, scope: ReactiveObject, deps: Set<string>): void => {
    const path = expressionParser.parse(pathExpr, scope, deps) as string;
    if (!path) return;

    // 清理旧处理器
    const elAny = el as unknown as Record<string, unknown>;
    if (elAny._routeHandler) el.removeEventListener("click", elAny._routeHandler as EventListener);

    // 创建新处理器
    elAny._routeHandler = (event: Event): void => {
        event.preventDefault();
        if (path && window.router.routes.has(path)) window.router.nav(path);
    };

    // 添加点击事件监听器
    el.addEventListener("click", elAny._routeHandler as EventListener);

    // 自动清理
    watchElementRemove(el, () => {
        el.removeEventListener("click", elAny._routeHandler as EventListener);
        delete elAny._routeHandler;
    });
});

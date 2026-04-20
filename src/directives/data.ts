import type { ReactiveObject } from "../types";
import { activeFns, depsMap, elDeps } from "../utils/shared.ts";
import { expressionParser, processElement } from "../core";
import { registerDirective } from "./registry.ts";
import { initDir, watchElementRemove } from "../utils/directive.ts";

/**
 * 注册 r-data 指令
 *
 * @remarks
 * - 在元素上创建独立的数据作用域
 * - 使数据仅在此元素及其子元素中可用
 * - 不影响父级作用域
 * - 动态更新数据内容
 */
registerDirective("r-data", (el: HTMLElement, expr: string, scope: ReactiveObject, deps: Set<string>): void => {
    if (!initDir(el, expr, scope, "r-data", "rData")) return;

    // 预处理和缓存
    const itemTemplate = el.innerHTML.trim();
    const baseClass = el.className.trim();
    const baseStyle = el.style.cssText.trim();

    // 缓存静态属性，动态属性需在更新时重新解析
    const staticBaseAttrs: Record<string, string> = {};
    const dynamicBaseAttrs: Record<string, string> = {};
    Array.from(el.attributes).forEach(attr => {
        if (["r-data", "class", "style"].includes(attr.name)) return;
        if (!attr.value.includes("{{") && !attr.value.includes("{")) staticBaseAttrs[attr.name] = attr.value.trim();
        else dynamicBaseAttrs[attr.name] = attr.value.trim();
    });

    // 核心更新函数
    const update = (): void => {
        let dataObj: Record<string, unknown>;
        try {
            const parsedResult = expressionParser.parse(expr.trim(), scope, deps);
            if (typeof parsedResult === "object" && parsedResult !== null && !Array.isArray(parsedResult)) dataObj = parsedResult as Record<string, unknown>;
            else if (typeof parsedResult === "string") {
                try {
                    dataObj = JSON.parse(parsedResult);
                } catch {
                    dataObj = { data: parsedResult };
                }
            } else dataObj = { data: parsedResult };
        } catch (error) {
            console.error(`[r-data] 表达式解析错误:`, { expr: expr.trim(), error });
            return;
        }

        // 获取或创建数据作用域
        let dataScope = (el as any).__dataScope;
        if (!dataScope) {
            dataScope = window.reactive({ ...scope, ...dataObj });
            (el as any).__dataScope = dataScope;
            (el as any).__originalData = { ...dataObj };
        } else {
            const originalData = (el as any).__originalData;
            let hasChanges = false;
            for (const [key, value] of Object.entries(dataObj)) {
                if (originalData && key in originalData && dataScope[key] === originalData[key] && dataScope[key] !== value) {
                    dataScope[key] = value;
                    originalData[key] = value;
                    hasChanges = true;
                }
            }

            if (!hasChanges) return;
        }

        // 重建元素内容
        const tempContainer = document.createElement("div");
        if (baseClass) tempContainer.className = baseClass;
        if (baseStyle) tempContainer.style.cssText = baseStyle;

        // 应用静态属性
        Object.entries(staticBaseAttrs).forEach(([name, value]) => tempContainer.setAttribute(name, value));
        Object.entries(dynamicBaseAttrs).forEach(([name, value]) => tempContainer.setAttribute(name, expressionParser.parseText(value, dataScope, deps)));
        tempContainer.innerHTML = itemTemplate;

        // 使用数据作用域处理子元素
        processElement(tempContainer, dataScope);

        // 更高效地替换元素内容
        el.replaceChildren(...Array.from(tempContainer.children));
    };

    // 注册更新函数
    activeFns.push(update);
    try {
        update();
    } catch (initErr) {
        console.error("[r-data] 初始化错误:", (initErr as Error).message);
        el.textContent = "";
    } finally {
        activeFns.pop();
    }

    // 自动清理
    watchElementRemove(el, () => {
        const elAny = el as any;
        if (elAny.__rDataScope && typeof (elAny.__rDataScope as any).destroy === "function") (elAny.__rDataScope as any).destroy();
        const depSet = elDeps.get(el);
        if (depSet) depSet.forEach(varName => depsMap.get(scope)?.unsubscribe(update, varName));
    });

    // 依赖订阅
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depsMap.get(scope)?.subscribe(update, varName));
});

import type { ReactiveObject } from "../types";
import { activeFns, depsMap, elDeps } from "../utils/shared.ts";
import { expressionParser, processElement } from "../core";
import { registerDirective } from "./registry.ts";
import { initDir, watchElementRemove } from "../utils/directive.ts";

/**
 * 注册 r-arr 指令
 *
 * @remarks
 * 支持的属性配置：
 * - `value` 属性自定义项变量名 (默认 "value")
 * - `index` 属性自定义索引变量名 (默认 "index")
 * - `key` 属性指定唯一键属性 (默认 "id")
 */
registerDirective("r-arr", (el: HTMLElement, expr: string, scope: ReactiveObject, deps: Set<string>): void => {
    if (!initDir(el, expr, scope, "r-arr", "rArr")) return;

    // 获取循环模板
    const itemTemplate = el.innerHTML.trim();
    if (!itemTemplate) return void console.warn("[r-arr] 循环模板不能为空");

    // 读取配置属性
    const indexKey = el.getAttribute("index") || "index";
    const itemKey = el.getAttribute("value") || "value";
    const keyProp = el.getAttribute("key") || "id";

    // 缓存基础属性
    const baseAttrs: Record<string, string> = {};
    const baseClass = el.className.trim();
    const baseStyle = el.style.cssText.trim();
    Array.from(el.attributes).forEach(attr => {
        if (["r-arr", "index", "value", "key", "class", "style"].includes(attr.name)) return;
        baseAttrs[attr.name] = expressionParser.parseText(attr.value.trim(), scope, deps);
    });

    // 节点缓存
    const nodeCache = new Map<string, {nodes: Node[]; itemScope: ReactiveObject}>();
    let prevKeySet = new Set<string>();

    // 生成数组项的唯一键
    const getUniqueKey = (item: unknown, index: number): string => {
        if (item && typeof item === "object" && (item as unknown as Record<string, unknown>)[keyProp] !== undefined) return String((item as unknown as Record<string, unknown>)[keyProp]);
        const dataHash = typeof item === "object" ? JSON.stringify(item).slice(0, 50) : String(item);
        return `${ index }-${ dataHash }`;
    };

    // 核心更新函数
    const update = (): void => {
        let arr: unknown[] = [];

        // 解析数组表达式
        try {
            const parsed = expressionParser.parse(expr.trim(), scope, deps);
            arr = Array.isArray(parsed) ? parsed : [];
        } catch (parseErr) {
            console.error("[r-arr] 数组解析错误:", { expr: expr.trim(), error: (parseErr as Error).message, stack: (parseErr as Error).stack?.slice(0, 300), });
            arr = [];
        }

        // 生成当前数组的唯一键集合
        const currKeys = arr.map((item, i) => getUniqueKey(item, i));
        const currKeySet = new Set(currKeys);
        const fragment = document.createDocumentFragment();

        // 遍历当前数组，生成节点
        currKeys.forEach((currKey, index) => {
            // 获取当前数组项数据
            const itemData = arr[index];
            const cached = nodeCache.get(currKey);
            let nodesToAdd: DocumentFragment;

            if (cached) {
                // 复用已有节点
                const { nodes, itemScope } = cached;
                itemScope[itemKey] = itemData;
                itemScope[indexKey] = index;

                // 复用节点
                const reuseFragment = document.createDocumentFragment();
                nodes.forEach(node => {
                    const cloned = node.cloneNode(true);
                    (cloned as unknown as Record<string, unknown>).__processed = false;
                    if ((cloned as HTMLElement).children) Array.from((cloned as HTMLElement).children).forEach((child) => ((child as unknown as Record<string, unknown>).__processed = false),);
                    reuseFragment.appendChild(cloned);
                });

                // 处理复用节点
                processElement(reuseFragment as unknown as HTMLElement, itemScope);
                nodesToAdd = reuseFragment;
            } else {
                // 创建新节点
                const tempContainer = document.createElement("div");
                if (baseClass) tempContainer.className = baseClass;
                if (baseStyle) tempContainer.style.cssText = baseStyle;

                // 设置基础属性
                Object.entries(baseAttrs).forEach(([name, value]) => tempContainer.setAttribute(name, value));
                tempContainer.innerHTML = itemTemplate;

                // 创建新节点的 scope
                const itemScope = window.reactive({ ...scope, [itemKey]: itemData, [indexKey]: index });
                processElement(tempContainer, itemScope);

                // 缓存新节点
                const nodes = Array.from(tempContainer.childNodes);
                nodeCache.set(currKey, { nodes, itemScope });

                // 创建新节点的 fragment
                const newFragment = document.createDocumentFragment();
                nodes.forEach(node => newFragment.appendChild(node));
                nodesToAdd = newFragment;
            }
            fragment.appendChild(nodesToAdd);
        });

        // 清理过期缓存
        prevKeySet.forEach(key => !currKeySet.has(key) && nodeCache.delete(key));
        prevKeySet = currKeySet;

        // 更新元素内容
        el.textContent = "";
        el.appendChild(fragment);
    };

    // 注册更新函数
    activeFns.push(update);
    try {
        update();
    } catch (initErr) {
        console.error("[r-arr] 初始化错误:", (initErr as Error).message);
        el.textContent = "";
    } finally {
        activeFns.pop();
    }

    // 自动清理
    watchElementRemove(el, () => {
        for (const [_, cacheEntry] of nodeCache) {
            cacheEntry.nodes.forEach(node => (node.parentNode) && node.parentNode.removeChild(node));
            if (typeof (cacheEntry.itemScope as any).destroy === 'function') (cacheEntry.itemScope as any).destroy();
        }
        nodeCache.clear();
        prevKeySet.clear();
        (el as unknown as Record<string, unknown>).__arrProcessed = false;
        const depSet = elDeps.get(el);
        if (depSet) depSet.forEach(varName => depsMap.get(scope)?.unsubscribe(update, varName));
    });

    // 依赖订阅
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depsMap.get(scope)?.subscribe(update, varName));
});

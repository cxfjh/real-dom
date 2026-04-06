import type { ReactiveObject } from "../types";
import { activeFns, elDeps, depsMap } from '../utils/shared.ts';
import { expressionParser } from "../core";
import { processElement } from "../core";
import { registerDirective } from './registry.ts';

/**
 * 注册 r-for 指令
 *
 * @remarks
 * - 表达式应求值为数字（循环次数），索引从 1 开始
 * - 通过 index 属性自定义索引变量名（默认 "index"）
 * - 支持节点缓存复用，提升列表更新性能
 * - 自动清理过期节点缓存，防止内存泄漏
 */
registerDirective('r-for', (el: HTMLElement, expr: string, scope: ReactiveObject, deps: Set<string>): void => {
    if (expr.trim() === '') return void console.warn('[r-for] 循环表达式不能为空');
    if (!scope || typeof scope !== 'object') return void console.warn('[r-for] 作用域无效');
    if ((el as unknown as Record<string, unknown>).__forProcessed) return;
    (el as unknown as Record<string, unknown>).__forProcessed = true;

    // 获取循环模板
    const itemTemplate = el.innerHTML.trim();
    if (!itemTemplate) return void console.warn('[r-for] 循环模板不能为空');

    // 获取索引变量名
    const indexKey = el.getAttribute('index') || 'index';

    // 缓存基础属性（排除指令相关）
    const baseAttrs: Record<string, string> = {};
    Array.from(el.attributes).forEach(attr => {
        if (['r-for', 'index', 'class', 'style'].includes(attr.name)) return;
        baseAttrs[attr.name] = expressionParser.parseText(attr.value.trim(), scope, deps);
    });

    // 获取基础样式和类名
    const baseClass = el.className.trim();
    const baseStyle = el.style.cssText.trim();

    // 节点缓存
    const nodeCache = new Map<number, { nodes: Node[]; itemScope: ReactiveObject }>();
    let prevKeys = new Set<number>();

    // 核心更新函数
    const update = (): void => {
        let count: number;

        // 解析循环次数
        try {
            const parsedCount = expressionParser.parse(expr.trim(), scope, deps);
            count = Math.max(0, parseInt(String(parsedCount), 10) || 0);
        } catch (parseErr) {
            console.error('[r-for] 解析错误:', { expr: expr.trim(), error: (parseErr as Error).message });
            count = 0;
        }

        // 生成当前循环键集合
        const currKeys = Array.from({ length: count }, (_, i) => i + 1);
        const currKeySet = new Set(currKeys);
        const fragment = document.createDocumentFragment();

        // 遍历生成节点
        currKeys.forEach(key => {
            // 获取当前索引
            const index = key;
            const cacheEntry = nodeCache.get(key);
            let nodesToAdd: DocumentFragment;

            if (cacheEntry) {
                // 复用已有节点
                const { nodes, itemScope } = cacheEntry;
                itemScope[indexKey] = index;

                // 复用节点
                const reuseFragment = document.createDocumentFragment();
                nodes.forEach(node => {
                    (node as unknown as Record<string, unknown>).__processed = false;
                    if ((node as HTMLElement).children) Array.from((node as HTMLElement).children).forEach((child) => ((child as unknown as Record<string, unknown>).__processed = false),);
                    reuseFragment.appendChild(node);
                });

                // 处理复用的节点
                processElement(reuseFragment as unknown as HTMLElement, itemScope);
                nodesToAdd = reuseFragment;
            } else {
                // 创建新节点
                const tempContainer = document.createElement('div');
                if (baseClass) tempContainer.className = baseClass;
                if (baseStyle) tempContainer.style.cssText = baseStyle;
                Object.entries(baseAttrs).forEach(([name, value]) => tempContainer.setAttribute(name, value));
                tempContainer.innerHTML = itemTemplate;

                // 创建新节点
                const itemScope = window.reactive({ ...scope, [indexKey]: index });
                processElement(tempContainer, itemScope);

                // 缓存新节点
                const newFragment = document.createDocumentFragment();
                const nodeArray = Array.from(tempContainer.childNodes);
                nodeCache.set(key, { nodes: nodeArray, itemScope });
                nodeArray.forEach(node => newFragment.appendChild(node));
                nodesToAdd = newFragment;
            }
            fragment.appendChild(nodesToAdd);
        });

        // 清理过期节点
        prevKeys.forEach(key => !currKeySet.has(key) && nodeCache.delete(key));
        prevKeys = currKeySet;

        el.textContent = '';
        el.appendChild(fragment);
    };

    activeFns.push(update);
    try {
        update();
    } catch (initErr) {
        console.error('[r-for] 初始化错误:', (initErr as Error).message);
        el.textContent = '';
    } finally {
        activeFns.pop();
    }

    // 自动清理
    const cleanFor = (): void => {
        nodeCache.clear();
        prevKeys.clear();
        (el as unknown as Record<string, unknown>).__forProcessed = false;
        el.removeEventListener('beforeunload', cleanFor);
    };
    el.addEventListener('beforeunload', cleanFor);

    // 依赖订阅
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depsMap.get(scope)?.subscribe(update, varName));
});

import type { ReactiveObject } from "../types";
import { activeFns, componentInstances, componentTemplates, depsMap, elDeps } from "../utils/shared.ts";
import { expressionParser, processElement } from "../core";
import { registerDirective } from "./registry.ts";
import { initDir, watchElementRemove } from "../utils/directive.ts";

/**
 * 注册 r-cp 指令
 *
 * @remarks
 * - 组件必须先通过 `<template r-cp="name">` 定义
 * - 通过 `$propName` 属性传递 props（自动转驼峰命名）
 * - 组件作用域继承根作用域并合并 props
 * - 支持 props 变化时自动重新渲染
 */
registerDirective("r-cp", (el: HTMLElement, compName: string, scope: ReactiveObject, deps: Set<string>): void => {
    if (!initDir(el, compName, scope, "r-cp", "rCp")) return;

    // 获取组件模板
    const compTemplate = componentTemplates.get(compName.trim());
    if (!compTemplate) return void console.error(`[r-cp] 组件 "${ compName }" 未定义，请先通过 <template r-cp="${ compName }"> 定义`);

    // 提取 $ 前缀的组件属性
    const getComponentProps = (): Record<string, unknown> => {
        const props: Record<string, unknown> = {};
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith("$")) {
                let propKey = attr.name.slice(1);
                propKey = propKey.replace(/-(\w)/g, (_match, c: string) => c.toUpperCase());
                props[propKey] = expressionParser.parse(attr.value, scope, deps);
            }
        });
        return props;
    };

    // 创建组件作用域
    const createComponentScope = (): ReactiveObject => {
        const props = getComponentProps();
        const compScope = window.reactive({ ...window.__rootScope, ...props, $isComponent: true });
        componentInstances.set(el, compScope);
        return compScope;
    };

    // 渲染组件
    const renderComponent = (): void => {
        const compScope = createComponentScope();
        const templateClone = compTemplate.cloneNode(true) as DocumentFragment;
        processElement(templateClone, compScope);
        el.textContent = "";
        el.appendChild(templateClone);
    };

    // 注册更新函数
    activeFns.push(renderComponent);
    try {
        renderComponent();
    } finally {
        activeFns.pop();
    }

    // 属性变化时重新渲染
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depsMap.get(scope)?.subscribe(renderComponent, varName));

    // 自动清理
    watchElementRemove(el, () => {
        componentInstances.delete(el);
        (el as unknown as Record<string, unknown>).__cpProcessed = false;
        const depSet = elDeps.get(el);
        if (depSet) depSet.forEach(varName => depsMap.get(scope)?.unsubscribe(renderComponent, varName));
    });
});

import type { ReactiveObject } from "../types";
import { INTERPOLATION_REGEX } from "../utils/constants.ts";
import { activeFns, depsMap } from "../utils/shared.ts";
import { expressionParser } from "../core";
import { registerDirective } from "./registry.ts";

import { watchElementRemove } from "../utils/directive.ts";

/**
 * 注册 r 指令
 *
 * @remarks
 * - 静态引用：`r="myEl"` → `$r.myEl` 指向该元素
 * - 动态引用：`r="{{refName}}"` → refName 变化时自动更新引用
 * - 元素销毁时自动清理引用，防止内存泄漏
 */
registerDirective("r", (el: HTMLElement, refExpr: string, scope: ReactiveObject, deps: Set<string>): void => {
    if (!refExpr.trim()) return;
    if (!window.$r) window.$r = {};

    let currentRefName: string | null = null;
    let isDynamic = false;

    // 解析引用名（支持静态字符串和动态插值）
    const getRefName = (): string | null => {
        let name = refExpr.trim();
        if (INTERPOLATION_REGEX.test(name)) {
            isDynamic = true;
            return expressionParser.parseText(name, scope, deps)?.toString().trim() || null;
        } else {
            isDynamic = false;
            return name;
        }
    };

    // 更新引用
    const updateRef = (): void => {
        // 获取新引用名
        const newName = getRefName();
        if (!newName) return;

        // 更新引用
        if (newName !== currentRefName) {
            if (currentRefName && window.$r[currentRefName] === el) delete window.$r[currentRefName];
            currentRefName = newName;
            window.$r[currentRefName] = el;
        }
    };

    // 初始设置
    currentRefName = getRefName();
    if (currentRefName) window.$r[currentRefName] = el;

    // 动态引用需要响应式更新
    if (isDynamic) {
        activeFns.push(updateRef);
        try {
            getRefName();
        } finally {
            activeFns.pop();
        }

        // 监听依赖
        const dependencies = new Set<string>();
        expressionParser.parseText(refExpr, scope, dependencies);
        dependencies.forEach(varName => depsMap.get(scope)?.subscribe(updateRef, varName));
    }

    // 自动清理
    watchElementRemove(el, () => (currentRefName && window.$r[currentRefName] === el) && delete window.$r[currentRefName]);
});

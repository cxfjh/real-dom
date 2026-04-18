import type { ReactiveObject } from "../types";
import { componentInstances, componentTemplates, depsMap, elDeps } from "../utils/shared.ts";
import { VARIABLE_REGEX } from "../utils/constants.ts";
import { expressionParser } from "../core";
import { registerDirective } from "./registry.ts";
import { initDir, watchElementRemove } from "../utils/directive.ts";

/** 最大重试次数 */
const MAX_RETRY_COUNT = 5;

/** 重试间隔（毫秒） */
const RETRY_INTERVAL = 16;

/**
 * 注册 r-dom 指令
 *
 * @remarks
 * - 通过 `$propName` 属性传递 props（自动转驼峰命名）
 * - 组件工厂函数从作用域或根作用域中查找
 * - 若组件尚未注册，启动重试机制（最多 5 次，间隔 16ms）
 * - 依赖变化时防抖重新渲染（约 16ms）
 */
registerDirective("r-dom", (el: HTMLElement, compName: string, scope: ReactiveObject, deps: Set<string>): void => {
    if (!initDir(el, compName, scope, "r-dom", "rDom")) return;

    // 去除组件名首尾空格
    const compNameTrimmed = compName.trim();
    if (!componentTemplates.has(compNameTrimmed)) return void console.error(`[r-dom] 组件 "${ compNameTrimmed }" 未定义`);

    // 用于存储组件实例
    let componentInstance: Record<string, unknown> | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let retryCount = 0;

    // 提取组件 props
    const getComponentProps = (): Record<string, unknown> => {
        const props: Record<string, unknown> = {};
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (attr.name.startsWith("$")) {
                let propKey = attr.name.slice(1);
                propKey = propKey.replace(/-(\w)/g, (_match, c: string) => c.toUpperCase());
                try {
                    props[propKey] = expressionParser.parse(attr.value, scope, deps, false);
                } catch (error) {
                    console.warn(`[r-dom] 属性 "${ attr.name }" 解析失败:`, error);
                    props[propKey] = attr.value;
                }
            }
        }
        return props;
    };

    // 查找组件工厂函数
    const findComponentFactory = (): Function | undefined => (scope[compNameTrimmed] as Function) || (window.__rootScope && window.__rootScope[compNameTrimmed] as Function);

    // 渲染组件实例
    const renderComponent = (ComponentFactory: Function): void => {
        // 卸载旧组件实例
        if (componentInstance) {
            try {
                if (typeof componentInstance.unmount === "function") (componentInstance.unmount as Function)();
            } catch (unmountError) {
                console.warn("[r-dom] 组件卸载失败:", unmountError);
            }
            componentInstance = null;
        }

        // 获取组件 props
        const props = getComponentProps();

        // 创建组件实例
        try {
            if (ComponentFactory.length >= 2) componentInstance = ComponentFactory(props, el) as unknown as Record<string, unknown>;
            else componentInstance = ComponentFactory({ props, target: el }) as unknown as Record<string, unknown>;
            if (!componentInstance) new Error("组件工厂函数未返回有效实例");
            componentInstances.set(el, componentInstance);
        } catch (error) {
            console.error(`[r-dom] 组件 "${ compNameTrimmed }" 渲染失败:`, error);
        }
    };

    // 尝试挂载组件
    const mountComponent = (): boolean => {
        const ComponentFactory = findComponentFactory();
        if (typeof ComponentFactory === "function") {
            if (retryTimer) {
                clearInterval(retryTimer);
                retryTimer = null;
            }
            renderComponent(ComponentFactory);
            return true;
        }
        return false;
    };

    // 启动重试机制
    const startRetry = (): void => {
        if (retryTimer) return;
        retryTimer = setInterval(() => {
            retryCount++;
            if (mountComponent()) return;
            if (retryCount >= MAX_RETRY_COUNT) {
                clearInterval(retryTimer!);
                retryTimer = null;
                console.error(`[r-dom] 组件 "${ compNameTrimmed }" 注册超时（${ MAX_RETRY_COUNT * RETRY_INTERVAL }ms）`);
            }
        }, RETRY_INTERVAL);
    };

    // 依赖变化处理（防抖）
    let pendingUpdate: ReturnType<typeof setTimeout> | null = null;
    const handleDependencyChange = (): void => {
        if (pendingUpdate) clearTimeout(pendingUpdate);
        pendingUpdate = setTimeout(() => {
            const ComponentFactory = findComponentFactory();
            if (typeof ComponentFactory === "function") renderComponent(ComponentFactory);
            else if (componentInstance) {
                console.warn("[r-dom] 组件工厂函数丢失，尝试重新挂载");
                startRetry();
            }
            pendingUpdate = null;
        }, 16);
    };

    // 初始挂载
    if (!mountComponent()) startRetry();

    // 依赖订阅
    const depSet = elDeps.get(el) || new Set<string>();
    const collectedDeps = new Set<string>();

    // 收集依赖
    const props = getComponentProps();
    Object.values(props).forEach(value => {
        if (typeof value === "string" && value.includes("{{")) {
            const vars = value.match(VARIABLE_REGEX) || [];
            vars.forEach(v => {
                const rootVar = v.split(".")[0];
                if (rootVar && !expressionParser._globals.has(rootVar)) collectedDeps.add(rootVar);
            });
        }
    });

    // 合并依赖
    const allDeps = new Set([...depSet, ...collectedDeps]);
    allDeps.forEach(varName => depsMap.get(scope)?.subscribe(handleDependencyChange, varName));

    // 自动清理
    watchElementRemove(el, () => {
        if (retryTimer) {
            clearInterval(retryTimer);
            retryTimer = null;
        }
        if (pendingUpdate) {
            clearTimeout(pendingUpdate);
            pendingUpdate = null;
        }

        // 卸载组件实例
        if (componentInstance) {
            try {
                if (typeof componentInstance.unmount === "function") (componentInstance.unmount as Function)();
            } catch (error) {
                console.warn("[r-dom] 组件卸载异常:", error);
            }
            componentInstance = null;
        }

        componentInstances.delete(el);
        (el as unknown as Record<string, unknown>).__domProcessed = false;
        allDeps.forEach(varName => depsMap.get(scope)?.unsubscribe(handleDependencyChange, varName));
    });
});

import type { ComponentOptions } from "./types";
import { batchUpdater, createComponent, createReactive, createRef, processElement } from "./core";
import "./directives/index.ts";
import { router } from "./router";
import { componentTemplates, directives, inlineScripts, mountedCallbacks, pendingProviders, } from "./utils/shared.ts";
import { INTERPOLATION_REGEX } from "./utils/constants.ts";

/**
 * 创建响应式引用
 * @see {@link createRef}
 */
window.ref = createRef;

/**
 * 创建响应式代理对象
 * @see {@link createReactive}
 */
window.reactive = createReactive;

/**
 * 向根作用域注入数据
 *
 * @param key - 数据键名或键值对对象
 * @param value - 数据值（当 key 为字符串时使用）
 */
window.provide = (key: string | Record<string, unknown>, value: unknown = null): void => {
    if (typeof key !== "object") pendingProviders.push([key, value]);
    else for (const [k, v] of Object.entries(key)) pendingProviders.push([k, v]);
};

/**
 * 定义组件
 *
 * @see {@link createComponent}
 */
window.dom = (compName: string, options: ComponentOptions): unknown => createComponent(compName, options);

/**
 * 注册挂载完成回调
 *
 * @param callback - DOM 初始化完成后执行的回调
 */
window.onMounted = function (callback: Function): void {
    if (typeof callback === "function") mountedCallbacks.push(callback);
    else console.warn("onMounted 只接受函数作为参数。");
};

/** 挂载路由管理器 */
window.router = router;

/**
 * DOMContentLoaded 事件处理：启动应用
 */
document.addEventListener("DOMContentLoaded", (): void => {
    // 收集空 src 的 script 标签代码
    document.querySelectorAll("script[src=\"\"]").forEach(scriptEl => {
        inlineScripts.push(scriptEl.textContent!.trim());
        scriptEl.remove();
    });

    // 初始化 r-cp 组件模板
    document.querySelectorAll("template[r-cp]").forEach((tplEl: Element) => {
        // 获取模板元素
        const templateEl = tplEl as HTMLTemplateElement;
        const compName = templateEl.getAttribute("r-cp")?.trim();
        if (!compName) return;

        // 创建模板片段
        const templateFragment = document.createDocumentFragment();
        Array.from(templateEl.content.childNodes).forEach((node: Node) => templateFragment.appendChild(node.cloneNode(true)),);

        // 存储模板片段
        componentTemplates.set(compName, templateFragment);
        templateEl.style.display = "none";
    });

    // 获取应用根元素并创建根作用域
    const appEl = document.querySelector("[r-app]");
    const appRoot = appEl || document.body;
    const rootScope = createReactive({});
    window.__rootScope = rootScope;

    // 注入 provide 数据
    pendingProviders.forEach(([key, value]) => (rootScope as Record<string, unknown>)[key] = value);
    pendingProviders.length = 0;

    // 处理根元素的响应式绑定
    processElement(appRoot as HTMLElement, rootScope);

    // 设置 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
        const toProcess = new Set<HTMLElement>();

        mutations.forEach(mutation => {
            // 处理新增节点
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) toProcess.add(node as HTMLElement);
                else if (node.nodeType === Node.TEXT_NODE && INTERPOLATION_REGEX.test(node.textContent || "")) {
                    if (node.parentNode) toProcess.add(node.parentNode as HTMLElement);
                }
            });

            // 处理指令属性变更
            if (mutation.type === "attributes") {
                const target = mutation.target as HTMLElement;
                if (directives.has(mutation.attributeName || "")) toProcess.add(target);
            }
        });

        // 批量处理变化的元素
        batchUpdater.add(() => toProcess.forEach(el => processElement(el, rootScope)),);
    });

    // 开始监听 DOM 变化
    observer.observe(appRoot as Node, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: Array.from(directives.keys()),
    });

    // 初始化路由
    router.init();

    // 延迟执行 inline scripts 和 onMounted 回调
    setTimeout(() => {
        // 执行空 src script 标签内的代码
        inlineScripts.forEach(scriptCode => {
            try {
                const scriptFn = new Function(scriptCode);
                scriptFn();
            } catch (error) {
                console.error("[Inline Script] 执行出错:", error);
            }
        });

        // 执行 onMounted 回调
        mountedCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error("[onMounted] 回调函数执行出错:", error);
            }
        });

        // 清空队列
        mountedCallbacks.length = 0;
        inlineScripts.length = 0;
    }, 0);
});

export {};

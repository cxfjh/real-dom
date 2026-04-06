import type { ReactiveObject } from "../types";
import { INTERPOLATION_REGEX } from "../utils/constants.ts";
import { activeFns, depsMap, directives, elDeps, elUpdateFns, nodeContentMap, } from "../utils/shared.ts";
import { expressionParser } from "./expression.ts";

/**
 * 为指定 DOM 元素创建或获取缓存的更新函数
 *
 * @param el - 目标 DOM 元素
 * @param scope - 当前作用域对象
 * @returns 元素的更新函数
 */
export const createUpdateFn = (el: HTMLElement, scope: ReactiveObject = {} as ReactiveObject): Function => {
    // 缓存命中检查：无强制更新标记时直接复用
    if (elUpdateFns.has(el)) {
        const cachedFn = elUpdateFns.get(el)!;
        if (!(el as unknown as Record<string, unknown>).__forceUpdate) return cachedFn;
        (el as unknown as Record<string, unknown>).__forceUpdate = false;
    }

    // 初始化或复用依赖集合
    let deps = elDeps.get(el);
    if (!deps) {
        deps = new Set<string>();
        elDeps.set(el, deps);
    }

    // 预分类元素属性：一次遍历区分指令属性和插值属性
    const attrMap = {
        directives: [] as Array<{name: string; value: string}>,
        interpolations: [] as Array<{name: string; value: string}>,
    };

    if (el.attributes) {
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (directives.has(attr.name)) attrMap.directives.push({ name: attr.name, value: attr.value });
            else if (INTERPOLATION_REGEX.test(attr.value)) attrMap.interpolations.push({ name: attr.name, value: attr.value });
        }
    }

    // 构建更新函数
    const updateFn = (): void => {
        deps!.clear();

        // 执行指令处理器
        for (let i = 0; i < attrMap.directives.length; i++) {
            const { name: dirName, value: dirValue } = attrMap.directives[i];
            const directiveHandler = directives.get(dirName)!;
            try {
                directiveHandler(el, dirValue, scope, deps!);
            } catch (e) {
                console.error(`[createUpdateFn] 指令 "${ dirName }" 执行错误:`, e);
            }
        }

        // 解析并更新插值属性
        for (let i = 0; i < attrMap.interpolations.length; i++) {
            const { name: attrName, value: attrValue } = attrMap.interpolations[i];
            const parsedValue = expressionParser.parseText(attrValue, scope, deps!);
            if (el.getAttribute(attrName) !== parsedValue) el.setAttribute(attrName, parsedValue);
        }
    };

    // 缓存更新函数和属性分类
    (updateFn as unknown as Record<string, unknown>).__attrMap = attrMap;
    elUpdateFns.set(el, updateFn);

    // 元素销毁时清理缓存
    const cleanup = (): void => {
        elUpdateFns.delete(el);
        elDeps.delete(el);
        el.removeEventListener("beforeunload", cleanup);
    };

    if (!(el as unknown as Record<string, unknown>).__updateCleanupBound) {
        el.addEventListener("beforeunload", cleanup);
        (el as unknown as Record<string, unknown>).__updateCleanupBound = true;
    }

    return updateFn;
};


/**
 * 为包含插值的文本节点建立响应式关联
 *
 * @param node - 包含 {{}} 插值的文本节点
 * @param scope - 当前作用域对象
 */
export const processTextNode = (node: Text, scope: ReactiveObject): void => {
    if (!nodeContentMap.has(node)) nodeContentMap.set(node, node.textContent || "");

    // 创建更新函数
    const update = (): void => {
        const original = nodeContentMap.get(node) || "";
        node.textContent = expressionParser.parseText(original, scope);
    };

    // 首次执行并收集依赖
    activeFns.push(update);
    try {
        update();
    } finally {
        activeFns.pop();
    }

    // 关联依赖订阅
    const deps = new Set<string>();
    expressionParser.parseText(nodeContentMap.get(node) || "", scope, deps);
    deps.forEach(v => depsMap.get(scope)?.subscribe(update, v));
};

/**
 * 递归处理 DOM 元素树，建立响应式关联
 *
 * @param el - 根元素或文档片段
 * @param scope - 当前作用域对象
 */
export const processElement = (el: HTMLElement | DocumentFragment, scope: ReactiveObject = {} as ReactiveObject): void => {
    if (!el || (el as unknown as Record<string, unknown>).__processedcessed) return;
    (el as unknown as Record<string, unknown>).__processed = true;

    const nodeType = el.nodeType;

    // 处理元素节点：创建更新函数并执行
    if (nodeType === Node.ELEMENT_NODE) {
        const updateFn = createUpdateFn(el as HTMLElement, scope);
        activeFns.push(updateFn);
        try {
            updateFn();
        } finally {
            activeFns.pop();
        }
    }

    // 处理子文本节点中的插值
    const childNodes = el.childNodes;
    if (childNodes && childNodes.length) {
        for (let i = 0, len = childNodes.length; i < len; i++) {
            const node = childNodes[i];
            if (node.nodeType === Node.TEXT_NODE && INTERPOLATION_REGEX.test(node.textContent || "")) processTextNode(node as Text, scope);
        }
    }

    // 递归处理子元素
    if ((nodeType === Node.ELEMENT_NODE || nodeType === Node.DOCUMENT_FRAGMENT_NODE) && (el as HTMLElement).children) {
        const children = (el as HTMLElement).children;
        for (let i = 0; i < children.length; i++) processElement(children[i] as HTMLElement, scope);
    }
};

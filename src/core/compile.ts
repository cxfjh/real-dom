import type { ReactiveInterface } from "../types";
import { INTERP_REGEX } from "../utils/constants.ts";
import { activeFns, dirs, elDeps } from "../utils/shared.ts";
import { parser } from "./parser.ts";


/**
 * 为指定 DOM 元素创建或获取缓存的更新函数
 *
 * @param el - 目标 DOM 元素, 必须是 HTMLElement 实例
 * @param scope - 当前响应式作用域对象, 默认为空对象
 * @returns 更新函数, 每次调用会重新执行指令处理和插值更新
 */
export const bind = (el: HTMLElement, scope: ReactiveInterface = {} as ReactiveInterface): Function => {
    // 缓存命中检查
    if (elUpds.has(el)) {
        const cached = elUpds.get(el)!;
        if (!(el as unknown as Record<string, unknown>).__forceUpdate) return cached;
        (el as unknown as Record<string, unknown>).__forceUpdate = false;
    }

    // 初始化或复用依赖集合
    let depSet = elDeps.get(el);
    if (!depSet) {
        depSet = new Set<string>();
        elDeps.set(el, depSet);
    }

    // 预分类元素属性
    const attrGroups = { directives: [] as Array<{name: string; value: string}>, interpolations: [] as Array<{name: string; value: string}>, };
    if (el.attributes) {
        for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (dirs.has(attr.name)) attrGroups.directives.push({ name: attr.name, value: attr.value });
            else if (INTERP_REGEX.test(attr.value)) attrGroups.interpolations.push({ name: attr.name, value: attr.value });
        }
    }

    /**
     * 执行元素的指令和插值更新
     */
    const update = (): void => {
        // 清空旧依赖, 每次更新时重新收集
        depSet!.clear();

        activeFns.push(update);

        try {
            // 每个指令处理器内部通过 parser 访问 scope, 自动完成依赖收集
            for (let i = 0; i < attrGroups.directives.length; i++) {
                const { name, value } = attrGroups.directives[i];
                const directiveHandler = dirs.get(name)!;
                try {
                    directiveHandler(el, value, scope, depSet!);
                } catch (e) {
                    console.error(`[update] 指令 "${ name }" 执行错误:`, e);
                }
            }

            // 解析并更新插值属性
            for (let i = 0; i < attrGroups.interpolations.length; i++) {
                const { name, value } = attrGroups.interpolations[i];
                const parsedValue = parser.text(value, scope, depSet!);
                if (el.getAttribute(name) !== parsedValue) el.setAttribute(name, parsedValue);
            }
        } finally {
            // 避免栈状态异常导致后续依赖收集错乱
            activeFns.pop();
        }
    };

    // 缓存更新函数到 WeakMap
    elUpds.set(el, update);

    /**
     * 元素销毁时清理缓存
     */
    const cleanup = (): void => {
        elUpds.delete(el);
        elDeps.delete(el);
        el.removeEventListener("beforeunload", cleanup);
    };

    // 确保每个元素只绑定一次清理事件
    if (!(el as unknown as Record<string, unknown>).__updateCleanupBound) {
        el.addEventListener("beforeunload", cleanup);
        (el as unknown as Record<string, unknown>).__updateCleanupBound = true;
    }

    return update;
};


/**
 * 为包含插值的文本节点建立响应式关联
 *
 * @param node - 包含 `{{ }}` 插值语法的文本节点
 * @param scope - 当前响应式作用域对象
 */
export const bindText = (node: Text, scope: ReactiveInterface): void => {
    // 缓存原始模板内容
    if (!textCache.has(node)) textCache.set(node, node.textContent || "");

    /**
     * 更新文本节点的插值内容
     */
    const update = (): void => {
        const original = textCache.get(node) || "";
        activeFns.push(update);
        try {
            node.textContent = parser.text(original, scope);
        } finally {
            activeFns.pop();
        }
    };

    // 首次执行并完成依赖收集
    update();
};


/**
 * 递归处理 DOM 元素树, 建立响应式关联
 *
 * @param el - 根元素 (HTMLElement) 或文档片段 (DocumentFragment)
 * @param scope - 当前响应式作用域对象, 默认为空对象
 */
export const compile = (el: HTMLElement | DocumentFragment, scope: ReactiveInterface = {} as ReactiveInterface): void => {
    // 防止重复处理
    if (!el || (el as unknown as Record<string, unknown>).__processed) return;
    (el as unknown as Record<string, unknown>).__processed = true;
    const nodeType = el.nodeType;

    // 跳过 <script> 和 <style> 元素, 避免把脚本/样式内容当模板解析
    if (nodeType === Node.ELEMENT_NODE) {
        const tag = (el as HTMLElement).tagName;
        if (tag === "SCRIPT" || tag === "STYLE") return;
        bind(el as HTMLElement, scope)();
    }

    // 处理子文本节点中的插值
    const childNodes = el.childNodes;
    if (childNodes && childNodes.length) {
        for (let i = 0, len = childNodes.length; i < len; i++) {
            const node = childNodes[i];
            if (node.nodeType === Node.TEXT_NODE && INTERP_REGEX.test(node.textContent || "")) bindText(node as Text, scope);
        }
    }

    // 递归处理子元素
    if ((nodeType === Node.ELEMENT_NODE || nodeType === Node.DOCUMENT_FRAGMENT_NODE) && (el as HTMLElement).children) {
        const children = (el as HTMLElement).children;
        for (let i = 0; i < children.length; i++) compile(children[i] as HTMLElement, scope);
    }
};


/**
 * 文本节点原始内容缓存
 */
const textCache = new WeakMap<Node, string>();


/**
 * 元素更新函数缓存
 */
const elUpds = new WeakMap<HTMLElement, Function>();

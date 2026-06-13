import type { ReactiveInterface } from "../types";
import { INTERP_REGEX } from "./constants.ts";
import { dirs, rootScope } from "./shared.ts";
import { batch, compile } from "../core";


/**
 * 指令通用初始化工具
 *
 * @param el      - 目标 DOM 元素
 * @param expr    - 指令表达式字符串
 * @param scope   - 当前响应式作用域, 用于表达式解析
 * @param dirName - 指令名称, 仅用于 warn 日志中的标识
 * @param flag    - 唯一标记后缀
 * @returns `true` 表示通过校验, 应继续执行指令逻辑; `false` 表示应终止指令处理
 */
export const initDir = (el: HTMLElement, expr: string, scope: ReactiveInterface | null | undefined, dirName: string, flag: string): boolean => {
    // 表达式为空或仅含空白字符时, 指令无执行意义
    if (!expr || expr.trim() === "") {
        console.warn(`[${ dirName }] 表达式不能为空`);
        return false;
    }

    // 作用域无效时无法解析表达式中的变量, 提前终止
    if (!scope || typeof scope !== "object") {
        console.warn(`[${ dirName }] 作用域无效`);
        return false;
    }

    // 生成唯一标记键名
    const key = `__${ flag }Processed`;
    if ((el as unknown as Record<string, unknown>)[key]) return false;

    // 打上已处理标记, 后续调用直接命中上面的检查, 跳过重复处理
    (el as unknown as Record<string, unknown>)[key] = true;
    return true;
};


/**
 * 全局元素移除监听器
 */
const remWatcher: {elMap: WeakMap<HTMLElement, Set<() => void>>; obs: MutationObserver | null; tid: ReturnType<typeof setTimeout> | null; count: number;} = {
    elMap: new WeakMap(),
    obs: null,
    tid: null,
    count: 0,
};


/**
 * 处理 MutationObserver 回调
 *
 * @param mutations - 浏览器传入的 MutationRecord 数组, 存储到闭包中
 */
const onMutate = (mutations: MutationRecord[]): void => {
    // 已有待处理的合批任务, 本轮 mutations 将被一并处理, 直接返回
    if (remWatcher.tid !== null) return;

    // 设置异步合批定时器, 延迟到当前事件循环之后执行
    remWatcher.tid = setTimeout(() => {
        // 清除定时器标记, 允许后续 mutation 触发新的合批
        remWatcher.tid = null;
        const { elMap } = remWatcher;

        // 收集所有已脱离 DOM 且注册了清理回调的元素
        const removed: Array<[HTMLElement, Set<() => void>]> = [];

        // 遍历所有积压的 mutation records
        for (let i = 0; i < mutations.length; i++) {
            const m = mutations[i];
            for (let j = 0; j < m.removedNodes.length; j++) collectAndCheck(m.removedNodes[j], elMap, removed);
        }

        // 统一执行清理, 先收集完再执行, 避免在执行回调时修改数据结构
        for (let i = 0; i < removed.length; i++) {
            const [el, cbs] = removed[i];
            elMap.delete(el);  // 从 WeakMap 中移除, 释放对元素的引用
            remWatcher.count -= cbs.size;  // 递减全局计数器
            for (const cb of cbs) {
                try {
                    cb();
                } catch (_) {
                    // 静默吞掉清理回调中的异常, 确保一个回调的异常不影响其他回调
                }
            }
        }

        // 所有回调已清理完毕, 如果没有任何待清理的元素, 释放 observer 资源
        if (remWatcher.count <= 0 && remWatcher.obs) {
            remWatcher.obs.disconnect();
            remWatcher.obs = null;
        }

        // 清空 mutations 数组, 释放对 MutationRecord 的引用
        mutations.length = 0;
    });
};


/**
 * 递归收集元素及其子树中所有被追踪的已脱离节点
 *
 * @param node    - mutation.removedNodes 中的单个节点
 * @param elMap   - 元素到回调集合的映射 (从 `remWatcher` 传入)
 * @param removed - 收集结果数组, 元素为单位 [HTMLElement, Set<回调函数>]
 */
const collectAndCheck = (node: Node, elMap: WeakMap<HTMLElement, Set<() => void>>, removed: Array<[HTMLElement, Set<() => void>]>): void => {
    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const cbs = elMap.get(el);

        // 元素已脱离 DOM 且注册了清理回调, 加入待清理列表
        if (cbs && !el.isConnected) removed.push([el, cbs]);

        // 递归检查子树中的所有后代元素
        _checkChildren(el, elMap, removed);
    } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        // DocumentFragment 被移除: 遍历其子元素
        const children = (node as DocumentFragment).children;
        for (let i = 0; i < children.length; i++) collectAndCheck(children[i], elMap, removed);
    }
};


/**
 * 遍历元素子树, 收集所有被追踪的已脱离节点
 *
 * @param el      - 要遍历子树的根元素
 * @param elMap   - 元素到回调集合的映射
 * @param removed - 收集结果数组, 元素为单位 [HTMLElement, Set<回调函数>]
 */
const _checkChildren = (el: HTMLElement, elMap: WeakMap<HTMLElement, Set<() => void>>, removed: Array<[HTMLElement, Set<() => void>]>,): void => {
    // TreeWalker 是深度优先遍历, 与 DOM 树的自然结构一致
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT);

    // 从根元素的第一个子元素开始遍历
    let child = walker.nextNode() as HTMLElement | null;

    while (child) {
        // 检查当前子孙元素是否注册了清理回调
        const cbs = elMap.get(child);

        // 元素已脱离 DOM 且有清理回调, 加入待清理列表
        if (cbs && !child.isConnected) removed.push([child, cbs]);

        // 移动到下一个元素 (深度优先)
        child = walker.nextNode() as HTMLElement | null;
    }
};


/**
 * 注册元素移除时的清理回调 — 自动资源管理
 *
 * @param el      - 要监听的 DOM 元素
 * @param cleanup - 元素被移除时执行的清理函数, 通常包含取消订阅、清空缓存等操作
 */
export const onElRemove = (el: HTMLElement, cleanup: () => void) => {
    // 获取或创建该元素的回调集合
    let cbs = remWatcher.elMap.get(el);
    if (!cbs) {
        cbs = new Set();
        remWatcher.elMap.set(el, cbs);
    }

    // 将清理回调加入集合, 同一元素可注册多个回调
    cbs.add(cleanup);

    // 递增全局计数器, 用于判断是否需要保持 observer
    remWatcher.count++;

    // 按需启动全局 observer: 仅在首次注册时创建
    if (!remWatcher.obs) {
        remWatcher.obs = new MutationObserver(onMutate);

        // 监听整个 document 的子树变更, 这是唯一能捕获任意位置元素被移除的方式
        remWatcher.obs.observe(document, { childList: true, subtree: true });
    }
};


/**
 * 作用域 key 缓存 — 避免重复遍历原型链
 */
const _mergedKeys = new WeakMap<object, string[]>();


/**
 * 校验字符串是否为合法的 JavaScript 标识符
 *
 * @param key 待校验的字符串
 * @returns {boolean} 合法返回 true，非法返回 false
 */
const isValidIdentifier = (key: string): boolean => {
    if (!key) return false;
    const first = key.charCodeAt(0);
    if (!((first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 95 || first === 36)) return false;
    for (let i = 1; i < key.length; i++) {
        const c = key.charCodeAt(i);
        if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95 || c === 36)) return false;
    }
    return true;
};


/**
 * 收集作用域的所有可枚举 key — 包括原型链
 *
 * @param scope - 作用域对象, 可能是通过 Object.create 创建的子作用域
 * @returns 合并后的 key 列表, 自有 key 排在前面, 仅包含合法 JS 标识符
 */
export const getKeys = (scope: object): string[] => {
    // 缓存命中, 直接返回之前计算的结果
    const cached = _mergedKeys.get(scope);
    if (cached) return cached;

    /**
     * 过滤掉非法的 JavaScript 标识符
     *
     * @param arr 待过滤的字符串数组
     * @returns 过滤后的合法字符串数组
     */
    const filter = (arr: string[]): string[] => {
        const result: string[] = [];
        for (let i = 0; i < arr.length; i++) if (isValidIdentifier(arr[i])) result.push(arr[i]);
        return result;
    };

    // 收集自有 key
    const rawOwnKeys = Object.keys(scope);
    const proto = Object.getPrototypeOf(scope);

    // 无原型链或原型为 Object.prototype, 直接返回过滤后的自有 key
    if (!proto || proto === Object.prototype) return filter(rawOwnKeys);

    // 遍历原型链收集所有 key, 使用 Set 去重
    const seen = new Set(rawOwnKeys);
    const merged = rawOwnKeys.slice();  // 自有 key 排在前面
    let p: object | null = proto;
    while (p && p !== Object.prototype) {
        const pk = Object.keys(p);
        for (let i = 0; i < pk.length; i++) {
            if (!seen.has(pk[i])) {
                seen.add(pk[i]);
                merged.push(pk[i]);
            }
        }
        p = Object.getPrototypeOf(p);
    }

    // 缓存过滤后的结果, 下次直接返回
    const filtered = filter(merged);
    _mergedKeys.set(scope, filtered);
    return filtered;
};


/**
 * 全局 DOM 变更监听器 — 动态编译新增的 DOM 节点
 */
export const observer = new MutationObserver((mutations) => {
    const toProcess = new Set<HTMLElement>();

    mutations.forEach(mutation => {
        // 处理新增节点: 元素节点直接加入处理集合, 文本节点检查是否包含插值
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) toProcess.add(node as HTMLElement);
            else if (node.nodeType === Node.TEXT_NODE && INTERP_REGEX.test(node.textContent || "")) {
                if (node.parentNode) toProcess.add(node.parentNode as HTMLElement);
            }
        });

        // 处理指令属性变更, 当元素的 r-xxx 属性被动态修改时, 重新编译
        if (mutation.type === "attributes") {
            const target = mutation.target as HTMLElement;
            if (dirs.has(mutation.attributeName || "")) toProcess.add(target);
        }
    });

    // 批量处理变化的元素, 通过 batch 合并同一帧内的多次变更
    batch.add(() => toProcess.forEach(el => compile(el, rootScope!)));
});

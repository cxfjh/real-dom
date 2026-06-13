import type { ReactiveInterface } from "../types";
import { activeFns, depMap, elDeps } from "../utils/shared.ts";
import { compile, parser } from "../core";
import { regDir } from "./regDir.ts";
import { initDir, onElRemove } from "../utils/directive.ts";
import { RealDom } from "../core/realdom.ts";


/**
 * 注册 r-api 指令
 *
 * @param el - 指令元素
 * @param expr - 表达式字符串, 解析后得到 API URL
 * @param scope - 指令作用域, 数据将注入到此作用域的扩展中
 * @param deps - 依赖项集合, 用于追踪表达式中的响应式变量
 */
regDir("r-api", async (el: HTMLElement, expr: string, scope: ReactiveInterface, deps: Set<string>): Promise<void> => {
    // 同一元素上的 r-api 指令仅执行一次
    if (!initDir(el, expr, scope, "r-api", "rApi")) return;

    // 数据状态管理
    let loaded = false;
    let data: unknown = null;
    let prevData: unknown = null;

    // 节点缓存
    const cache = new Map<string, {el: DocumentFragment; scope: ReactiveInterface}>();

    // 缓存原始模板 HTML, 用于创建新的模板实例
    const tplHTML = el.innerHTML;

    // 静态配置提取
    const keyAttr = el.getAttribute("key") || "id";          // 数组项的唯一标识字段, 默认 "id"
    const valueAttr = el.getAttribute("value") || "value";    // 数据值在作用域中的别名, 默认 "value"
    const indexAttr = el.getAttribute("index") || "index";    // 索引在作用域中的别名, 默认 "index"
    const listAttr = el.getAttribute("list");                  // 从响应 JSON 中提取列表的路径, 如 "data.items"
    const arrAttr = el.getAttribute("arr");                    // 数组数据在作用域中的变量名, 如 "users"
    const manualMode = el.hasAttribute("manual");              // 手动加载模式, 不自动发起请求

    // 动态配置解析
    const parseDynamicConfig = () => ({ refresh: parser.text(el.getAttribute("refresh") || "", scope, deps), });
    let config = parseDynamicConfig();

    /**
     * 创建基础作用域
     *
     * @param d - 要注入到作用域的数据, 赋值给 arrAttr 变量
     * @returns 新的响应式作用域对象
     */
    const createScope = (d: unknown) => {
        const baseScope: Record<string, unknown> = { ...scope, _manual: loaded };
        if (arrAttr) baseScope[arrAttr] = d;
        return RealDom.reactive(baseScope);
    };

    /**
     * 渲染数组数据 — 带缓存的列表渲染
     *
     * @param arr  - 要渲染的数组
     * @param frag - 目标 DocumentFragment, 渲染结果追加到此片段
     */
    const renderArray = (arr: unknown[], frag: DocumentFragment): void => {
        // 记录本次渲染用到的 key, 用于后续清理缓存中已移除的项
        const usedKeys = new Set<string>();

        // 遍历数组为每项创建或复用缓存节点
        for (let i = 0; i < arr.length; i++) {
            const item = arr[i] as Record<string, unknown>;

            // 使用 key 属性获取唯一标识, 回退到数组索引
            const itemKey = String(item[keyAttr] ?? i);
            usedKeys.add(itemKey);

            let cached = cache.get(itemKey);
            if (cached) {
                // 缓存命中更新作用域数据, 克隆节点复用
                cached.scope[valueAttr] = item;
                cached.scope[indexAttr] = i;
                (cached.scope as unknown as Record<string, unknown>)._manual = loaded;
                frag.appendChild(cached.el.cloneNode(true));
            } else {
                // 缓存未命中创建新的模板实例
                const tempContainer = document.createElement("div");
                tempContainer.innerHTML = tplHTML;

                // 创建新作用域, 注入 value 和 index
                const itemScope = RealDom.reactive({ ...scope, [valueAttr]: item, [indexAttr]: i, _manual: loaded, });

                // 编译模板, 建立响应式关联
                compile(tempContainer, itemScope);

                // 创建 DocumentFragment, 将编译后的 DOM 移入
                const itemFrag = document.createDocumentFragment();
                moveChild(tempContainer, itemFrag);

                // 缓存新创建的节点和作用域, 后续渲染时复用
                cached = { el: itemFrag, scope: itemScope };
                cache.set(itemKey, cached);
                frag.appendChild(itemFrag.cloneNode(true));
            }
        }

        // 裁剪缓存
        for (const key of cache.keys()) if (!usedKeys.has(key)) cache.delete(key);
    };

    /**
     * 渲染对象数据 — 单次模板实例化
     *
     * @param obj  - 要渲染的对象, 会作为 value 属性注入到作用域
     * @param frag - 目标 DocumentFragment
     */
    const renderObject = (obj: unknown, frag: DocumentFragment): void => {
        const objScope = RealDom.reactive({ ...scope, [valueAttr]: obj, _manual: loaded });
        const tempContainer = document.createElement("div");
        tempContainer.innerHTML = tplHTML;
        compile(tempContainer, objScope);
        moveChild(tempContainer, frag);
    };

    /**
     * 渲染函数
     *
     * @param d - 要渲染的数据, 可以是数组、对象、null 或 undefined
     */
    const render = (d: unknown): void => {
        // 快速深度比较 数据未变化时跳过渲染, 避免不必要的 DOM 操作
        if (fastEqual(d, prevData)) return;

        // 清空元素内容, 准备重新渲染
        el.textContent = "";
        const fragment = document.createDocumentFragment();

        // 根据数据类型选择渲染策略
        if (arrAttr) {
            // arr 模式: 将数组数据注入到指定变量名, 使用模板编译
            const baseScope = createScope(d);
            const tempContainer = document.createElement("div");
            tempContainer.innerHTML = tplHTML;
            compile(tempContainer, baseScope);
            moveChild(tempContainer, fragment);
        } else if (Array.isArray(d)) renderArray(d, fragment); // 数组模式: 带缓存的列表渲染, 按 key 复用节点
        else if (d && typeof d === "object") renderObject(d, fragment); // 对象模式: 单次模板实例化, 对象作为 value 属性注入

        // 一次性追加所有子节点到 DOM, 减少重排次数
        el.appendChild(fragment);
        prevData = d;
    };

    /**
     * 发起 API 请求并渲染结果
     */
    const fetchData = async (): Promise<void> => {
        // 重新解析动态配置, 确保 method 和 refresh 反映最新的响应式值
        config = parseDynamicConfig();

        // 请求中状态, loaded=false, 模板可通过 _manual 显示加载中 UI
        loaded = false;
        render(data);

        try {
            // 解析 API URL 表达式
            const url = String(parser.parse(expr.trim(), scope, deps));
            if (!url) new Error("API URL 不能为空");

            // 解析 method 属性, 默认 GET
            const method = String(parser.parse(el.getAttribute("method") || "GET", scope, deps));

            // 构建请求体, 仅 POST/PUT/PATCH 方法携带 body
            const hasBody = BODY_METHODS.has(method);
            const body = hasBody ? JSON.stringify(parser.parse(el.getAttribute("data-body") || "{}", scope, deps)) : null;

            // 请求头, 支持表达式, 默认 Content-Type: application/json
            const headers = parser.parse(el.getAttribute("headers") || "{'Content-Type': 'application/json'}", scope, deps) as HeadersInit;
            const response = await fetch(url, { method, headers, body });

            // 处理非 2xx 响应状态
            if (!response.ok) new Error(`请求失败: ${ response.status } ${ response.statusText }`);

            // 解析 JSON 响应体
            const resData = await response.json();

            // 如果指定了 list 属性, 从响应中提取嵌套的列表数据
            data = listAttr ? (resData as Record<string, unknown>)[listAttr] : resData;

            // 请求成功, 更新数据并渲染
            loaded = true;
            render(data);
        } catch (error) {
            console.error("[r-api] 请求错误:", (error as Error).message);
            // 异常时仍设置 loaded = true, 避免永久显示加载中状态
            loaded = true;
            render(data);
        }
    };

    /**
     * 手动加载模式的初始渲染
     */
    const init = (): void => {
        // 创建初始作用域
        const initScope = createScope(null);
        const fragment = document.createDocumentFragment();
        const itemFragment = document.createDocumentFragment();

        // 克隆子节点到 itemFragment, 保留原始模板结构
        const children = el.childNodes;
        for (let i = 0; i < children.length; i++) itemFragment.appendChild(children[i].cloneNode(true));
        fragment.appendChild(itemFragment);

        // 在 activeFns 上下文中编译, 确保依赖收集正确
        activeFns.push((): void => compile(fragment as unknown as HTMLElement, initScope));
        try {
            activeFns[activeFns.length - 1]();
        } finally {
            activeFns.pop(); // 编译完成后弹出, 依赖已收集完毕
        }

        // 清空旧节点缓存, 追加编译后的内容
        el.textContent = "";
        el.appendChild(fragment);

        // 渲染空状态
        render(null);
    };

    // 刷新按钮绑定
    const refreshSelector = config.refresh;
    if (refreshSelector) {
        // 使用 document.querySelector 查找刷新按钮
        const refreshBtn = document.querySelector(refreshSelector);

        // 防止重复绑定, 使用 __apiRefreshHandler 标记
        if (refreshBtn && !(refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler) {
            const refreshHandler = async () => await fetchData();
            (refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler = refreshHandler;
            refreshBtn.addEventListener("click", refreshHandler as EventListener);

            // 元素移除时自动解绑刷新按钮事件
            onElRemove(el, () => {
                refreshBtn.removeEventListener("click", refreshHandler as EventListener);
                (refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler = undefined;
            });
        }
    }

    // 首次执行 + 依赖收集
    activeFns.push(fetchData);
    try {
        if (manualMode) init(); // 手动模式, 仅渲染空模板, 不发起请求
        else await fetchData(); // 自动模式, 立即发起请求, 渲染数据
    } catch (error) {
        console.error("[r-api] 初始化错误:", (error as Error).message);
        el.textContent = "";
    } finally {
        activeFns.pop();
    }

    // 元素移除时清理
    onElRemove(el, () => {
        // 清空节点缓存, 释放内存
        cache.clear();

        // 从依赖管理器中取消订阅, 防止内存泄漏
        const depsSet = elDeps.get(el);
        if (depsSet) {
            depsSet.forEach(varName => depMap.get(scope)?.unsubscribe(fetchData, varName));
            elDeps.delete(el);
        }

        // 清空数据引用, 帮助 GC
        data = null;
        prevData = null;
    });
});


/**
 * 需要请求体的 HTTP 方法集合
 */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);


/**
 * 快速深度相等比较
 *
 * @param a - 比较值 A, 可以是任意类型
 * @param b - 比较值 B, 必须与 A 同类型才可能深度相等
 * @param depth - 当前递归深度 (内部使用), 从 0 开始, 最大 50
 * @returns `true` 表示两个值深度相等, `false` 表示不相等
 */
const fastEqual = (a: unknown, b: unknown, depth = 0): boolean => {
    // 最大递归深度 50, 防止循环引用导致栈溢出
    if (depth > 50) return a === b;
    if (a === b) return true;
    if (a == null || b == null || typeof a !== typeof b) return false;

    // 数组比较, 逐元素递归比较
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (!fastEqual(a[i], b[i], depth + 1)) return false;
        return true;
    }

    // 对象比较, 比较键数量, 然后逐键递归比较值
    if (typeof a === "object" && typeof b === "object") {
        const keysA = Object.keys(a as Record<string, unknown>);
        const keysB = Object.keys(b as Record<string, unknown>);

        // 键数量不同, 不可能相等
        if (keysA.length !== keysB.length) return false;
        for (let i = 0; i < keysA.length; i++) {
            const k = keysA[i];

            // 使用 hasOwnProperty 确保只比较自有属性, 不涉及原型链
            if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
            if (!fastEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], depth + 1)) return false;
        }
        return true;
    }

    return false;
};


/**
 * 移动子节点到目标 DocumentFragment
 *
 * @param from - 源节点, 其子节点将被移出
 * @param to - 目标 DocumentFragment, 接收移动过来的子节点
 */
const moveChild = (from: Node, to: DocumentFragment): void => {
    const children = from.childNodes;
    let child = children[0];
    while (child) {
        to.appendChild(child);
        child = children[0];
    }
};


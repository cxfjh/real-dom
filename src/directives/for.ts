import type { ReactiveInterface } from "../types";
import { activeFns, depMap, elDeps } from "../utils/shared.ts";
import { compile, parser } from "../core";
import { regDir } from "./regDir.ts";
import { initDir, onElRemove } from "../utils/directive.ts";
import { RealDom } from "../core/realdom.ts";


/**
 * 注册 r-for 指令
 *
 * @param el    - 循环模板元素, 其内部 HTML 作为模板
 * @param expr  - 循环表达式, 解析后应为数组或数字
 * @param scope - 父级作用域, 循环项通过原型链继承此作用域
 * @param deps  - 依赖收集容器, 用于追踪表达式中引用的响应式变量
 */
regDir("r-for", (el: HTMLElement, expr: string, scope: ReactiveInterface, deps: Set<string>): void => {
    if (!initDir(el, expr, scope, "r-for", "rFor")) return;

    // 缓存原始模板 HTML, 后续更新时不再从 DOM 读取
    const tplHTML = el.innerHTML.trim();
    if (!tplHTML) return void console.warn("[r-for] 模板不能为空");

    // 读取自定义变量名和参数, 提供合理的默认值
    const indexVar = el.getAttribute("index") || "index";     // 索引变量名, 默认 "index"
    const valueVar = el.getAttribute("value") || "value";     // 值变量名, 默认 "value"
    const keyAttr = el.getAttribute("key") || "id";            // 唯一标识字段, 默认 "id"
    const startOffset = parseInt(el.getAttribute("start") || "0", 10) || 0;  // 起始偏移量, 默认 0

    // 缓存元素上的非 r-for 专用属性, 排除 r-for 专用的属性和 class/style
    const baseAttrs: Record<string, string> = {};
    const attrList = el.attributes;
    for (let i = 0; i < attrList.length; i++) {
        const name = attrList[i].name;
        if (name === "r-for" || name === "index" || name === "value" || name === "key" || name === "start" || name === "class" || name === "style") continue;
        baseAttrs[name] = parser.text(attrList[i].value.trim(), scope, deps);
    }

    // 预提取 entries 和 count, 避免每次 createItem 时重复计算
    const _attrEntries = Object.entries(baseAttrs);
    const _attrCount = _attrEntries.length;

    // 缓存元素的 class 和 style, 还原到每个循环项的临时容器上
    const cls = el.className.trim();
    const style = el.style.cssText.trim();

    /**
     * 模板片段缓存
     */
    let _tplFrag: DocumentFragment | null = null;
    const _getTplClone = (): DocumentFragment => {
        if (!_tplFrag) {
            // 首次解析, 将 HTML 字符串解析为 DOM 节点, 存入 DocumentFragment
            const div = document.createElement("div");
            div.innerHTML = tplHTML;
            _tplFrag = document.createDocumentFragment();

            // 移动所有子节点到 Fragment
            while (div.firstChild) _tplFrag.appendChild(div.firstChild);
        }

        // 后续复用
        return _tplFrag.cloneNode(true) as DocumentFragment;
    };

    // 对象类型数组项的临时 ID 计数器, 自增确保唯一性
    let nextObjId = 0;

    /**
     * 生成数组项的唯一 key
     *
     * @param item  - 数组项, 可以是对象或基础类型
     * @param index - 数组项在数组中的索引
     * @returns 唯一标识字符串, 用于缓存查找
     */
    const getKey = (item: unknown, index: number): string => {
        if (item && typeof item === "object") {
            // 对象类型, 优先使用 key 属性值
            const keyVal = (item as Record<string, unknown>)[keyAttr];
            if (keyVal !== undefined) return String(keyVal);

            // 无 key 属性, 使用 WeakMap 分配临时 ID
            let id = objIdMap.get(item as object);
            if (id === undefined) {
                id = nextObjId++;
                objIdMap.set(item as object, id);
            }

            return "$" + id;
        }

        // 基础类型
        return String(index) + ":" + String(item);
    };

    /**
     * 节点缓存
     */
    const cache = new Map<string, {nodes: Node[]; itemScope: ReactiveInterface}>();

    // 记录上一次渲染的数据 key 集合, 用于裁剪缓存
    let prevKeys = new Set<string>();

    /**
     * 创建一个循环项的响应式作用域和 DOM 节点
     *
     * @param value - 当前项的值, 注入到 `valueVar` 变量
     * @param index - 当前项的索引 (含 startOffset), 注入到 `indexVar` 变量
     * @returns 包含 nodes 和 itemScope 的缓存条目
     */
    const createItem = (value: unknown, index: number): {nodes: Node[]; itemScope: ReactiveInterface} => {
        // 创建临时容器, 还原 class、style 和基础属性
        const tempContainer = document.createElement("div");
        if (cls) tempContainer.className = cls;
        if (style) tempContainer.style.cssText = style;

        // 设置基础属性, 使用预提取的 entries 数组, 避免每次遍历
        for (let i = 0; i < _attrCount; i++) tempContainer.setAttribute(_attrEntries[i][0], _attrEntries[i][1]);

        // 克隆模板片段并追加到临时容器
        tempContainer.appendChild(_getTplClone());

        // 通过原型链继承父作用域, 避免拷贝所有 key
        const childObj = Object.create(scope) as Record<string, unknown>;
        childObj[indexVar] = index;
        childObj[valueVar] = value;
        const itemScope = RealDom.reactive(childObj);

        // 编译模板, 建立响应式绑定
        compile(tempContainer, itemScope);

        // 提取编译后的 DOM 节点, 转为数组以便后续移动操作
        const nodes = Array.from(tempContainer.childNodes);
        return { nodes, itemScope };
    };

    /**
     * 核心更新函数
     */
    const update = (): void => {
        // 解析表达式, 支持数组和数字两种结果
        let parsed: unknown;
        try {
            parsed = parser.parse(expr.trim(), scope, deps);
        } catch (err) {
            console.error("[r-for] 表达式解析错误:", { expr: expr.trim(), error: (err as Error).message });
            return;
        }

        // 数字模式
        if (typeof parsed === "number" && !Array.isArray(parsed)) {
            const count = Math.max(0, Math.floor(parsed) || 0);  // 确保 count >= 0 且为整数
            const fragment = document.createDocumentFragment();

            for (let i = 0; i < count; i++) {
                const key = String(i);              // 数字模式: key 就是索引
                const displayIndex = i + startOffset; // 实际显示的索引值
                let entry = cache.get(key);

                if (entry) {
                    // 缓存命中, 仅更新作用域数据, 节点直接移动复用
                    entry.itemScope[indexVar] = displayIndex;
                    entry.itemScope[valueVar] = displayIndex;
                    const frag = document.createDocumentFragment();
                    for (let j = 0; j < entry.nodes.length; j++) frag.appendChild(entry.nodes[j]);
                    fragment.appendChild(frag);
                } else {
                    // 缓存未命中, 创建新循环项并缓存
                    entry = createItem(displayIndex, displayIndex);
                    cache.set(key, entry);
                    const frag = document.createDocumentFragment();
                    for (let j = 0; j < entry.nodes.length; j++) frag.appendChild(entry.nodes[j]);
                    fragment.appendChild(frag);
                }
            }

            // 裁剪缓存
            for (const key of prevKeys) if (Number(key) >= count) cache.delete(key);
            prevKeys.clear();
            for (let i = 0; i < count; i++) prevKeys.add(String(i));

            // 一次性替换所有子节点, 减少重排
            el.replaceChildren(fragment);
            return;
        }

        // 数组模式
        if (Array.isArray(parsed)) {
            const arr = parsed;
            const len = arr.length;
            const fragment = document.createDocumentFragment();
            const currKeys = new Set<string>();  // 记录本次渲染的 key 集合

            for (let i = 0; i < len; i++) {
                const item = arr[i];
                const key = getKey(item, i);       // 生成唯一 key
                const displayIndex = i + startOffset; // 实际显示的索引值
                currKeys.add(key);

                let entry = cache.get(key);
                if (entry) {
                    // 缓存命中, 更新作用域数据, 响应式系统自动驱动 DOM 精准更新
                    entry.itemScope[indexVar] = displayIndex;
                    entry.itemScope[valueVar] = item;
                    const frag = document.createDocumentFragment();
                    for (let j = 0; j < entry.nodes.length; j++) frag.appendChild(entry.nodes[j]);
                    fragment.appendChild(frag);
                } else {
                    // 缓存未命中, 创建新循环项
                    entry = createItem(item, displayIndex);
                    cache.set(key, entry);
                    const frag = document.createDocumentFragment();
                    for (let j = 0; j < entry.nodes.length; j++) frag.appendChild(entry.nodes[j]);
                    fragment.appendChild(frag);
                }
            }

            // 裁剪缓存
            for (const key of prevKeys) if (!currKeys.has(key)) cache.delete(key);
            prevKeys = currKeys;
            el.replaceChildren(fragment);
            return;
        }

        // 不支持的表达式类型, 既不是数字也不是数组
        console.warn("[r-for] 表达式必须解析为数字或数组, 实际类型:", typeof parsed);
    };

    // 依赖收集 + 首次执行
    activeFns.push(update);
    try {
        update();
    } catch (error) {
        console.error("[r-for] 初始化错误:", (error as Error).message);
        el.textContent = "";
    } finally {
        activeFns.pop();
    }

    // 订阅父作用域变量
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depMap.get(scope)?.subscribe(update, varName));

    // 元素移除时清理
    onElRemove(el, () => {
        // 销毁每个缓存项的作用域, 从 DOM 移除节点 + 调用 destroy 生命周期
        for (const [, entry] of cache) {
            // 移除 DOM 节点, 从父节点中移除, 避免 DOM 残留
            for (let i = 0; i < entry.nodes.length; i++) {
                const parent = entry.nodes[i].parentNode;
                if (parent) parent.removeChild(entry.nodes[i]);
            }

            // 调用 destroy 生命周期方法
            const ds = entry.itemScope as Record<string, unknown> & {destroy?: () => void};
            if (typeof ds.destroy === "function") ds.destroy();
        }

        // 清空缓存和 key 集合, 释放内存
        cache.clear();
        prevKeys.clear();

        // 取消所有依赖订阅, 防止内存泄漏
        const depsSet = elDeps.get(el);
        if (depsSet) {
            depsSet.forEach(varName => depMap.get(scope)?.unsubscribe(update, varName));
            elDeps.delete(el);
        }

        // 重置处理标记, 允许 SPA 路由返回时重新挂载
        (el as unknown as Record<string, unknown>).__forProcessed = false;
    });
});


/**
 * 对象类型数组项的临时 ID 映射表
 */
const objIdMap = new WeakMap<object, number>();

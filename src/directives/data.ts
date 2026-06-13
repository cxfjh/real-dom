import type { ReactiveInterface } from "../types";
import { activeFns, depMap, elDeps } from "../utils/shared.ts";
import { compile, Dep, parser } from "../core";
import { regDir } from "./regDir.ts";
import { initDir, onElRemove } from "../utils/directive.ts";


/**
 * 注册 r-data 指令
 *
 * @param el    - 指令绑定的 DOM 元素, 其 innerHTML 作为模板
 * @param expr  - 数据表达式字符串
 * @param scope - 父级作用域对象, 表达式在此作用域中求值
 * @param deps  - 依赖收集容器, 用于追踪表达式中引用的父作用域变量
 */
regDir("r-data", (el: HTMLElement, expr: string, scope: ReactiveInterface, deps: Set<string>,): void => {
    // 防重复初始化, 若已处理过或标记为跳过, 直接返回
    if (!initDir(el, expr, scope, "r-data", "rData")) return;
    const trimmedExpr = expr.trim();

    // 保存元素的 class, style 和静态属性, 用于后续重建 DOM 时恢复
    const cls = el.className.trim();
    const style = el.style.cssText.trim();

    // 分离静态属性和动态属性 (含 {{ }} 插值的为动态)
    const staticAttrs: Record<string, string> = {};
    const dynamicAttrs: Record<string, string> = {};

    const attrs = el.attributes;
    for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        // 跳过指令属性本身和 class/style
        if (SKIP_ATTRS.has(attr.name)) continue;
        if (attr.value.includes("{{")) dynamicAttrs[attr.name] = attr.value.trim();
        else staticAttrs[attr.name] = attr.value.trim();
    }

    // 将元素转为 Record 以便附加内部属性
    const elMap = el as unknown as Record<string, unknown>;

    /**
     * 更新函数
     */
    const update = (): void => {
        // 解析表达式
        let data: Record<string, unknown>;
        try {
            const result = parser.parse(trimmedExpr, scope, deps);

            // 结果类型适配:
            if (typeof result === "object" && result !== null && !Array.isArray(result)) data = result as Record<string, unknown>;
            else if (typeof result === "string") {
                try {
                    data = JSON.parse(result);
                } catch {
                    data = { data: result };
                }
            } else data = { data: result };
        } catch (error) {
            console.error("[r-data] 表达式解析错误:", { expr: trimmedExpr, error });
            return;
        }

        let dataScope = elMap._data as Record<string, unknown> | undefined;

        // 首次初始化
        if (!dataScope) {
            // 创建轻量响应式作用域
            dataScope = createDataScope(data, scope) as unknown as Record<string, unknown>;

            // 保存引用到元素上, 供后续增量更新使用
            elMap._data = dataScope;
            elMap.__originalData = { ...data };   // 原始数据快照, 用于判断 key 是否被外部修改
            elMap.__prevData = data;               // 上一次数据快照, 用于差分比对

            // 构建临时容器, 恢复 class/style/静态属性/动态属性
            const tempContainer = document.createElement("div");
            if (cls) tempContainer.className = cls;
            if (style) tempContainer.style.cssText = style;

            for (const name in staticAttrs) tempContainer.setAttribute(name, staticAttrs[name]);
            for (const name in dynamicAttrs) tempContainer.setAttribute(name, parser.text(dynamicAttrs[name], dataScope, deps),);

            // 复制原始 HTML 到临时容器, 编译子 DOM 树
            tempContainer.innerHTML = el.innerHTML.trim();
            compile(tempContainer, dataScope);

            // 替换元素内容: 用编译后的子节点替换原内容
            el.replaceChildren(...tempContainer.childNodes);
        } else {
            const prevData = elMap.__prevData as Record<string, unknown> | undefined;
            const rawData = (dataScope as Record<string, unknown>).__rawData as Record<string, unknown>;
            const dep = (dataScope as Record<string, unknown>).__rDataDep as Dep;
            const originalData = elMap.__originalData as Record<string, unknown> | undefined;

            // 差分比对, 若新旧数据完全相同 (key 数量和值都一致), 跳过更新
            if (prevData) {
                const currKeys = Object.keys(data);
                const prevKeysLen = Object.keys(prevData).length;

                if (currKeys.length === prevKeysLen) {
                    let same = true;
                    for (let i = 0; i < currKeys.length; i++) {
                        if (data[currKeys[i]] !== prevData[currKeys[i]]) {
                            same = false;
                            break;
                        }
                    }
                    if (same) return; // 数据无变化, 跳过
                }
            }

            // 保存当前数据快照
            elMap.__prevData = data;

            // 遍历新数据, 增量更新
            for (const key in data) {
                const newVal = data[key];
                if (originalData && key in originalData) {
                    // key 存在于原始数据中, 仅当值确实变化时才更新并通知
                    if (rawData[key] === originalData[key] && rawData[key] !== newVal) {
                        rawData[key] = newVal;
                        originalData[key] = newVal;
                        dep.notify(key);
                    }
                } else {
                    // key 是新增的, 动态添加响应式属性
                    if (!(key in rawData)) {
                        rawData[key] = newVal;
                        defineReactiveKey(dataScope, rawData, dep, key);
                    } else rawData[key] = newVal;
                    if (originalData) originalData[key] = newVal;
                    dep.notify(key);
                }
            }

            // 清理被删除的 key, 从 rawData 和 originalData 中移除, 并通知
            if (prevData) {
                for (const key in prevData) {
                    if (!(key in data) && originalData && key in originalData) {
                        delete rawData[key];
                        delete originalData[key];
                        dep.notify(key);
                    }
                }
            }
        }
    };

    // 将 update 推入 activeFns 栈, 使编译过程中的依赖收集能追踪到它
    activeFns.push(update);
    try {
        update();
    } catch (error) {
        console.error("[r-data] 初始化错误:", (error as Error).message);
        el.textContent = "";
    } finally {
        activeFns.pop();
    }

    // 当父作用域的依赖变量变化时, 重新执行 update
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depMap.get(scope)?.subscribe(update, varName));

    // 当元素从 DOM 中移除时, 清理所有订阅和引用, 防止内存泄漏
    onElRemove(el, () => {
        const ds = elMap._data as Record<string, unknown> & {destroy?: () => void} | undefined;

        // 调用作用域的 destroy 方法 (如果存在)
        if (ds?.destroy) ds.destroy();

        // 取消所有父作用域依赖订阅
        const depsSet = elDeps.get(el);
        if (depsSet) {
            depsSet.forEach(varName => depMap.get(scope)?.unsubscribe(update, varName));
            elDeps.delete(el);
        }

        // 清除元素上的引用, 帮助 GC
        elMap._data = undefined;
        elMap.__originalData = undefined;
    });
});


/**
 * 创建轻量响应式数据作用域
 *
 * @param data        - `r-data` 表达式解析后的键值对, 如 `{ count: 0, name: "Alice" }`
 * @param parentScope - 父级作用域, 通过 `Object.create` 形成原型链继承
 * @returns 轻量响应式作用域对象, 已注册到 `depMap` 供依赖追踪
 */
const createDataScope = (data: Record<string, unknown>, parentScope: ReactiveInterface,): ReactiveInterface & Record<string, unknown> => {
    const dep = new Dep();

    // 原型链继承: scope 自身无 key 时沿链查找父作用域
    const scope = Object.create(parentScope) as Record<string, unknown>;

    // 原始数据存储: 避免 getter 中访问 scope[key] 导致无限递归
    const rawData: Record<string, unknown> = {};

    // 注册到全局 depMap, 使外部可通过 depMap.get(scope) 获取 dep
    depMap.set(scope, dep);

    // 为每个 key 定义响应式 getter/setter
    const keys = Object.keys(data);
    for (let i = 0; i < keys.length; i++) {
        rawData[keys[i]] = data[keys[i]];
        defineReactiveKey(scope, rawData, dep, keys[i]);
    }

    // 存储内部引用, 供增量更新时使用
    (scope as Record<string, unknown>).__rawData = rawData;
    (scope as Record<string, unknown>).__rDataDep = dep;
    return scope as ReactiveInterface & Record<string, unknown>;
};


/**
 * 为作用域对象动态定义一个响应式属性
 *
 * @param scope   - 目标作用域对象, getter/setter 将定义在此对象上
 * @param rawData - 原始数据存储对象, 真实值保存在此
 * @param dep     - 依赖管理器实例, 负责订阅和通知
 * @param key     - 要定义的属性名
 */
const defineReactiveKey = (scope: Record<string, unknown>, rawData: Record<string, unknown>, dep: Dep, key: string,): void => {
    Object.defineProperty(scope, key, {
        /**
         * Getter — 属性读取
         */
        get(): unknown {
            if (activeFns.length > 0) dep.subscribe(activeFns[activeFns.length - 1], key);
            return rawData[key];
        },

        /**
         * Setter — 属性写入
         */
        set(val: unknown): void {
            if (rawData[key] !== val) {
                rawData[key] = val;
                dep.notify(key);
            }
        },

        // 可枚举, 可配置
        enumerable: true,
        configurable: true,
    });
};


/**
 * 跳过属性集合
 */
const SKIP_ATTRS = new Set(["r-data", "class", "style"]);

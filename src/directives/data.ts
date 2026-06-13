import type { ReactiveInterface } from "../types";
import { activeFns, depMap, elDeps } from "../utils/shared.ts";
import { compile, parser } from "../core";
import { regDir } from "./regDir.ts";
import { initDir, onElRemove } from "../utils/directive.ts";
import { RealDom } from "../core/realdom.ts";


/**
 * 注册 r-data 指令
 *
 * @param el    - 指令绑定的 DOM 元素, 其内部 HTML 作为模板
 * @param expr  - 数据表达式字符串, 如 `"{ count: 0 }"`, 会被 parser.parse 解析
 * @param scope - 父级作用域对象, 会与表达式数据合并创建新的响应式作用域
 * @param deps  - 依赖收集容器, 用于追踪表达式中引用的父作用域变量
 */
regDir("r-data", (el: HTMLElement, expr: string, scope: ReactiveInterface, deps: Set<string>): void => {
    // 防重复处理
    if (!initDir(el, expr, scope, "r-data", "rData")) return;
    const trimmedExpr = expr.trim();

    // 模板缓存
    const tpl = el.innerHTML.trim();
    const cls = el.className.trim();
    const style = el.style.cssText.trim();

    // 属性分类, 静态 vs 动态
    const staticAttrs: Record<string, string> = {};
    const dynamicAttrs: Record<string, string> = {};
    const attrs = el.attributes;

    // 遍历元素的所有属性, 跳过 r-data 自身 class 和 style
    for (let i = 0; i < attrs.length; i++) {
        const attr = attrs[i];
        if (SKIP_ATTRS.has(attr.name)) continue;
        if (attr.value.includes("{{")) dynamicAttrs[attr.name] = attr.value.trim();
        else staticAttrs[attr.name] = attr.value.trim();
    }

    // 将元素上的自定义属性存储映射到统一的 Record 类型, 避免重复 as 转换
    const elMap = el as unknown as Record<string, unknown>;

    /**
     * 核心更新函数 — r-data 的响应式更新入口
     */
    const update = (): void => {
        // 表达式解析

        let data: Record<string, unknown>;
        try {
            const result = parser.parse(trimmedExpr, scope, deps);

            // 根据解析结果的类型进行标准化处理
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

        // 获取已有的数据作用域
        let dataScope = elMap._data as Record<string, unknown> | undefined;
        const originalData = elMap.__originalData as Record<string, unknown> | undefined;

        // 首次渲染路径
        if (!dataScope) {
            // 创建响应式作用域, 合并父作用域和表达式数据
            dataScope = RealDom.reactive({ ...scope, ...data }) as Record<string, unknown>;
            elMap._data = dataScope;
            elMap.__originalData = { ...data };
            elMap.__prevData = data;

            // 创建临时容器组装 DOM, 避免逐次操作真实 DOM 触发多次重排
            const tempContainer = document.createElement("div");
            if (cls) tempContainer.className = cls;
            if (style) tempContainer.style.cssText = style;

            // 还原静态属性, 仅在首次渲染时写入, 后续不再处理
            for (const name in staticAttrs) tempContainer.setAttribute(name, staticAttrs[name]);

            // 还原动态属性, 使用 parser.text 解析 {{ }} 插值
            for (const name in dynamicAttrs) tempContainer.setAttribute(name, parser.text(dynamicAttrs[name], dataScope, deps));

            // 还原原始模板 HTML 并在新作用域下编译, 建立响应式绑定
            tempContainer.innerHTML = tpl;
            compile(tempContainer, dataScope);

            // 一次性替换元素子节点, 避免多次 DOM 操作触发多次重排/重绘
            el.replaceChildren(...tempContainer.childNodes);
        } else {
            // 浅比较快路径, 检查数据是否真正发生变化
            const prevData = elMap.__prevData as Record<string, unknown> | undefined;
            if (prevData) {
                const currKeys = Object.keys(data);
                const prevKeys = Object.keys(prevData);

                // key 数量不同 → 肯定有变化, 跳过浅比较, 走下面的增量更新
                if (currKeys.length === prevKeys.length) {
                    let same = true;
                    for (let i = 0; i < currKeys.length; i++) {
                        if (data[currKeys[i]] !== prevData[currKeys[i]]) {
                            same = false;
                            break;
                        }
                    }
                    if (same) return;  // 数据无任何变化, 跳过更新
                }
            }

            // 更新缓存, 记录本次数据快照用于下次比较
            elMap.__prevData = data;

            // 利用响应式系统自动触发对应 DOM 绑定的精准更新
            for (const key in data) {
                const newVal = data[key];
                if (originalData && key in originalData) {
                    // 已存在的 key 检查是否需要更新
                    if (dataScope[key] === originalData[key] && dataScope[key] !== newVal) {
                        // 写入响应式作用域, 触发对应 DOM 绑定的精准更新
                        dataScope[key] = newVal;
                        originalData[key] = newVal;
                    }
                } else {
                    // 表达式中新增的 key 直接设置到作用域
                    dataScope[key] = newVal;
                    if (originalData) originalData[key] = newVal;
                }
            }

            // 清理表达式中已移除的 key 从作用域和原始数据中删除
            if (prevData) {
                for (const key in prevData) {
                    if (!(key in data) && originalData && key in originalData) {
                        delete dataScope[key];
                        delete originalData[key];
                    }
                }
            }
        }
    };

    // 依赖收集 + 首次执行
    activeFns.push(update);
    try {
        update();
    } catch (error) {
        console.error("[r-data] 初始化错误:", (error as Error).message);
        el.textContent = "";
    } finally {
        activeFns.pop();
    }

    // 订阅父作用域变量
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depMap.get(scope)?.subscribe(update, varName));

    // 元素移除时清理
    onElRemove(el, () => {
        // 如果数据作用域实例有 destroy 生命周期方法, 则调用
        const ds = elMap._data as Record<string, unknown> & {destroy?: () => void} | undefined;
        if (ds?.destroy) ds.destroy();

        // 取消 update 在父作用域上的所有变量订阅, 防止内存泄漏
        const depsSet = elDeps.get(el);
        if (depsSet) {
            depsSet.forEach(varName => depMap.get(scope)?.unsubscribe(update, varName));
            elDeps.delete(el);
        }

        // 解除对响应式作用域和原始数据的引用, 帮助 GC 回收
        elMap._data = undefined;
        elMap.__originalData = undefined;
    });
});


/**
 * 初始化时跳过处理的属性名集合
 */
const SKIP_ATTRS = new Set(["r-data", "class", "style"]);

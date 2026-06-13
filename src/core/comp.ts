import type { CompOptions } from "../types";
import { cpInsts, domTpls, rootScope } from "../utils/shared.ts";
import { scopeCSS, scopeDOM } from "../utils/scoped.ts";
import { compile } from "./compile.ts";
import { RealDom } from "./realdom.ts";


/**
 * 组件定义与注册引擎
 *
 * @param compName - 组件唯一名称标识, 用于 r-dom 指令引用和全局注册
 * @param options - 组件配置对象, 详见 {@link CompOptions}
 */
export const comp: (compName: string, options: CompOptions) => unknown = (compName, options) => {
    // 参数校验, 确保配置对象有效
    if (!options || typeof options !== "object") throw new Error("dom() 需传入组件名称和配置对象");
    const { template, style, script, props: propsDefs, to, sty = true } = options;
    if (!template) console.warn(`组件 "${ compName }" 缺少 template`);

    // 生成唯一标识
    const compId = `comp-${ compName }-${ Math.random().toString(36).substring(2, 9) }`;
    const scopedId = Math.random().toString(36).substring(2, 8);

    // 缓存模板 DocumentFragment
    let tplFrag: DocumentFragment;
    if (!domTpls.has(compName)) {
        tplFrag = document.createDocumentFragment();
        if (template) {
            const tempContainer = document.createElement("div");
            tempContainer.innerHTML = template.trim();
            // 使用 while 循环逐个迁移子节点, 而非直接赋值 innerHTML
            while (tempContainer.firstChild) tplFrag.appendChild(tempContainer.firstChild);
        }
        domTpls.set(compName, tplFrag);
    } else tplFrag = domTpls.get(compName)!;

    // 样式元素引用
    let styleEl: HTMLStyleElement | null = null;

    /**
     * 注入组件样式到文档
     *
     * @param isolated - 是否启用样式隔离, 默认使用组件的 `sty` 配置
     */
    const injectStyle = (isolated: boolean = sty): void => {
        // 避免重复注入, 已注入则直接返回
        if (styleEl) return;

        if (style) {
            // 根据隔离配置处理样式, 启用时添加 scoped 选择器
            const procStyle = isolated ? scopeCSS(style, scopedId) : style;

            // 创建并注入 style 元素
            styleEl = document.createElement("style");
            styleEl.setAttribute("data-comp", compName);
            styleEl.setAttribute("data-comp-id", compId);
            styleEl.setAttribute("data-scoped-id", scopedId);
            styleEl.textContent = procStyle;
            document.head.appendChild(styleEl);
        }
    };

    // 冻结对象防止脚本意外修改, 同时确保所有组件实例共享同一份工具引用
    const utils = Object.freeze({
        ref: RealDom.ref,
        reactive: RealDom.reactive,
        provide: RealDom.provide,
        watch: RealDom.watch,
        dom: RealDom.dom,
        cpInsts: RealDom.cpInsts,
        router: RealDom.router,
    });

    /**
     * 创建组件实例工厂
     *
     * @param props - 外部传入的组件属性, 默认为空对象
     * @param isoOverride - 可选的样式隔离覆盖, 用于运行时动态控制
     * @returns 包含 `render()` 方法的实例工厂对象
     */
    const compFactory = (props: Record<string, unknown> = {}, isoOverride?: boolean) => {
        // 合并属性 propsDefs 为基础层, 外部 props 为覆盖层
        const mergedProps = Object.create(null) as unknown as Record<string, unknown>;
        if (propsDefs) Object.assign(mergedProps, propsDefs);
        Object.assign(mergedProps, props);

        // 确定最终的样式隔离设置
        const finalStyleIso = isoOverride !== undefined ? isoOverride : sty;

        // 创建原始 refs 对象
        const rawRefs = Object.create(null);

        // 创建组件响应式作用域
        const compScope = RealDom.reactive({
            $compName: compName,
            $compId: compId,
            $scopedId: scopedId,
            $props: mergedProps,
            $sty: finalStyleIso,
        });

        // 将原始 refs 对象附加到组件作用域
        (compScope as any).$refs = rawRefs;

        // 执行脚本工厂函数
        let scriptResult: Record<string, unknown> = Object.create(null);
        if (typeof script === "function") {
            try {
                scriptResult = (script as Function)({ $props: compScope.$props, $refs: rawRefs, $sty: finalStyleIso }, utils) || {};
            } catch (e) {
                console.error(`[dom] 组件 "${ compName }" 脚本执行错误:`, e);
            }
        }

        // 执行 setup 函数
        if (typeof scriptResult.setup === "function") {
            try {
                // 创建组件私有上下文, 使用 Object.create(null) 避免原型链干扰
                const compCtx: Record<string, unknown> = Object.create(null);
                const setupFunc = scriptResult.setup as Function;

                // 使用 IIFE + "use strict" 执行 setup
                let manualReturn: Record<string, unknown> | undefined;
                (function () {
                    "use strict";
                    manualReturn = setupFunc(compCtx) as unknown as Record<string, unknown> | undefined;
                })();

                // 收集 ctx 上的非内部变量
                Object.keys(compCtx).forEach(key => (!key.startsWith("__") && !key.startsWith("$")) && (compCtx[key] = compCtx[key]));

                // 合并 setup 返回值到组件作用域
                const setupResult = { ...compCtx, ...manualReturn };
                if (setupResult && typeof setupResult === "object") Object.assign(compScope, setupResult);
            } catch (e) {
                console.error(`[dom] 组件 "${ compName }" setup 函数执行错误:`, e);
            }
        }

        // 收集生命周期钩子
        const lifecycleHooks: Record<string, Function> = Object.create(null);
        LIFECYCLE_HOOKS.forEach(hook => (typeof scriptResult[hook] === "function") && (lifecycleHooks[hook] = scriptResult[hook] as Function));

        // 绑定用户方法到组件作用域
        Object.entries(scriptResult).forEach(([key, value]) => (typeof value === "function" && !NON_LIFECYCLE_METHODS.has(key)) && ((compScope as unknown as Record<string, unknown>)[key] = (value as Function).bind(compScope)));

        /**
         * 渲染组件到目标 DOM 元素
         *
         * @param targetEl - 挂载目标 DOM 元素, 必须是有效的元素节点
         * @param isoOverride - 可选的样式隔离覆盖, undefined 时使用组件默认配置
         * @returns 组件实例对象, 包含 compScope 的所有属性以及 root/del/delSty 方法
         */
        const render = (targetEl: HTMLElement, isoOverride?: boolean) => {
            // 目标节点校验
            if (!targetEl?.nodeType || targetEl.nodeType !== Node.ELEMENT_NODE) throw new Error(`组件 "${ compName }" 挂载失败, 无效的目标节点`);

            // 确定最终的样式隔离设置
            const iso = isoOverride !== undefined ? isoOverride : sty;
            const fragment = document.createDocumentFragment();

            // 注入组件样式
            injectStyle(iso);

            // 克隆模板并添加样式作用域
            const tplClone = tplFrag.cloneNode(true) as DocumentFragment;
            scopeDOM(tplClone, scopedId, iso);

            // 收集模板中的 ref 元素引用
            const refs = tplClone.querySelectorAll("[ref]");
            refs.forEach(el => {
                const refName = el.getAttribute("ref");
                if (refName && !rawRefs[refName]) rawRefs[refName] = el;
            });

            // 编译模板遍历 DOM 树建立响应式绑定
            compile(tplClone, compScope);
            fragment.appendChild(tplClone);

            // 清空目标元素并挂载
            targetEl.textContent = "";
            targetEl.appendChild(fragment);

            // 设置样式作用域容器属性
            if (iso) targetEl.setAttribute(`data-v-${ scopedId }-container`, "");

            // 触发 mounted 生命周期
            if (lifecycleHooks.mounted) requestAnimationFrame(() => lifecycleHooks.mounted.call(compScope));

            // 缓存组件实例到全局 WeakMap
            cpInsts.set(targetEl, compScope);

            // 返回组件实例对象
            return {
                // 展开 compScope 的所有属性, 使外部可以直接访问组件数据和方法
                ...compScope,

                /**
                 * 获取组件渲染后的根 DOM 元素
                 *
                 * @returns 组件根元素或 null (组件未渲染时)
                 */
                root: () => targetEl.querySelector(`[data-v-${ scopedId }]`) || targetEl.firstElementChild,

                /**
                 * 销毁组件实例
                 *
                 * @param removeStyle - 是否同时移除注入的 `<style>` 元素, 默认 false
                 */
                del: (removeStyle?: boolean) => {
                    // 执行卸载生命周期钩子, this 绑定为 compScope
                    if (lifecycleHooks.unmounted) lifecycleHooks.unmounted.call(compScope);

                    // 清理 DOM 内容, 释放元素引用
                    targetEl.textContent = "";

                    // 移除样式元素
                    if (styleEl && removeStyle) {
                        styleEl.remove();
                        styleEl = null;
                    }

                    // 从全局实例映射中删除, 释放 WeakMap 引用
                    cpInsts.delete(targetEl);
                },

                /**
                 * 移除组件样式元素
                 *
                 * @param name - 可选, 指定要移除样式的组件名称, 不传则移除当前组件样式
                 */
                delSty: (name?: string) => {
                    if (!name) {
                        // 移除当前组件样式
                        if (styleEl) {
                            styleEl.remove();
                            styleEl = null;
                        }
                    }
                    // 移除指定组件样式: 通过 data-comp 属性选择器查找
                    const targetStyle = document.querySelector(`style[data-comp="${ name }"]`);
                    if (targetStyle) targetStyle.remove();
                },
            };
        };

        // 返回包含 render 方法的实例工厂对象
        return { render };
    };

    /**
     * 挂载组件到指定目标元素
     *
     * @param props - 组件属性对象, 传入 compFactory 进行合并
     * @param to - 目标选择器字符串 (#id 或 .class 格式) 或 DOM 元素
     * @param sty - 可选的样式隔离覆盖, 传入 render 进行最终控制
     * @returns 组件实例对象 (含 root/del/delSty 方法)
     */
    const mount = (props: Record<string, unknown>, to: string, sty?: boolean) => {
        // 解析挂载目标
        let target = typeof to === "string" ? document.querySelector(to) : to;

        // 目标元素不存在时自动创建
        if (!target) {
            // 解析选择器字符串, 首个字符为类型标记 (# 或 .), 剩余部分以逗号分隔
            const str = (options.to || to) as string;
            const [first, rest] = [str[0], str.slice(1)];
            const part = rest.split(",").map(item => item.trim());
            let arr = [first, ...part];

            // 创建元素并设置 id 或 class
            const element = document.createElement("div");
            if (arr[0] === "#") element.id = arr[1];
            else element.className = arr[1];

            // 挂载到容器或 body
            if (arr[2]) document.getElementById(arr[2])?.appendChild(element);
            else document.body.appendChild(element);
            target = element;
        }

        // 创建组件实例并渲染
        const { render } = compFactory(props, sty);
        return render(target as HTMLElement, sty);
    };

    /**
     * 自动注册组件到全局根作用域
     */
    ((): void => {
        /**
         * 计算最终注册名称
         *
         * @returns 有效的组件注册名
         */
        const getRegName = (): string => {
            if (compName.trim()) return compName.trim();
            return `comp-${ Date.now() }-${ Math.random().toString(36).slice(2, 6) }`;
        };

        /**
         * 创建包装后的组件工厂函数
         *
         * @param targetCompName - 目标组件名
         * @returns 组件工厂函数, 接收 `{ props, to }` 格式的参数对象
         */
        const compFact = (targetCompName: string) => {
            return (...args: unknown[]) => {
                // 参数解构, 从 args[0] 中提取 props、to、sty
                const config = args[0] as unknown as Record<string, unknown>;
                const props = (config.props as unknown as Record<string, unknown>) || {};
                const to = config.to as string | undefined;

                // to 参数校验, r-dom 指令会自动传入目标元素, 手动调用时必须提供
                if (!to) {
                    console.error(`组件 "${ targetCompName }" 挂载失败, 缺少 to 参数`);
                    return null;
                }

                return mount(props, to);
            };
        };

        /**
         * 注册组件到根作用域
         *
         * @param regName - 最终的注册名
         * @param targetCompName - 目标组件名 (传递给 compFact)
         */
        const register = (regName: string, targetCompName: string): void => {
            /**
             * 尝试注册, 等待根作用域可用
             */
            const tryRegister = (): void => {
                if (rootScope) {
                    if (rootScope[regName]) return void console.warn(`[dom] 组件名 "${ regName }" 已被占用, 跳过注册`);
                    (rootScope as unknown as Record<string, unknown>)[regName] = compFact(targetCompName);
                }
            };

            // 根据 DOM 加载状态选择注册时机
            if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryRegister);
            else tryRegister();
        };

        // 计算注册名并执行注册
        const regName = getRegName();
        register(regName, compName);
    })();

    // 返回值分派, 根据 to 参数决定返回类型
    if (to) return mount({}, to);
    else return (...args: unknown[]) => {
        const config = args[0] as unknown as Record<string, unknown>;
        const props = (config.props as unknown as Record<string, unknown>) || {};
        const to = config.to as string;
        const sty = config.sty as boolean | undefined;
        return mount(props, to, sty);
    };
};


/**
 * 生命周期钩子名称列表
 */
const LIFECYCLE_HOOKS = ["mounted", "unmounted"] as const;


/**
 * 非用户方法的保留名称集合
 */
const NON_LIFECYCLE_METHODS = new Set<string>(["setup", ...LIFECYCLE_HOOKS]);

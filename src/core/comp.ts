import type { CompOptions } from "../types";
import { cpInsts, domTpls, rootScope } from "../utils/shared.ts";
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

    // 生成唯一实例标识
    const compId = `comp-${ compName }-${ Math.random().toString(36).substring(2, 9) }`;

    // 缓存模板 DocumentFragment
    let tplFrag: DocumentFragment;
    if (!domTpls.has(compName)) {
        tplFrag = document.createDocumentFragment();
        if (template) {
            const tempContainer = document.createElement("div");
            tempContainer.innerHTML = template.trim();
            while (tempContainer.firstChild) tplFrag.appendChild(tempContainer.firstChild);
        }
        domTpls.set(compName, tplFrag);
    } else tplFrag = domTpls.get(compName)!;

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

        // 创建精简的响应式作用域
        const compScope = RealDom.reactive({ $props: mergedProps, });
        (compScope as Record<string, unknown>).$refs = rawRefs;

        // 内部非响应式属性, 通过闭包访问, 避免污染作用域链和 getKeys()
        const compInternals = {
            $compName: compName,
            $compId: compId,
            $sty: finalStyleIso,
        };

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
                const compCtx: Record<string, unknown> = Object.create(null);
                const setupFunc = scriptResult.setup as Function;
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
         * @returns 组件实例对象, 包含 compScope 的所有属性以及 root/del 方法
         */
        const render = (targetEl: HTMLElement, isoOverride?: boolean) => {
            if (!targetEl?.nodeType || targetEl.nodeType !== Node.ELEMENT_NODE) throw new Error(`组件 "${ compName }" 挂载失败, 无效的目标节点`);
            const iso = isoOverride !== undefined ? isoOverride : sty;
            const tplClone = tplFrag.cloneNode(true) as DocumentFragment;

            // 收集模板中的 ref 元素引用
            const refs = tplClone.querySelectorAll("[ref]");
            refs.forEach(el => {
                const refName = el.getAttribute("ref");
                if (refName && !rawRefs[refName]) rawRefs[refName] = el;
            });

            // 编译模板遍历 DOM 树建立响应式绑定
            compile(tplClone, compScope);

            // Shadow DOM 挂载路径 — 原生样式隔离, 无需 scopeDOM/scopeCSS
            if (iso) {
                // 处理重新挂载: 若已存在 Shadow Root 则清空复用
                let shadowRoot: ShadowRoot;
                if (targetEl.shadowRoot) {
                    shadowRoot = targetEl.shadowRoot;
                    while (shadowRoot.firstChild) shadowRoot.removeChild(shadowRoot.firstChild);
                } else shadowRoot = targetEl.attachShadow({ mode: "open" });

                // 组件样式直接注入 Shadow DOM, 无需 CSS 选择器重写
                if (style) {
                    const styleEl = document.createElement("style");
                    styleEl.setAttribute("data-comp", compName);
                    styleEl.setAttribute("data-comp-id", compId);
                    styleEl.textContent = style;
                    shadowRoot.appendChild(styleEl);
                }

                shadowRoot.appendChild(tplClone);

                // 触发 mounted 生命周期
                if (lifecycleHooks.mounted) requestAnimationFrame(() => lifecycleHooks.mounted.call(compScope));

                // 缓存组件实例
                cpInsts.set(targetEl, compScope);

                return {
                    ...compScope,
                    ...compInternals,
                    root: () => shadowRoot.firstElementChild,
                    del: () => {
                        if (lifecycleHooks.unmounted) lifecycleHooks.unmounted.call(compScope);
                        cpInsts.delete(targetEl);
                        targetEl.remove();
                    },
                };
            }

            // 无隔离路径
            const fragment = document.createDocumentFragment();

            // 无隔离时样式注入到 <head>
            if (style) {
                const styleEl = document.createElement("style");
                styleEl.setAttribute("data-comp", compName);
                styleEl.setAttribute("data-comp-id", compId);
                styleEl.textContent = style;
                fragment.appendChild(styleEl);
            }

            // 直接渲染到 Light DOM
            fragment.appendChild(tplClone);
            targetEl.textContent = "";
            targetEl.appendChild(fragment);

            // 触发 mounted 生命周期
            if (lifecycleHooks.mounted) requestAnimationFrame(() => lifecycleHooks.mounted.call(compScope));
            cpInsts.set(targetEl, compScope);

            // 返回组件实例对象
            return {
                ...compScope,
                ...compInternals,
                root: () => targetEl.firstElementChild,
                del: () => {
                    if (lifecycleHooks.unmounted) lifecycleHooks.unmounted.call(compScope);
                    cpInsts.delete(targetEl);
                    targetEl.remove();
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
     * @returns 组件实例对象 (含 root/del 方法)
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

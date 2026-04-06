import type { ComponentOptions, ReactiveObject } from "../types";
import { componentInstances, componentTemplates } from "../utils/shared.ts";
import { addScopeToDOM, addStyleScope } from "../utils/style.ts";
import { processElement } from "./dom-processor.ts";

/** 生命周期钩子名称列表 */
const LIFECYCLE_HOOKS = ["mounted", "unmounted"] as const;

/** 非用户方法的保留名称集合 */
const NON_LIFECYCLE_METHODS = new Set<string>(["setup", ...LIFECYCLE_HOOKS]);

/**
 * 定义并注册组件
 *
 * @param compName - 组件唯一名称标识
 * @param options - 组件配置对象
 * @returns 若指定 to 则返回挂载实例，否则返回组件工厂函数
 */
export const createComponent: (compName: string, options: ComponentOptions) => unknown = (compName, options) => {
    if (!options || typeof options !== "object") throw new Error("dom() 需传入组件名称和配置对象");

    // 解构配置对象
    const { template, style, script, pro: proDefinitions, to, sty = true } = options;
    if (!template) console.warn(`组件 "${ compName }" 缺少 template`);
    if (!window.__componentResetCache) window.__componentResetCache = new Set<string>();

    // 生成唯一标识
    const compId = `comp-${ compName }-${ Math.random().toString(36).substring(2, 9) }`;
    const scopedId = Math.random().toString(36).substring(2, 8);

    // 缓存模板 DocumentFragment
    let templateFragment: DocumentFragment;
    if (!componentTemplates.has(compName)) {
        templateFragment = document.createDocumentFragment();
        if (template) {
            const tempContainer = document.createElement("div");
            tempContainer.innerHTML = template.trim();
            while (tempContainer.firstChild) templateFragment.appendChild(tempContainer.firstChild);
        }
        componentTemplates.set(compName, templateFragment);
    } else templateFragment = componentTemplates.get(compName)!;

    // 样式处理
    let styleElement: HTMLStyleElement | null = null;

    /**
     * 注入组件样式到文档
     *
     * @param isolationEnabled - 是否启用样式隔离
     */
    const processStyle = (isolationEnabled: boolean = sty): void => {
        if (styleElement) return;
        if (style) {
            const processedStyle = isolationEnabled ? addStyleScope(style, scopedId) : style;
            styleElement = document.createElement("style");
            styleElement.setAttribute("data-comp", compName);
            styleElement.setAttribute("data-comp-id", compId);
            styleElement.setAttribute("data-scoped-id", scopedId);
            styleElement.textContent = processedStyle;
            document.head.appendChild(styleElement);
        }
    };

    // 工具函数
    const utils = Object.freeze({ ref: window.ref, reactive: window.reactive, provide: window.provide, });

    /**
     * 创建组件实例
     *
     * @param pro - 外部传入的组件属性
     * @param isolationOverride - 可选的样式隔离覆盖
     * @returns 包含 render 方法的实例对象
     */
    const componentFactory = (pro: Record<string, unknown> = {}, isolationOverride?: boolean) => {
        // 合并属性定义和外部属性
        const resolvedPro = Object.create(null) as unknown as Record<string, unknown>;
        if (proDefinitions) Object.assign(resolvedPro, proDefinitions);
        Object.assign(resolvedPro, pro);

        // 确定最终的样式隔离设置
        const finalIsolation = isolationOverride !== undefined ? isolationOverride : sty;

        // 创建组件响应式作用域
        const componentScope = window.reactive({
            $compName: compName,
            $compId: compId,
            $scopedId: scopedId,
            $pro: resolvedPro,
            $refs: Object.create(null),
            $sty: finalIsolation,
        });

        // 执行脚本工厂函数
        let scriptResult: Record<string, unknown> = Object.create(null);
        if (typeof script === "function") {
            try {
                scriptResult = (script as Function)({ $pro: componentScope.$pro, $refs: (componentScope.$refs as ReactiveObject).__raw, $sty: finalIsolation }, utils,) || {};
            } catch (e) {
                console.error(`[dom] 组件 "${ compName }" 脚本执行错误:`, e);
            }
        }

        // 执行 setup 函数
        if (typeof scriptResult.setup === "function") {
            try {
                // 创建组件私有上下文
                const componentPrivateCtx: Record<string, unknown> = Object.create(null);
                const setupFunc = scriptResult.setup as Function;

                // 执行 setup 函数并手动收集返回值
                let manualReturn: Record<string, unknown> | undefined;
                (function () {
                    "use strict";
                    manualReturn = setupFunc(componentPrivateCtx) as unknown as Record<string, unknown> | undefined;
                })();

                // 收集 ctx 上的非内部变量
                Object.keys(componentPrivateCtx).forEach(key => {
                    if (!key.startsWith("__") && !key.startsWith("$")) componentPrivateCtx[key] = componentPrivateCtx[key];
                });

                // 合并组件私有上下文和手动返回值
                const setupResult = { ...componentPrivateCtx, ...manualReturn };
                if (setupResult && typeof setupResult === "object") Object.assign(componentScope, setupResult);
            } catch (e) {
                console.error(`[dom] 组件 "${ compName }" setup 函数执行错误:`, e);
            }
        }

        // 收集生命周期钩子
        const lifecycleHooks: Record<string, Function> = Object.create(null);
        LIFECYCLE_HOOKS.forEach(hook => {
            if (typeof scriptResult[hook] === "function") lifecycleHooks[hook] = scriptResult[hook] as Function;
        });

        // 绑定用户方法到组件作用域
        Object.entries(scriptResult).forEach(([key, value]) => {
            if (typeof value === "function" && !NON_LIFECYCLE_METHODS.has(key)) (componentScope as unknown as Record<string, unknown>)[key] = (value as Function).bind(componentScope);
        });

        /**
         * 渲染组件到目标元素
         * @param mountTargetEl - 挂载目标 DOM 元素
         * @param renderIsolationOverride - 可选的样式隔离覆盖
         * @returns 组件实例对象（含 root、del、delSty 方法）
         */
        const render = (mountTargetEl: HTMLElement, renderIsolationOverride?: boolean) => {
            if (!mountTargetEl?.nodeType || mountTargetEl.nodeType !== Node.ELEMENT_NODE) throw new Error(`组件 "${ compName }" 挂载失败：无效的目标节点`);

            // 确定最终的样式隔离设置
            const renderIsolation = renderIsolationOverride !== undefined ? renderIsolationOverride : sty;
            const fragment = document.createDocumentFragment();
            processStyle(renderIsolation);

            // 克隆模板并添加样式作用域
            const templateClone = templateFragment.cloneNode(true) as DocumentFragment;
            addScopeToDOM(templateClone, scopedId, renderIsolation);

            // 收集模板中的 ref 元素引用
            const refElements = templateClone.querySelectorAll("[ref]");
            refElements.forEach(el => {
                const refName = el.getAttribute("ref");
                if (refName && !(componentScope.$refs as unknown as Record<string, unknown>)[refName]) (componentScope.$refs as unknown as Record<string, unknown>)[refName] = el;
            });

            // 处理模板元素
            processElement(templateClone, componentScope);
            fragment.appendChild(templateClone);

            // 清空目标元素并.appendChild 片段内容
            mountTargetEl.textContent = "";
            mountTargetEl.appendChild(fragment);

            // 设置样式作用域属性
            if (renderIsolation) mountTargetEl.setAttribute(`data-v-${ scopedId }-container`, "");
            if (lifecycleHooks.mounted) requestAnimationFrame(() => lifecycleHooks.mounted.call(componentScope));
            componentInstances.set(mountTargetEl, componentScope);

            return {
                ...componentScope,

                /** 获取组件根元素 */
                root: () => mountTargetEl.querySelector(`[data-v-${ scopedId }]`) || mountTargetEl.firstElementChild,

                /**
                 * 销毁组件实例
                 * @param removeSty - 是否同时移除样式元素
                 */
                del: (removeSty?: boolean) => {
                    if (lifecycleHooks.unmounted) lifecycleHooks.unmounted.call(componentScope);
                    mountTargetEl.textContent = "";
                    if (styleElement && removeSty) {
                        styleElement.remove();
                        styleElement = null;
                    }
                    componentInstances.delete(mountTargetEl);
                },

                /**
                 * 移除组件样式
                 * @param name - 可选，指定移除的组件名样式
                 */
                delSty: (name?: string) => {
                    if (!name) {
                        if (styleElement) {
                            styleElement.remove();
                            styleElement = null;
                        }
                    }
                    const targetStyle = document.querySelector(`style[data-comp="${ name }"]`);
                    if (targetStyle) targetStyle.remove();
                },
            };
        };

        return { render };
    };

    /**
     * 挂载组件到指定目标
     *
     * @param pro - 组件属性
     * @param name - 目标选择器或 DOM 元素
     * @param isolationOverride - 可选的样式隔离覆盖
     * @returns 组件实例或 null
     */
    const mountComponent = (pro: Record<string, unknown>, name: string | HTMLElement, isolationOverride?: boolean,) => {
        const mountTarget = typeof name === "string" ? document.querySelector(name) : name;
        if (!mountTarget) {
            console.error(`组件 "${ compName }" 挂载失败：找不到目标元素`);
            return null;
        }
        const { render } = componentFactory(pro, isolationOverride);
        return render(mountTarget as HTMLElement, isolationOverride);
    };

    // 自动注册组件到根作用域
    const autoRegisterToRoot = (): void => {
        const calculateRegisterName = (): string => {
            const asName = (options as unknown as Record<string, unknown>).as;
            if (typeof asName === "string" && asName.trim()) return asName.trim();
            if (compName.trim()) return compName.trim();
            return `comp-${ Date.now() }-${ Math.random().toString(36).slice(2, 6) }`;
        };

        /**
         * 创建组件工厂函数
         *
         * @param _finalRegisterName - 组件注册名
         * @param targetCompName - 目标组件名
         * @returns 组件工厂函数
         */
        const createComponentFactory = (_finalRegisterName: string, targetCompName: string) => {
            return (...args: unknown[]) => {
                // 解构参数
                let props: Record<string, unknown>;
                let target: string | HTMLElement | undefined;
                let styleIsolation: boolean | undefined;

                // 根据参数长度和类型解构参数
                if (args.length === 1 && typeof args[0] === "object") {
                    const config = args[0] as unknown as Record<string, unknown>;
                    props = (config.props as unknown as Record<string, unknown>) || {};
                    target = config.target as string | HTMLElement | undefined;
                    styleIsolation = config.styleIsolation as boolean | undefined;
                } else {
                    props = args[0] as unknown as Record<string, unknown>;
                    target = args[1] as string | HTMLElement | undefined;
                    styleIsolation = args[2] as boolean | undefined;
                }

                // 检查 target 参数
                if (!target) {
                    console.error(`组件 "${ targetCompName }" 挂载失败：缺少target参数`);
                    return null;
                }

                // 调用 mountComponent 函数并返回结果
                return mountComponent(props, target, styleIsolation);
            };
        };

        /**
         * 尝试将组件注册到根作用域
         *
         * @param finalRegisterName - 最终的注册名
         * @param targetCompName - 目标组件名
         */
        const registerToRootScope = (finalRegisterName: string, targetCompName: string): void => {
            // 尝试将组件注册到根作用域
            const tryRegister = (): void => {
                if (window.__rootScope) {
                    if (window.__rootScope[finalRegisterName]) return void console.warn(`[dom] 组件名 "${ finalRegisterName }" 已被占用，跳过注册`);
                    (window.__rootScope as unknown as Record<string, unknown>)[finalRegisterName] = createComponentFactory(finalRegisterName, targetCompName);
                } else setTimeout(tryRegister, 40);
            };

            // 监听 DOMContentLoaded 事件，确保在 DOM 完全加载后尝试注册组件
            if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tryRegister);
            else tryRegister();
        };

        // 计算最终的注册名
        const finalRegisterName = calculateRegisterName();
        registerToRootScope(finalRegisterName, compName);
    };

    // 自动注册组件到根作用域
    autoRegisterToRoot();

    // 根据是否指定 to 返回不同结果
    if (to) return mountComponent({}, to);
    else {
        return (...args: unknown[]) => {
            if (args.length === 1 && typeof args[0] === "object") {
                const config = args[0] as unknown as Record<string, unknown>;
                const pro = (config.pro as unknown as Record<string, unknown>) || {};
                const name = config.name as string | HTMLElement;
                const styOverride = config.sty as boolean | undefined;
                return mountComponent(pro, name, styOverride);
            } else {
                const [name, styOverride, pro = {}] = args as [string | HTMLElement, boolean | undefined, Record<string, unknown>?];
                return mountComponent(pro || {}, name, styOverride);
            }
        };
    }
};

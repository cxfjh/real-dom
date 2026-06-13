import type { RouteInfo, RoutePageInfo, RouterInterface } from "../types";
import { compile } from "../core";
import { rootScope } from "../utils/shared.ts";


/**
 * 路由管理器单例
 */
export const router: RouterInterface = {
    /**
     * 已注册的路由映射表
     *
     * Key: 路径字符串
     * Value: { handler: 路由处理函数, target: 目标容器名 }
     */
    routes: new Map<string, RouteInfo>(),

    /**
     * 各目标容器当前激活的路径
     *
     * Key: 目标容器名
     * Value: 当前激活的路径
     */
    activePaths: new Map<string, string>(),

    /**
     * 已渲染页面容器映射 — 懒渲染缓存
     *
     * Key: 路径字符串
     * Value: { container: HTMLDivElement, target: 目标容器名 }
     */
    pages: new Map<string, RoutePageInfo>(),

    /**
     * 原始页面元素内容备份
     *
     * Key: 路径字符串
     * Value: { html: 页面原始 innerHTML, target: 目标容器名 }
     */
    origPages: new Map<string, {html: string; target: string}>(),

    /**
     * 路由目标容器 DOM 引用
     *
     * Key: 目标容器名
     * Value: 容器 DOM 元素
     */
    targets: new Map<string, HTMLElement>(),

    /**
     * 所有 r-route 元素集合 — 激活样式管理的性能优化
     */
    _routeEls: new Set<HTMLElement>(),

    /**
     * popstate 事件处理器引用
     */
    _popstateHandler: (() => {
    }) as () => void,

    /**
     * 注册路由
     *
     * @param path    - 路由路径, 如 "/home", "/about"
     * @param handler - 路由处理函数, 在 _execRoute() 中调用
     * @param target  - 目标容器名, 默认 "view"
     */
    add(path: string, handler: Function, target: string = "view"): void {
        if (typeof handler !== "function") return;
        this.routes.set(path, { handler, target });
    },

    /**
     * 注册 r-route 元素到激活样式管理集合
     *
     * @param el - 带 r-route 属性的 DOM 元素
     */
    _registerRouteEl(el: HTMLElement): void {
        this._routeEls.add(el);
    },

    /**
     * 从激活样式管理集合中注销 r-route 元素
     *
     * @param el - 被移除的 r-route DOM 元素
     */
    _unregisterRouteEl(el: HTMLElement): void {
        this._routeEls.delete(el);
    },

    /**
     * 解析当前 URL 中的 path 查询参数
     *
     * @returns 路径字符串, 无 path 参数时返回空字符串
     */
    _parsePath(): string {
        try {
            // 使用 URL API 解析当前地址, 提取 path 查询参数
            return new URL(window.location.href).searchParams.get("path") || "";
        } catch {
            // URL 解析失败 (如非常规的 URL 格式), 返回空字符串
            return "";
        }
    },

    /**
     * 导航到指定路径 — SPA 路由跳转的入口
     *
     * @param path    - 目标路径, 如 "/home"
     * @param replace - 是否替换当前历史记录, 默认 false
     */
    nav(path: string, replace: boolean = false): void {
        // 路由存在性校验
        if (!this.routes.has(path)) return void console.warn(`路由不存在: ${ path }`);

        try {
            // 更新浏览器 URL
            const url = new URL(window.location.href);
            url.searchParams.set("path", path);

            // pushState 新增历史记录, 用户可通过后退按钮返回
            if (replace) window.history.replaceState({}, "", url);
            else window.history.pushState({}, "", url);

            // 执行路由切换
            this._execRoute?.(path);
        } catch (error) {
            console.error("路由导航失败:", error);
        }
    },

    /**
     * 执行指定路径的路由处理
     *
     * @param path - 目标路径
     */
    _execRoute(path: string): void {
        // 查找路由信息
        const routeInfo = this.routes.get(path);
        if (!routeInfo) return;  // 路由不存在, 静默终止

        const { target } = routeInfo;

        // 目标容器路径变化时切换页面显示
        if (this.activePaths.get(target) !== path) {
            const prevPath = this.activePaths.get(target);

            // 隐藏旧页面
            if (prevPath) {
                const prevPage = this.pages.get(prevPath);
                if (prevPage) prevPage.container.style.display = "none";
            }

            // 目标页面首次访问时创建 DOM
            let pageInfo = this.pages.get(path);
            if (!pageInfo) {
                this._renderPage(path, target);
                pageInfo = this.pages.get(path);
            }

            // 显示新页面
            if (pageInfo && pageInfo.container) {
                pageInfo.container.style.display = "";
            }

            // 更新当前激活路径记录
            this.activePaths.set(target, path);
        }

        // 执行路由处理器
        if (routeInfo.handler) {
            try {
                routeInfo.handler();
            } catch (error) {
                console.error(`路由执行错误 [${ path }]:`, error);
            }
        }

        // 更新路由激活样式
        const activeClass = "r-active";
        for (const el of this._routeEls) {
            // 读取元素的 r-route 属性值
            const elPath = el.getAttribute("r-route");

            // 自定义激活样式类
            const customClass = el.getAttribute("route-active") || activeClass;
            el.classList.toggle(customClass, elPath === path);
        }
    },

    /**
     * 收集所有目标容器
     */
    _preRenderAll(): void {
        // 查询所有带 route 属性的目标容器元素
        document.querySelectorAll("[route]").forEach(el => {
            const target = (el as HTMLElement).getAttribute("route");
            if (target) {
                // 存储容器 DOM 引用
                this.targets.set(target, el as HTMLElement);
                // 清空容器内容, 为路由页面腾出空间
                el.innerHTML = "";
            }
        });
    },

    /**
     * 懒渲染单个路由页面
     *
     * @param path       - 路由路径, 如 "/home"
     * @param targetName - 目标容器名, 如 "main"
     */
    _renderPage(path: string, targetName: string): void {
        // 查找目标容器 DOM 元素
        const target = this.targets.get(targetName);
        if (!target) return;  // 目标容器不存在, 静默终止

        // 创建页面容器元素
        const page = document.createElement("div");
        page.className = "route-page";

        // 标识路径和归属容器, 便于调试和 CSS 选择
        page.setAttribute("data-route-path", path);
        page.setAttribute("data-route-target", targetName);

        // 由 _execRoute() 控制显示时机
        page.style.display = "none";

        // 将页面容器注册到 pages 缓存
        this.pages.set(path, { container: page, target: targetName });

        // 从备份恢复原始页面内容
        const pageInfo = this.origPages.get(path);
        if (pageInfo?.html) {
            // 恢复 HTML 内容
            page.innerHTML = pageInfo.html;
            compile(page, rootScope!);
        }

        // 将页面容器插入目标容器
        target.appendChild(page);
    },

    /**
     * 初始化路由系统
     */
    init(): void {
        // 遍历 DOM 中所有 [r-page] 元素, 备份 innerHTML 后移除
        this._collectOrigPages();

        // 从当前 URL 中提取 ?path= 参数, 用于首次路由
        const initPath = this._parsePath();

        // 收集所有 [route] 元素, 清空内容, 为路由页面准备容器
        this._preRenderAll();

        // 如果 URL 中有 path 参数且路径已注册, 渲染对应页面
        if (initPath && this.routes.has(initPath)) this._execRoute(initPath);

        // 注册 popstate 事件监听器
        this._popstateHandler = (): void => {
            const path = this._parsePath();
            if (path && this.routes.has(path)) this._execRoute(path);
        };

        // 绑定 popstate 事件
        window.addEventListener("popstate", this._popstateHandler);
    },

    /**
     * 收集所有 r-page 元素的内容并从中 DOM 移除
     */
    _collectOrigPages(): void {
        // 查询所有带 r-page 属性的页面声明元素
        document.querySelectorAll("[r-page]").forEach(pageElement => {
            const pageName = pageElement.getAttribute("r-page");

            // 使用 &route 属性而非 route 属性, 避免与 r-page 自身的 route 属性冲突
            const targetName = pageElement.getAttribute("&route") || "view";

            if (pageName) {
                // 备份页面 HTML 内容和目标容器名
                this.origPages.set(pageName, { html: pageElement.innerHTML, target: targetName });

                // 自动注册路由: 如果路由尚未手动注册, 使用 NOOP 处理器注册
                if (!this.routes.has(pageName)) this.add(pageName, NOOP, targetName);

                // 从 DOM 中移除原始页面元素
                pageElement.remove();
            }
        });
    },
};


/**
 * 空函数常量 — r-page 自动注册路由时的默认处理器
 */
const NOOP = (): void => {
};

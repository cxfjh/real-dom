import type { RouteInfo, RoutePageInfo, Router } from "../types";
import { processElement } from "../core";

/**
 * 路由管理器单例
 */
export const router: Router = {
    /** 已注册的路由映射表 */
    routes: new Map<string, RouteInfo>(),

    /** 各目标容器当前激活的路径 */
    currentPaths: new Map<string, string>(),

    /** 页面容器映射 */
    pageContainers: new Map<string, RoutePageInfo>(),

    /** 原始页面元素内容备份 */
    originalPageElements: new Map<string, {html: string; target: string}>(),

    /** 路由目标容器 DOM 引用 */
    routeTargets: new Map<string, HTMLElement>(),

    /** popstate 事件处理器引用 */
    _popstateHandler: () => void 0,

    /**
     * 注册路由
     *
     * @param path - 路由路径标识
     * @param handler - 路由激活时的处理函数
     * @param target - 目标容器名，默认 "view"
     */
    add(path: string, handler: Function, target: string = "view"): void {
        if (typeof handler !== "function") return;
        this.routes.set(path, { handler, target });
    },

    /**
     * 解析当前 URL 中的 path 参数
     *
     * @returns 路径字符串，无 path 参数时返回空字符串
     */
    _parsePath(): string {
        try {
            const url = new URL(window.location.href);
            return url.searchParams.get("path") || "";
        } catch {
            return "";
        }
    },

    /**
     * 导航到指定路径
     *
     * @param path - 目标路由路径
     * @param replace - 是否替换当前历史记录，默认 false
     * @remarks 使用 setTimeout(5ms) 延迟确保 DOM 操作完成
     */
    nav(path: string, replace: boolean = false): void {
        setTimeout(() => {
            if (!this.routes.has(path)) return void console.warn(`路由不存在: ${ path }`);
            try {
                const url = new URL(window.location.href);
                url.searchParams.set("path", path);
                if (replace) window.history.replaceState({}, "", url);
                else window.history.pushState({}, "", url);
                this._executeRoute?.(path);
            } catch (error) {
                console.error("路由导航失败:", error);
            }
        }, 5);
    },

    /**
     * 执行指定路径的路由处理
     *
     * @param path - 目标路由路径
     */
    _executeRoute(path: string): void {
        const routeInfo = this.routes.get(path);
        if (!routeInfo) return;
        const { target: targetName } = routeInfo;
        if (this.currentPaths.get(targetName) !== path) {
            // 隐藏当前容器的所有页面
            this.pageContainers.forEach((pageInfo) => {
                if (pageInfo.target === targetName) pageInfo.container.style.display = "none";
            });

            // 显示目标页面
            const pageInfo = this.pageContainers.get(path);
            if (pageInfo && pageInfo.container) pageInfo.container.style.display = "block";

            this.currentPaths.set(targetName, path);
        }

        // 执行路由处理器
        if (routeInfo.handler) {
            try {
                routeInfo.handler();
            } catch (error) {
                console.error(`路由执行错误 [${ path }]:`, error);
            }
        }

        // 路由激活样式
        document.querySelectorAll("[route-active]").forEach(el => {
            const value = el.getAttribute("route-active") || "r-active";
            const elPath = el.getAttribute("r-route");
            el.classList.remove(value);
            if (elPath === path) el.classList.add(value);
        });
    },

    /**
     * 预渲染所有已注册的路由页面
     */
    _prerenderAllPages(): void {
        // 收集所有 [route] 属性的目标容器
        document.querySelectorAll("[route]").forEach(el => {
            const targetName = (el as HTMLElement).getAttribute("route");
            if (targetName) {
                this.routeTargets.set(targetName, el as HTMLElement);
                el.innerHTML = "";
            }
        });

        // 预渲染所有页面
        this.routes.forEach((_routeInfo: RouteInfo, path: string) => {
            const routeInfo = this.routes.get(path)!;
            this._renderPage(path, routeInfo.target);
        });
    },

    /**
     * 渲染单个路由页面
     *
     * @param path - 路由路径
     * @param targetName - 目标容器名
     */
    _renderPage(path: string, targetName: string): void {
        // 获取目标容器
        const targetContainer = this.routeTargets.get(targetName);
        if (!targetContainer) return;

        // 创建页面容器
        const pageContainer = document.createElement("div");
        pageContainer.className = "route-page";
        pageContainer.setAttribute("data-route-path", path);
        pageContainer.setAttribute("data-route-target", targetName);
        pageContainer.style.display = "none";

        // 存储页面容器信息
        this.pageContainers.set(path, { container: pageContainer, target: targetName });

        // 恢复页面内容
        const pageInfo = this.originalPageElements.get(path);
        if (pageInfo && pageInfo.html) {
            pageContainer.innerHTML = pageInfo.html;
            processElement(pageContainer, window.__rootScope || {} as import("../types/index.ts").ReactiveObject);
        }

        // 将页面容器添加到目标容器
        targetContainer.appendChild(pageContainer);
    },

    /**
     * 初始化路由系统
     */
    init(): void {
        // 收集并移除原始页面元素
        this._collectAndRemoveOriginalPages();

        // 解析初始路径
        const initialPath = this._parsePath();
        this._prerenderAllPages();

        // 执行初始路由
        if (initialPath && this.routes.has(initialPath)) this._executeRoute(initialPath);

        // 绑定 popstate 事件监听
        this._popstateHandler = (): void => {
            const path = this._parsePath();
            if (path && this.routes.has(path)) this._executeRoute(path);
        };

        // 监听 popstate 事件
        window.addEventListener("popstate", this._popstateHandler);
    },

    /**
     * 收集所有 [r-page] 元素的内容并从 DOM 中移除
     */
    _collectAndRemoveOriginalPages(): void {
        document.querySelectorAll("[r-page]").forEach(pageElement => {
            // 获取页面名和目标容器名
            const pageName = pageElement.getAttribute("r-page");
            const targetName = pageElement.getAttribute("&route") || "view";

            // 如果页面名存在，则收集页面内容并从 DOM 中移除
            if (pageName) {
                this.originalPageElements.set(pageName, { html: pageElement.innerHTML, target: targetName, });
                if (!this.routes.has(pageName)) this.add(pageName, new Function(), targetName);
                pageElement.remove();
            }
        });
    },
};

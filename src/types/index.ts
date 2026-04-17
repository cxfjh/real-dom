import { watch } from "../core";

/**
 * 响应式引用对象
 */
export interface Ref<T = unknown> {
    /** 引用的实际值，读取时触发依赖收集，写入时触发更新通知 */
    value: T;

    /** 内部标识：标记当前对象为 Ref 类型 */
    __isRef: boolean;
}

/**
 * 响应式代理对象
 */
export interface ReactiveObject {
    /** 内部标识：标记对象已被 reactive() 处理 */
    __isReactive?: boolean;

    /** 指向原始（未代理）对象的引用 */
    __raw?: unknown;

    /** 内部标识：标记当前实例为 Proxy 代理对象 */
    __isReactiveProxy?: boolean;

    /** 允许动态属性访问 */
    [key: string]: unknown;
}

/**
 * 依赖管理器接口
 */
export interface Dependency {
    /** 全量订阅者集合（未指定变量名的通用订阅） */
    subscribers: Set<Function>;

    /** 按变量名分组的精准订阅者映射 */
    varSubs: Map<string, Set<Function>>;

    /** 通知禁用标志（数组批量操作时临时关闭） */
    _notificationDisabled?: boolean;

    /** 关联的 Proxy 代理对象引用 */
    __proxy?: ReactiveObject;

    /** 添加订阅者 */
    subscribe(fn: Function, variable?: string | null): void;

    /** 通知订阅者执行更新 */
    notify(variable?: string | null): void;
}

/**
 * 批量更新管理器
 */
export interface BatchUpdater {
    /** 待执行的更新函数队列 */
    _queue: Set<Function>;

    /** 当前是否正在执行更新批次 */
    _isUpdating: boolean;

    /** 将更新函数添加到队列 */
    add(fn: Function): void;

    /** 调度下一帧执行队列 */
    _scheduleUpdate(): void;

    /** 执行队列中的所有更新函数 */
    _executeQueue(): void;
}

/**
 * 表达式解析器
 */
export interface ExpressionParser {
    /** 全局变量白名单 */
    _globals: Set<string>;

    /** 解析单个表达式 */
    parse(expr: string, scope?: ReactiveObject, deps?: Set<string>, unwrapRef?: boolean): unknown;

    /** 解析包含插值的文本 */
    parseText(text: string, scope?: ReactiveObject, deps?: Set<string>, unwrapRef?: boolean): string;
}

/**
 * 指令处理函数签名
 */
export interface DirectiveHandler {
    (el: HTMLElement, expr: string, scope: ReactiveObject, deps: Set<string>): void | Promise<void>;
}

/**
 * 组件配置选项
 */
export interface ComponentOptions {
    /** 组件 HTML 模板字符串 */
    template: string;

    /** 组件 CSS 样式字符串 */
    style?: string;

    /** 组件脚本逻辑工厂函数 */
    script?: (props: Record<string, unknown>, utils: Record<string, unknown>) => Record<string, unknown>;

    /** 组件属性定义（默认值） */
    pro?: Record<string, unknown>;

    /** 自动挂载的目标元素选择器或 DOM 元素 */
    to?: string | HTMLElement;

    /** 是否启用 CSS 作用域隔离，默认 true */
    sty?: boolean;

    /** 组件注册别名 */
    as?: string;
}

/**
 * 路由条目信息
 */
export interface RouteInfo {
    /** 路由处理函数 */
    handler: Function;

    /** 路由对应的目标容器名 */
    target: string;
}

/**
 * 路由页面容器信息
 */
export interface RoutePageInfo {
    /** 页面容器 DOM 元素 */
    container: HTMLElement;

    /** 所属目标容器名 */
    target: string;
}

/**
 * 路由管理器接口
 */
export interface Router {
    /** 已注册的路由映射表 */
    routes: Map<string, RouteInfo>;

    /** 各目标容器当前激活的路径 */
    currentPaths: Map<string, string>;

    /** 页面容器映射 */
    pageContainers: Map<string, RoutePageInfo>;

    /** 原始页面元素内容备份 */
    originalPageElements: Map<string, {html: string; target: string}>;

    /** 路由目标容器 DOM 引用 */
    routeTargets: Map<string, HTMLElement>;

    /** popstate 事件处理器引用（用于清理） */
    _popstateHandler: () => void;

    /** 注册路由 */
    add(path: string, handler: Function, target?: string): void;

    /** 导航到指定路径 */
    nav(path: string, replace?: boolean): void;

    /** 初始化路由系统 */
    init(): void;

    /** 解析当前 URL 中的路径参数 */
    _parsePath(): string;

    /** 执行指定路径的路由处理 */
    _executeRoute(path: string): void;

    /** 预渲染所有已注册的路由页面 */
    _prerenderAllPages(): void;

    /** 渲染单个路由页面 */
    _renderPage(path: string, targetName: string): void;

    /** 收集并移除 DOM 中的原始页面元素 */
    _collectAndRemoveOriginalPages(): void;
}

declare global {
    interface Window {
        /** 应用根作用域 */
        __rootScope: ReactiveObject;

        /** 组件重置缓存标记集合 */
        __componentResetCache?: Set<string>;

        /** 组件重置样式元素映射 */
        __componentResetStyles?: Map<string, HTMLStyleElement>;

        /** DOM 元素引用注册表 */
        $r: Record<string, HTMLElement>;

        /** 监听响应式数据变化 */
        watch: typeof watch;

        /** 创建响应式引用*/
        ref: <T>(initialValue: T) => Ref<T>;

        /** 创建响应式代理对象 */
        reactive: (target: unknown) => ReactiveObject;

        /** 向根作用域注入数据 */
        provide: (key: string | Record<string, unknown>, value?: unknown) => void;

        /** 定义组件 */
        dom: (compName: string, options: ComponentOptions) => unknown;

        /** 注册挂载完成回调 */
        onMounted: (callback: Function) => void;

        /** 路由管理器实例 */
        router: Router;
    }
}

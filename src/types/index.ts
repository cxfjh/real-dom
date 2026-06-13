import { batch, bind, bindText, compile, Dep, parser, watch } from "../core";
import { initDir, onElRemove } from "../utils/directive.ts";
import { regDir } from "../directives";


/**
 * 响应式引用对象 — Ref 模式
 * @template T - 响应式值的类型, 默认为 `unknown`
 */
export interface RefInterface<T = unknown> {
    /**
     * 引用的实际值
     */
    value: T;

    /**
     * 内部标识: 标记当前对象为 `RefInterface` 类型
     */
    __isRef: boolean;
}


/**
 * 响应式代理对象 — Reactive Proxy 模式
 */
export interface ReactiveInterface {
    /**
     * 内部标识: 标记原始对象已被 `reactive()` 处理
     */
    __isReactive?: boolean;

    /**
     * 指向原始 (未代理) 对象的引用
     */
    __raw?: unknown;

    /**
     * 内部标识: 标记当前实例为 Proxy 代理对象
     */
    __isReactiveProxy?: boolean;

    /**
     * 允许动态属性访问, 使用 `unknown` 保证类型安全
     *
     * @param key - 动态属性名
     * @returns 动态属性值
     */
    [key: string]: unknown;
}


/**
 * 依赖管理器接口
 */
export interface DepInterface {
    /**
     * 全量订阅者集合
     */
    subs: Set<Function>;

    /**
     * 按变量名分组的精准订阅者映射
     *
     * Key: 变量名, 如 "count"
     * Value: 订阅该函数的订阅者集合
     */
    varSubs: Map<string, Set<Function>>;

    /**
     * 通知禁用标志
     */
    _paused?: boolean;

    /**
     * 关联的 Proxy 代理对象引用
     */
    __proxy?: ReactiveInterface;

    /**
     * 添加订阅者
     *
     * @param fn       - 订阅者函数, 当数据变化时被调用
     * @param variable - 可选, 订阅的变量名; null 或 undefined 表示全量订阅
     */
    subscribe(fn: Function, variable?: string | null): void;

    /**
     * 移除订阅者
     *
     * @param fn       - 要移除的订阅者函数
     * @param variable - 可选, 指定变量名; null 或 undefined 表示从所有位置移除
     */
    unsubscribe(fn: Function, variable?: string | null): void;

    /**
     * 通知订阅者执行更新
     *
     * @param variable - 可选, 变化的变量名; null 或 undefined 表示通知所有订阅者
     */
    notify(variable?: string | null): void;
}


/**
 * 指令处理函数签名
 *
 * @param el    - 指令绑定的 DOM 元素
 * @param expr  - 指令表达式字符串
 * @param scope - 当前响应式作用域
 * @param deps  - 依赖变量集合, 用于收集表达式中的变量引用
 * @returns void 或 Promise<void> (异步指令)
 */
export interface DirectiveFn {
    (el: HTMLElement, expr: string, scope: ReactiveInterface, deps: Set<string>): void | Promise<void>;
}


/**
 * 组件配置选项
 */
export interface CompOptions {
    /**
     * 组件 HTML 模板字符串
     */
    template: string;

    /**
     * 组件 CSS 样式字符串 (可选)
     */
    style?: string;

    /**
     * 组件脚本逻辑工厂函数 (可选)
     */
    script?: (props: Record<string, unknown>, utils: Record<string, unknown>) => Record<string, unknown>;

    /**
     * 组件属性定义 (默认值) (可选)
     */
    props?: Record<string, unknown>;

    /**
     * 自动挂载的目标元素选择器 (可选)
     */
    to?: string;

    /**
     * 是否启用 CSS 作用域隔离 (可选, 默认 true)
     */
    sty?: boolean;
}


/**
 * 路由条目信息
 */
export interface RouteInfo {
    /**
     * 路由处理函数, 负责渲染该路由对应的页面内容
     */
    handler: Function;

    /**
     * 路由对应的目标容器名, 用于多容器路由场景
     */
    target: string;
}


/**
 * 路由页面容器信息
 */
export interface RoutePageInfo {
    /**
     * 页面容器 DOM 元素, 即带 r-page 属性的元素
     */
    container: HTMLElement;

    /**
     * 所属目标容器名, 对应 route 属性值, 默认 "default"
     */
    target: string;
}


/**
 * 路由管理器接口
 */
export interface RouterInterface {
    /**
     * 已注册的路由映射表
     *
     * Key: 路由路径, 如 "/home", "/about"
     * Value: 路由处理函数和目标容器名
     */
    routes: Map<string, RouteInfo>;

    /**
     * 各目标容器当前激活的路径
     *
     * Key: 目标容器名, 如 "default"
     * Value: 当前激活的路由路径, 如 "/home"
     */
    activePaths: Map<string, string>;

    /**
     * 页面容器映射
     *
     * Key: 路由路径, 如 "/home", "/about"
     * Value: 页面容器信息
     */
    pages: Map<string, RoutePageInfo>;

    /**
     * 原始页面元素内容备份
     *
     * Key: 路径字符串
     * Value: 页面的原始 HTML 和目标容器名
     */
    origPages: Map<string, {html: string; target: string}>;

    /**
     * 路由目标容器 DOM 引用
     *
     * Key: 目标容器名
     * Value: 容器 DOM 元素
     */
    targets: Map<string, HTMLElement>;

    /**
     * popstate 事件处理器引用
     */
    _popstateHandler: () => void;

    /**
     * 所有 r-route 元素集合
     */
    _routeEls: Set<HTMLElement>;

    /**
     * 注册 r-route 元素到路由系统
     *
     * @param el - 要注册的 r-route 元素
     */
    _registerRouteEl(el: HTMLElement): void;

    /**
     * 从路由系统注销 r-route 元素
     *
     * @param el - 要注册的 r-route 元素
     */
    _unregisterRouteEl(el: HTMLElement): void;

    /**
     * 注册路由
     *
     * @param path   - 路由路径, 如 "/home", "/about"
     * @param handler - 路由处理函数, 负责渲染页面内容
     * @param target  - 目标容器名, 默认 "default"
     */
    add(path: string, handler: Function, target?: string): void;

    /**
     * 导航到指定路径
     *
     * @param path    - 目标路径
     * @param replace - 是否替换当前历史记录 (false 则新增一条记录)
     */
    nav(path: string, replace?: boolean): void;

    /**
     * 初始化路由系统
     */
    init(): void;

    /**
     * 解析当前 URL 中的路径参数
     *
     * @returns 路径字符串, 无 path 参数时返回 "/"
     */
    _parsePath(): string;

    /**
     * 执行指定路径的路由处理
     *
     * @param path - 目标路径
     */
    _execRoute(path: string): void;

    /**
     * 预渲染所有已注册的路由页面
     */
    _preRenderAll(): void;

    /**
     * 渲染单个路由页面
     *
     * @param path       - 路由路径
     * @param targetName - 目标容器名
     */
    _renderPage(path: string, targetName: string): void;

    /**
     * 收集并移除 DOM 中的原始页面元素
     */
    _collectOrigPages(): void;
}


/**
 * 全局 API 接口 — window.RealDom 的类型定义
 */
export interface RealDomInterface {
    /**
     * 注册自定义指令
     */
    regDir: typeof regDir;

    /**
     * 表达式解析器
     */
    parser: typeof parser;

    /**
     * 批量更新管理器
     */
    batch: typeof batch;

    /**
     * DOM 编译函数
     */
    compile: typeof compile;

    /**
     * 元素绑定函数
     */
    bind: typeof bind;

    /**
     * 文本节点绑定函数
     */
    bindText: typeof bindText;

    /**
     * 依赖管理类
     */
    Dep: typeof Dep;

    /**
     * 元素移除监听
     */
    onElRemove: typeof onElRemove;

    /**
     * 指令初始化工具
     */
    initDir: typeof initDir;

    /**
     * 监听响应式数据变化
     */
    watch: typeof watch;

    /**
     * 创建响应式引用
     *
     * @param initialValue - 初始值
     * @returns RefInterface 实例
     */
    ref: <T>(initialValue: T) => RefInterface<T>;

    /**
     * 创建响应式代理对象
     *
     * @param target - 要代理的原始对象
     * @returns ReactiveInterface 代理对象
     */
    reactive: (target: unknown) => ReactiveInterface;

    /**
     * 向根作用域注入数据
     *
     * @param key   - 键名或键值对对象
     * @param value - 可选, 键对应的值
     */
    provide: (key: string | Record<string, unknown>, value?: unknown) => void;

    /**
     * 定义组件
     *
     * @param compName - 组件名称, 全局唯一
     * @param options  - 组件配置选项 (模板、样式、脚本、属性)
     * @returns 组件工厂函数 (如果设置了自动挂载, 返回 undefined)
     */
    dom: (compName: string, options: CompOptions) => unknown;

    /**
     * 注册挂载完成回调
     *
     * @param callback - 挂载完成时执行的回调函数
     */
    onMounted: (callback: Function) => void;

    /**
     * 路由管理器实例
     */
    router: RouterInterface;

    /**
     * 根作用域
     */
    readonly rootScope: ReactiveInterface | null;

    /**
     * 组件实例缓存
     *
     * Key: 组件根元素
     * Value: 组件实例
     */
    cpInsts: WeakMap<HTMLElement, unknown>;
}


/**
 * 全局 Window 类型
 */
declare global {
    interface Window {
        RealDom: RealDomInterface;
    }
}

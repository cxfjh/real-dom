import type { ReactiveInterface } from "../types";
import { INTERP_REGEX, VARIABLE_REGEX } from "../utils/constants.ts";
import { getKeys } from "../utils/directive.ts";


/**
 * 表达式解析器单例
 */
export const parser: ParserInterface = {
    /**
     * 全局变量白名单
     */
    _globals: new Set(["window", "document", "console", "alert"]),

    /**
     * 解析单个 JavaScript 表达式并求值
     *
     * @param expr      - 待解析的表达式字符串, 可能包含 `{{ }}` 包裹
     * @param scope     - 响应式作用域对象, 提供表达式变量的运行时值
     * @param deps      - 依赖收集器, 解析过程中自动添加引用的根变量名
     * @param unwrapRef - 是否自动解包 `RefInterface` 对象, 默认 `true`;
     */
    parse(expr: string, scope: ReactiveInterface = {} as ReactiveInterface, deps: Set<string> = new Set(), unwrapRef: boolean = true,): unknown {
        try {
            // 去除 {{ }} 包裹
            if (expr.charCodeAt(0) === 123 && expr.charCodeAt(1) === 123 && expr.charCodeAt(expr.length - 2) === 125 && expr.charCodeAt(expr.length - 1) === 125) expr = expr.slice(2, -2).trim();

            // 提取作用域键名, 作为编译函数的形参
            const keys = getKeys(scope);
            const cacheKey = getKey(expr, keys, unwrapRef);
            let entry = cache.get(cacheKey);

            // 缓存未命中 → 编译表达式
            if (!entry) {
                // 静态分析提取表达式中的变量名, 用于依赖收集
                const vars: string[] = expr.match(VARIABLE_REGEX) || [];

                // 动态编译, new Function 将作用域键名作为形参
                const fn = new Function(...keys, "return " + expr + ";");

                // LRU 淘汰, 缓存满时删除最早插入的条目
                if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
                entry = { fn, vars };
                cache.set(cacheKey, entry);
            }

            // 依赖收集
            const { vars } = entry;
            const globals = this._globals;

            for (let i = 0; i < vars.length; i++) {
                const v = vars[i];

                // 提取根变量: "a.b.c" → "a"
                const dotIdx = v.indexOf(".");
                const rootVar = dotIdx === -1 ? v : v.slice(0, dotIdx);

                // 跳过全局变量和已收集变量, 避免重复订阅
                if (!globals.has(rootVar) && !deps.has(rootVar)) deps.add(rootVar);
            }

            // 注入作用域值并执行
            const kl = keys.length;
            const values: unknown[] = new Array(kl);
            for (let i = kl; i--;) values[i] = scope[keys[i]];
            const result = entry.fn(...values);

            // Ref 自动解包
            return unwrapRef && (result as Record<string, unknown>)?.__isRef ? (result as Record<string, unknown>).value : result;
        } catch (e) {
            console.warn("[parser] 解析错误:", expr, e);
            return expr;
        }
    },

    /**
     * 解析包含 `{{ }}` 插值语法的文本字符串
     *
     * @param text      - 包含零个或多个 `{{ }}` 插值的模板文本
     * @param scope     - 响应式作用域对象, 传递给 `parse()` 进行变量求值
     * @param deps      - 依赖收集器, 传递给 `parse()` 进行依赖收集
     * @param unwrapRef - 是否自动解包 Ref 对象, 默认 `true`
     *
     * @returns 所有插值已被替换为求值结果的纯文本字符串
     */
    text(text: string, scope: ReactiveInterface = {} as ReactiveInterface, deps: Set<string> = new Set(), unwrapRef: boolean = true,): string {
        return text.replace(INTERP_REGEX, (_match, slash, expr) => {
            if (slash) return "{{" + expr.trim() + "}}"; // 转义处理: `\{{ }}` 保留原文, 不进行求值
            return String(this.parse(expr.trim(), scope, deps, unwrapRef));
        });
    },
};


/**
 * 编译函数缓存池
 */
const cache = new Map<string, CacheEntry>();


/**
 * 缓存容量上限
 */
const MAX_CACHE = 200;


/**
 * 生成编译缓存键
 *
 * @param expr      - 表达式字符串, 确保不含 `{{ }}` 包裹
 * @param keys      - 作用域键名列表, 由 `getKeys()` 产出
 * @param unwrapRef - Ref 自动解包开关, `true` 表示自动取 `.value`
 * @returns 唯一缓存键, 格式: `"expr\0key1,key2\00/1"`
 */
const getKey = (expr: string, keys: string[], unwrapRef: boolean): string => expr + "\x00" + keys.join(",") + "\x00" + (unwrapRef ? "1" : "0");


/**
 * 表达式解析器接口
 */
export interface ParserInterface {
    /**
     * 全局变量白名单, 可运行时扩展
     */
    _globals: Set<string>;

    /**
     * 解析单个 JavaScript 表达式并求值
     *
     * @param expr      - 表达式字符串
     * @param scope     - 响应式作用域对象
     * @param deps      - 依赖收集器
     * @param unwrapRef - Ref 自动解包开关
     * @returns 表达式计算结果
     */
    parse(expr: string, scope?: ReactiveInterface, deps?: Set<string>, unwrapRef?: boolean): unknown;

    /**
     * 解析包含 `{{ }}` 插值的文本字符串
     *
     * @param text      - 模板文本
     * @param scope     - 响应式作用域对象
     * @param deps      - 依赖收集器
     * @param unwrapRef - Ref 自动解包开关
     * @returns 插值替换后的纯文本
     */
    text(text: string, scope?: ReactiveInterface, deps?: Set<string>, unwrapRef?: boolean): string;
}


/**
 * 表达式编译缓存条目
 */
interface CacheEntry {
    /**
     * 编译好的表达式求值函数
     */
    fn: Function;

    /**
     * 表达式中引用的变量名列表
     */
    vars: string[];
}

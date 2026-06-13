import type { ReactiveInterface } from "../types";
import { INTERP_REGEX, VARIABLE_REGEX } from "../utils/constants.ts";
import { getKeys } from "../utils/directive.ts";


/**
 * 表达式解析器
 */
export const parser: ParserInterface = {
    /**
     * 全局变量白名单
     */
    _globals: new Set(["window", "document", "console", "alert"]),

    /**
     * 解析单个 JavaScript 表达式并求值
     *
     * @param expr - 待解析的表达式字符串, 可能包含 `{{ }}` 包裹
     * @param scope - 响应式作用域对象, 提供表达式中变量的值
     * @param deps - 依赖收集器 Set, 解析过程中自动添加引用的根变量名
     * @param unwrapRef - 是否自动解包 RefInterface 对象的 `.value`, 默认 true
     * @returns 表达式的计算结果, 解析失败时返回原始表达式字符串
     */
    parse(expr: string, scope: ReactiveInterface = {} as ReactiveInterface, deps: Set<string> = new Set(), unwrapRef: boolean = true,): unknown {
        try {
            // 去除表达式首尾的 {{ }} 包裹
            if (expr.charCodeAt(0) === 123 && expr.charCodeAt(1) === 123
                && expr.charCodeAt(expr.length - 2) === 125
                && expr.charCodeAt(expr.length - 1) === 125) {
                expr = expr.slice(2, -2).trim();
            }

            // 从作用域对象中提取所有键名, 作为编译函数的形参列表
            const keys = getKeys(scope);
            const cacheKey = getKey(expr, keys, unwrapRef);
            let entry = cache.get(cacheKey);

            // 缓存未命中, 编译表达式
            if (!entry) {
                // 使用 VARIABLE_REGEX 正则提取表达式中的变量名
                const vars: string[] = expr.match(VARIABLE_REGEX) || [];

                // 动态编译 new Function
                const fn = new Function(...keys, "return " + expr + ";");

                // LRU 淘汰超过上限时删除最早插入的条目
                if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
                entry = { fn, vars };
                cache.set(cacheKey, entry);
            }

            // 收集依赖
            const { vars } = entry;
            const globals = this._globals;

            // 遍历表达式中的变量名
            for (let i = 0; i < vars.length; i++) {
                const v = vars[i];
                // 提取根变量
                const dotIdx = v.indexOf(".");
                const rootVar = dotIdx === -1 ? v : v.slice(0, dotIdx);

                // 跳过全局变量和已收集的变量, 避免重复
                if (!globals.has(rootVar) && !deps.has(rootVar)) deps.add(rootVar);
            }

            // 注入作用域值并执行编译函数
            const values: unknown[] = new Array(keys.length);
            for (let i = 0; i < keys.length; i++) values[i] = scope[keys[i]];
            const result = entry.fn(...values);

            // Ref 自动解包
            return unwrapRef && (result as Record<string, unknown>)?.__isRef ? (result as Record<string, unknown>).value : result;
        } catch (e) {
            // 解析失败时返回原始表达式, 不阻断页面渲染
            console.warn("[parser] 解析错误:", expr, e);
            return expr;
        }
    },

    /**
     * 解析包含 {{ }} 插值的文本字符串
     *
     * @param text - 包含插值表达式的模板文本, 可能包含零个或多个 `{{ }}`
     * @param scope - 响应式作用域对象, 提供插值中变量的值
     * @param deps - 依赖收集器, 传递给 `parse()` 进行依赖收集
     * @param unwrapRef - 是否自动解包 RefInterface 对象的 `.value`, 默认 true
     * @returns 替换所有插值后的纯文本字符串
     */
    text(text: string, scope: ReactiveInterface = {} as ReactiveInterface, deps: Set<string> = new Set(), unwrapRef: boolean = true): string {
        return text.replace(INTERP_REGEX, (_match, slash, expr) => {
            if (slash) return "{{" + expr.trim() + "}}";
            return String(this.parse(expr.trim(), scope, deps, unwrapRef));
        });
    },
};


/**
 * 编译函数缓存
 */
const cache = new Map<string, CacheEntry>();


/**
 * 缓存容量上限
 */
const MAX_CACHE = 200;


/**
 * 生成缓存键
 *
 * @param expr - 表达式字符串 (已去除 {{ }} 包裹)
 * @param keys - 作用域键名列表 (已排序)
 * @param unwrapRef - 是否自动解包 RefInterface 对象的 `.value`
 * @returns 唯一的缓存键字符串
 */
const getKey = (expr: string, keys: string[], unwrapRef: boolean): string => expr + "\x00" + keys.join(",") + "\x00" + (unwrapRef ? "1" : "0");


/**
 * 表达式解析器接口
 */
export interface ParserInterface {
    /**
     * 全局变量白名单
     */
    _globals: Set<string>;

    /**
     * 解析单个 JavaScript 表达式并求值
     *
     * @param expr - 待解析的表达式字符串
     * @param scope - 响应式作用域对象
     * @param deps - 依赖收集器, 解析过程中自动添加引用的变量名
     * @param unwrapRef - 是否自动解包 RefInterface 对象
     * @returns 表达式的计算结果
     */
    parse(expr: string, scope?: ReactiveInterface, deps?: Set<string>, unwrapRef?: boolean): unknown;

    /**
     * 解析包含 {{}} 插值的文本字符串
     *
     * @param text - 包含插值表达式的模板文本
     * @param scope - 响应式作用域对象
     * @param deps - 依赖收集器
     * @param unwrapRef - 是否自动解包 RefInterface 对象
     * @returns 替换所有插值后的纯文本字符串
     */
    text(text: string, scope?: ReactiveInterface, deps?: Set<string>, unwrapRef?: boolean): string;
}


/**
 * LRU 缓存条目
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

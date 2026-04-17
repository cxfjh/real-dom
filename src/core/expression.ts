import type { ExpressionParser, ReactiveObject } from "../types";
import { INTERPOLATION_REGEX, VARIABLE_REGEX } from "../utils/constants.ts";

/**
 * 表达式解析器单例
 */
export const expressionParser: ExpressionParser = {
    /** 全局变量白名单（这些变量不参与依赖收集） */
    _globals: new Set(["window", "document", "console", "alert"]),

    /**
     * 解析单个 JavaScript 表达式
     *
     * @param expr - 待解析的表达式字符串
     * @param scope - 作用域对象，提供表达式中变量的值
     * @param deps - 依赖收集器，解析过程中自动添加引用的变量名
     * @param unwrapRef - 是否自动解包 Ref 对象的 .value，默认 true
     * @returns 表达式的计算结果；解析失败时返回原始表达式字符串
     */
    parse(expr: string, scope: ReactiveObject = {} as ReactiveObject, deps: Set<string> = new Set(), unwrapRef: boolean = true): unknown {
        try {
            // 收集表达式中的变量依赖
            const vars = expr.match(VARIABLE_REGEX) || [];
            vars.forEach(v => {
                const rootVar = v.split(".")[0];
                if (rootVar && !this._globals.has(rootVar) && !deps.has(rootVar)) deps.add(rootVar);
            });

            // 去除外层 {{}} 包裹（兼容直接传入插值表达式的场景）
            if (expr.startsWith("{{") && expr.endsWith("}}")) expr = expr.slice(2, -2).trim();

            // 构建沙箱函数：以作用域的 key 作为形参，实现变量注入
            const keys = Object.keys(scope);
            const values = keys.map(k => scope[k]);
            const evaluator = new Function(...keys, `return ${ expr };`);
            const result = evaluator(...values);

            // 根据参数决定是否自动解包 Ref 对象
            return unwrapRef && (result as Record<string, unknown>)?.__isRef ? (result as Record<string, unknown>).value : result;
        } catch (e) {
            console.warn("[ExpressionParser] 解析错误:", expr, e);
            return expr;
        }
    },

    /**
     * 解析包含 {{}} 插值的文本字符串
     *
     * @param text - 包含插值表达式的模板文本
     * @param scope - 作用域对象
     * @param deps - 依赖收集器
     * @param unwrapRef - 是否自动解包 Ref 对象，默认 true
     * @returns 替换所有插值后的纯文本字符串
     */
    parseText(text: string, scope: ReactiveObject = {} as ReactiveObject, deps: Set<string> = new Set(), unwrapRef: boolean = true,): string {
        return text.replace(INTERPOLATION_REGEX, (_match, expr) => String(this.parse(expr.trim(), scope, deps, unwrapRef)),);
    },
};

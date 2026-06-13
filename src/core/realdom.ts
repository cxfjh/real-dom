import type { CompOptions } from "../types";
import { batch, comp, reactive, ref, bind, Dep, parser, compile, bindText, watch } from "../core";
import "../directives/index.ts";
import { regDir } from "../directives";
import { router } from "../router";
import { cpInsts, mountCbs, pendProv, rootScope } from "../utils/shared.ts";
import { initDir, onElRemove } from "../utils/directive.ts";


/**
 * 全局 API 类
 */
export class RealDom {
    /**
     * 注册自定义指令
     */
    public static regDir = regDir;

    /**
     * 表达式解析器
     */
    public static parser = parser;

    /**
     * 批量更新管理器
     */
    public static batch = batch;

    /**
     * DOM 处理 API
     */
    public static compile = compile;

    /**
     * 元素更新函数
     */
    public static bind = bind;

    /**
     * 文本节点处理
     */
    public static bindText = bindText;

    /**
     * 依赖管理类
     */
    public static Dep = Dep;

    /**
     * 元素删除监听
     */
    public static onElRemove = onElRemove;

    /**
     * 指令初始化工具
     */
    public static initDir = initDir;

    /**
     * 创建响应式引用
     */
    public static ref = ref;

    /**
     * 创建响应式代理对象
     */
    public static reactive = reactive;

    /**
     *  监听响应式数据变化
     */
    public static watch = watch;

    /**
     * 根作用域
     */
    public static get rootScope() { return rootScope; }

    /**
     *  组件实例缓存
     */
    public static cpInsts = cpInsts;

    /**
     *  路由管理器
     */
    public static router = router;

    /**
     *  注入数据
     */
    public static provide = (key: string | Record<string, unknown>, value: unknown = null): void => {
        if (typeof key !== "object") pendProv.push([key, value]);
        else for (const [k, v] of Object.entries(key)) pendProv.push([k, v]);
    };

    /**
     *  定义组件
     */
    public static dom = (compName: string, options: CompOptions): unknown => comp(compName, options);

    /**
     *  注册挂载完成回调
     */
    public static onMounted = (callback: Function): void => {
        if (typeof callback === "function") mountCbs.push(callback);
        else console.warn("onMounted 只接受函数作为参数.");
    };
}

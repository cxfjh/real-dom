import type { ReactiveObject } from "../types";
import { INTERPOLATION_REGEX, VARIABLE_REGEX } from "../utils/constants.ts";
import { activeFns, depsMap, elDeps } from "../utils/shared.ts";
import { expressionParser, processElement } from "../core";
import { registerDirective } from "./registry.ts";

/**
 * 注册 r-api 指令
 *
 * @remarks
 * 支持的属性配置：
 * - `meth` - HTTP 方法（默认 GET）
 * - `hdr` - 请求头（JSON 字符串或表达式）
 * - `list` - 响应中的数组字段名
 * - `key` - 数组项唯一键属性（默认 "id"）
 * - `value` - 模板中的项变量名（默认 "value"）
 * - `index` - 模板中的索引变量名（默认 "index"）
 * - `arr` - 将整个数组注入作用域的变量名
 * - `refr` - 刷新按钮选择器
 * - `aw` - 手动加载模式标志
 * - `data-body` - POST 请求体表达式
 */
registerDirective("r-api", async (el: HTMLElement, urlExpr: string, scope: ReactiveObject, deps: Set<string>): Promise<void> => {
    // 避免重复处理
    if ((el as unknown as Record<string, unknown>).__apiProcessed) return;
    (el as unknown as Record<string, unknown>).__apiProcessed = true;

    // 核心状态
    let isRequestDone = false;
    let currentData: unknown = null;
    let lastRenderedData: unknown = null;
    const nodeCache = new Map<string, {el: DocumentFragment; scope: ReactiveObject}>();
    const templateHTML = el.innerHTML;

    // 解析配置属性
    const getConfig = () => {
        // 获取配置属性
        const headersAttr = el.getAttribute("hdr");
        let headers: Record<string, string> = { "Content-Type": "application/json" };

        if (headersAttr) {
            try {
                // 尝试解析 JSON 字符串
                const parsed = JSON.parse(headersAttr);
                if (parsed && typeof parsed === "object") headers = parsed;
            } catch (_jsonError) {
                try {
                    // 尝试解析表达式结果为 JSON 字符串
                    const exprResult = expressionParser.parse(headersAttr, scope, deps);
                    if (typeof exprResult === "string") {
                        const parsedFromString = JSON.parse(exprResult);
                        if (parsedFromString && typeof parsedFromString === "object") headers = parsedFromString;
                    } else if (exprResult && typeof exprResult === "object") headers = exprResult as Record<string, string>;
                } catch (exprError) {
                    console.warn("[r-api] headers 解析失败:", headersAttr, exprError);
                }
            }
        }

        return {
            method: (el.getAttribute("meth") || "GET").toUpperCase(),
            headers,
            listKey: el.getAttribute("list"),
            itemKey: el.getAttribute("key") || "id",
            templateVar: el.getAttribute("value") || "value",
            indexKey: el.getAttribute("index") || "index",
            arrKey: el.getAttribute("arr"),
            refreshSelector: el.getAttribute("refr"),
            isManualLoad: el.hasAttribute("aw"),
        };
    };

    // 获取配置
    const config = getConfig();

    // 动态解析 URL（支持插值和变量引用）
    const parseDynamicUrl = () => {
        // 解析 URL 表达式，获取依赖变量
        const urlDeps = new Set<string>();
        let requestUrl = urlExpr;

        // 使用插值表达式解析 URL
        if (INTERPOLATION_REGEX.test(urlExpr)) requestUrl = expressionParser.parseText(urlExpr, scope, urlDeps);
        else {
            const vars = urlExpr.match(VARIABLE_REGEX) || [];
            vars.forEach(v => {
                const rootVar = v.split(".")[0];
                if (rootVar && !expressionParser._globals.has(rootVar)) {
                    urlDeps.add(rootVar);
                    try {
                        const value = expressionParser.parse(urlExpr, scope, new Set());
                        if (value && typeof value === "string") requestUrl = value;
                    } catch (_e) {}
                }
            });
        }

        return { requestUrl, urlDeps };
    };

    // 创建基础作用域
    const createBaseScope = (data: unknown) => {
        const baseScope: Record<string, unknown> = { ...scope, _aw: isRequestDone };
        if (config.arrKey) baseScope[config.arrKey] = data;
        return window.reactive(baseScope);
    };

    // 渲染数组数据
    const renderArray = (data: unknown[], fragment: DocumentFragment): void => {
        data.forEach((item, index) => {
            // 处理数组项
            const itemObj = item as unknown as Record<string, unknown>;
            const itemUniqueKey = itemObj[config.itemKey] ?? index;

            // 尝试从缓存中获取节点
            let cachedNode = nodeCache.get(String(itemUniqueKey));

            // 如果缓存中存在节点，则更新节点数据
            if (cachedNode) {
                cachedNode.scope[config.templateVar] = item;
                cachedNode.scope[config.indexKey] = index;
                (cachedNode.scope as unknown as Record<string, unknown>)._aw = isRequestDone;
            } else {
                // 创建新节点
                const tempContainer = document.createElement("div");
                tempContainer.innerHTML = templateHTML;

                // 创建新节点的 scope
                const itemScope = window.reactive({ ...scope, [config.templateVar]: item, [config.indexKey]: index, _aw: isRequestDone, });
                processElement(tempContainer, itemScope);

                // 创建新节点的 fragment
                const itemFragment = document.createDocumentFragment();
                Array.from(tempContainer.childNodes).forEach(node => itemFragment.appendChild(node));

                //  缓存新节点
                cachedNode = { el: itemFragment, scope: itemScope };
                nodeCache.set(String(itemUniqueKey), cachedNode);
            }
            fragment.appendChild(cachedNode.el);
        });
    };

    // 渲染对象数据
    const renderObject = (data: unknown, fragment: DocumentFragment): void => {
        // 处理对象数据
        const objScope = window.reactive({ ...scope, [config.templateVar]: data, _aw: isRequestDone });

        // 创建对象数据的 scope
        const tempContainer = document.createElement("div");
        tempContainer.innerHTML = templateHTML;

        // 创建对象数据的 fragment
        processElement(tempContainer, objScope);
        Array.from(tempContainer.childNodes).forEach(node => fragment.appendChild(node));
    };

    // 核心渲染函数
    const renderTemplate = (data: unknown): void => {
        if (JSON.stringify(data) === JSON.stringify(lastRenderedData)) return;

        // 清空内容
        el.textContent = "";
        const fragment = document.createDocumentFragment();
        const baseScope = createBaseScope(data);

        // 处理数组数据
        if (config.arrKey) {
            const tempContainer = document.createElement("div");
            tempContainer.innerHTML = templateHTML;
            processElement(tempContainer, baseScope);
            Array.from(tempContainer.childNodes).forEach(node => fragment.appendChild(node));
        }
        else if (Array.isArray(data)) renderArray(data, fragment);
        else if (data && typeof data === "object") renderObject(data, fragment);

        // 更新内容
        el.appendChild(fragment);
        lastRenderedData = data;
    };

    // 发起请求并渲染
    const fetchAndRender = async (): Promise<void> => {
        // 设置请求开始标志
        isRequestDone = false;
        renderTemplate(currentData);

        try {
            // 解析动态 URL
            const { requestUrl } = parseDynamicUrl();
            if (!requestUrl) new Error("API URL不能为空");

            // 确定是否需要请求体
            const needBody = ["POST", "PUT", "PATCH"].includes(config.method);
            const requestBody = needBody ? JSON.stringify(expressionParser.parse(el.getAttribute("data-body") || "{}", scope, deps)) : null;

            // 发起请求
            const response = await fetch(requestUrl, {
                method: config.method,
                headers: config.headers,
                body: requestBody,
            });

            // 检查响应状态
            if (!response.ok) new Error(`请求失败：${ response.status } ${ response.statusText }`);

            // 解析响应数据
            const responseData = await response.json();
            currentData = config.listKey ? (responseData as unknown as Record<string, unknown>)[config.listKey] : responseData;

            // 更新数据
            isRequestDone = true;
            renderTemplate(currentData);
        } catch (error) {
            console.error("[r-api] 请求错误：", (error as Error).message);
            isRequestDone = true;
            renderTemplate(null);
        }
    };

    // 手动加载模式的初始渲染
    const init = (): void => {
        // 创建初始作用域
        const initScope = createBaseScope(null);
        const fragment = document.createDocumentFragment();
        const itemFragment = document.createDocumentFragment();

        // 克隆模板节点
        Array.from(el.childNodes).forEach(node => itemFragment.appendChild(node.cloneNode(true)));
        fragment.appendChild(itemFragment);

        // 处理初始节点
        activeFns.push(() => processElement(fragment as unknown as HTMLElement, initScope));
        try {
            activeFns[activeFns.length - 1]();
        } finally {
            activeFns.pop();
        }

        // 清空内容
        el.textContent = "";
        el.appendChild(fragment);
        renderTemplate(null);
    };

    // 设置动态 URL 依赖监听
    const setupDynamicUrlDependency = (): void => {
        const { urlDeps } = parseDynamicUrl();
        urlDeps.forEach(varName => depsMap.get(scope)?.subscribe(async () => await fetchAndRender(), varName),);
    };

    // 执行初始化
    if (!config.isManualLoad) await fetchAndRender();
    else init();

    // 设置动态 URL 依赖监听
    setupDynamicUrlDependency();

    // 刷新按钮绑定
    if (config.refreshSelector) {
        const refreshBtn = document.querySelector(config.refreshSelector);
        if (refreshBtn && !(refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler) {
            // 绑定刷新按钮点击事件
            (refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler = () => fetchAndRender();
            refreshBtn.addEventListener("click", (refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler as EventListener);

            // 解绑刷新按钮点击事件
            el.addEventListener("beforeunload", () => {
                refreshBtn.removeEventListener("click", (refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler as EventListener);
                (refreshBtn as unknown as Record<string, unknown>).__apiRefreshHandler = null;
            });
        }
    }

    // 依赖订阅
    const depSet = elDeps.get(el) || new Set<string>();
    depSet.forEach(varName => depsMap.get(scope)?.subscribe(async () => await fetchAndRender(), varName),);
});

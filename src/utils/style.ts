/**
 * 为 CSS 字符串添加作用域属性选择器
 *
 * @param css - 原始 CSS 字符串
 * @param scopedId - 唯一作用域标识
 * @returns 添加作用域后的 CSS 字符串
 */
export const addStyleScope = (css: string, scopedId: string): string => {
    // 去除注释
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const result: string[] = [];
    let i = 0;
    const len = cleanCss.length;

    // 遍历 CSS 字符串
    while (i < len) {
        if (cleanCss[i] === "@") {
            // @规则处理（@media、@keyframes 等）
            const atRuleEnd = findMatchingBrace(cleanCss, i);
            if (atRuleEnd === -1) break;
            result.push(processAtRule(cleanCss.substring(i, atRuleEnd + 1), scopedId));
            i = atRuleEnd + 1;
        } else {
            // 普通 CSS 规则处理
            const ruleEnd = cleanCss.indexOf("}", i);
            if (ruleEnd === -1) break;
            result.push(processCSSRule(cleanCss.substring(i, ruleEnd + 1), scopedId));
            i = ruleEnd + 1;
        }
    }

    // 拼接结果
    return result.join("");
};

/**
 * 为 DOM 元素树递归添加作用域数据属性
 *
 * @param element - 根元素或文档片段
 * @param scopedId - 唯一作用域标识
 * @param isolationEnabled - 是否启用隔离
 */
export const addScopeToDOM = (element: HTMLElement | DocumentFragment, scopedId: string, isolationEnabled: boolean = true,): void => {
    if (element.nodeType === Node.ELEMENT_NODE) {
        if (isolationEnabled) (element as HTMLElement).setAttribute(`data-v-${ scopedId }`, "");
        if ((element as HTMLElement).children) {
            const children = (element as HTMLElement).children;
            for (let i = 0; i < children.length; i++) addScopeToDOM(children[i] as HTMLElement, scopedId, isolationEnabled);
        }
    } else if (element.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        const children = (element as DocumentFragment).children;
        for (let i = 0; i < children.length; i++) addScopeToDOM(children[i] as HTMLElement, scopedId, isolationEnabled);
    }
};

/**
 * 在字符串中查找匹配的闭合大括号位置
 *
 * @param str - 待搜索的字符串
 * @param start - 起始位置
 * @returns 匹配的闭合大括号索引，未找到返回 -1
 */
const findMatchingBrace = (str: string, start: number): number => {
    let braceCount = 0;
    let inString = false;
    let stringChar = "";

    // 遍历字符串
    for (let i = start; i < str.length; i++) {
        const char = str[i];
        if ((char === "\"" || char === "'") && !inString) {
            inString = true;
            stringChar = char;
        } else if (char === stringChar && inString) inString = false;
        if (inString) continue;
        if (char === "{") braceCount++;
        else if (char === "}") {
            braceCount--;
            if (braceCount === 0) return i;
        }
    }

    return -1;
};

/**
 * 处理 @规则中的作用域（递归处理嵌套规则）
 *
 * @param atRule - 完整的 @规则字符串
 * @param scopedId - 唯一作用域标识
 * @returns 添加作用域后的 @规则字符串
 */
const processAtRule = (atRule: string, scopedId: string): string => {
    // 匹配 @规则和大括号内容
    const atRuleMatch = atRule.match(/^(@[^{]+)\{([^]*)}$/);
    if (!atRuleMatch) return atRule;

    // 提取 @规则名称和大括号内内容
    const atRuleName = atRuleMatch[1].trim();
    const innerContent = atRuleMatch[2].trim();

    // 处理嵌套的 @规则和 CSS 规则
    let processedInner = "";
    let j = 0;
    const innerLen = innerContent.length;

    // 遍历大括号内内容
    while (j < innerLen) {
        if (innerContent[j] === "@") {
            const innerAtRuleEnd = findMatchingBrace(innerContent, j);
            if (innerAtRuleEnd === -1) break;
            processedInner += processAtRule(innerContent.substring(j, innerAtRuleEnd + 1), scopedId);
            j = innerAtRuleEnd + 1;
        } else {
            const innerRuleEnd = innerContent.indexOf("}", j);
            if (innerRuleEnd === -1) break;
            processedInner += processCSSRule(innerContent.substring(j, innerRuleEnd + 1), scopedId);
            j = innerRuleEnd + 1;
        }
    }

    // 拼接结果
    return `${ atRuleName } { ${ processedInner } }`;
};

/**
 * 处理单条 CSS 规则的作用域
 *
 * @param rule - 完整的 CSS 规则字符串（含选择器和声明块）
 * @param scopedId - 唯一作用域标识
 * @returns 添加作用域后的 CSS 规则字符串
 */
const processCSSRule = (rule: string, scopedId: string): string => {
    const ruleMatch = rule.match(/^([^{]+)\{([^}]*)}$/);
    if (!ruleMatch) return rule;

    const selectors = ruleMatch[1].trim();
    const declarations = ruleMatch[2].trim();

    if (!selectors || !declarations) return rule;
    const dataAttr = `[data-v-${ scopedId }]`;

    // 全局选择器不添加作用域
    if (selectors === ":root" || selectors === "html" || selectors === "body") return `${ selectors } { ${ declarations } }`;

    const scopedSelectors = selectors
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(selector => {
            // 深层选择器（样式穿透）
            if (selector.includes(">>>") || selector.includes("/deep/") || selector.includes("::v-deep")) return processDeepSelector(selector, scopedId);

            // 含伪类/伪元素的选择器
            const selectorParts = selector.split(/:|::|\.|#|\[/);
            if (selectorParts.length > 1) {
                const baseSelector = selectorParts[0];
                const rest = selector.substring(baseSelector.length);
                return `${ baseSelector }${ dataAttr }${ rest }`;
            }

            // 普通选择器
            return `${ selector }${ dataAttr }`;
        })
        .join(", ");

    return `${ scopedSelectors } { ${ declarations } }`;
};

/**
 * 处理深层选择器语法（>>>、/deep/、::v-deep）
 *
 * @param selector - 含深层选择器语法的选择器
 * @param scopedId - 唯一作用域标识
 * @returns 转换后的选择器字符串
 */
const processDeepSelector = (selector: string, scopedId: string): string => {
    const dataAttr = `[data-v-${ scopedId }]`;
    if (selector.includes(">>>")) return selector.replace(/\s*>>>\s*/g, ` ${ dataAttr } `);
    if (selector.includes("/deep/")) return selector.replace(/\s*\/deep\/\s*/g, ` ${ dataAttr } `);
    if (selector.includes("::v-deep")) return selector.replace(/::v-deep\s*/g, `${ dataAttr } `);
    return selector;
};

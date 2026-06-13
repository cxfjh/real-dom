/**
 * 为 CSS 字符串添加作用域属性选择器
 *
 * @param css      - 原始 CSS 字符串
 * @param scopedId - 唯一作用域标识
 * @returns 添加作用域后的 CSS 字符串
 */
export const scopeCSS = (css: string, scopedId: string): string => {
    // 去除 CSS 注释, 避免注释中的选择器被错误处理
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");

    // 结果数组, 逐条规则处理后 push 到此处, 最后 join 返回
    const result: string[] = [];

    // 遍历索引
    let i = 0;
    const len = cleanCss.length;

    // 遍历 CSS 字符串, 逐字符扫描
    while (i < len) {
        if (cleanCss[i] === "@") {
            // 处理 @media、@keyframes、@supports 等 @规则
            const atRuleEnd = findBrace(cleanCss, i);
            if (atRuleEnd === -1) break;  // 未找到匹配大括号, CSS 语法错误, 终止处理
            result.push(scopeAtRule(cleanCss.substring(i, atRuleEnd + 1), scopedId));
            i = atRuleEnd + 1;  // 跳过已处理的 @规则
        } else {
            // 处理普通 CSS 规则, 如 ".title { color: red; }"
            const ruleEnd = cleanCss.indexOf("}", i);
            if (ruleEnd === -1) break;  // 未找到闭合大括号, CSS 语法错误, 终止处理
            result.push(scopeRule(cleanCss.substring(i, ruleEnd + 1), scopedId));
            i = ruleEnd + 1;  // 跳过已处理的规则
        }
    }

    // 拼接所有处理结果, 返回完整的 Scoped CSS
    return result.join("");
};


/**
 * 为 DOM 元素树递归添加作用域数据属性
 *
 * @param element           - 根元素或文档片段, 通常是组件模板的解析结果
 * @param scopedId          - 唯一作用域标识
 * @param isolationEnabled  - 是否启用隔离, 默认 true; false 时仅遍历不添加属性
 */
export const scopeDOM = (element: HTMLElement | DocumentFragment, scopedId: string, isolationEnabled: boolean = true,): void => {
    if (element.nodeType === Node.ELEMENT_NODE) {
        // 元素节点, 添加作用域属性
        if (isolationEnabled) (element as HTMLElement).setAttribute(`data-v-${ scopedId }`, "");

        // 递归处理子元素
        if ((element as HTMLElement).children) {
            const children = (element as HTMLElement).children;
            for (let i = 0; i < children.length; i++) scopeDOM(children[i] as HTMLElement, scopedId, isolationEnabled);
        }
    } else if (element.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        // 文档片段, 不添加属性, 仅递归处理子元素
        const children = (element as DocumentFragment).children;
        for (let i = 0; i < children.length; i++) scopeDOM(children[i] as HTMLElement, scopedId, isolationEnabled);
    }
};


/**
 * 在字符串中查找匹配的闭合大括号位置
 *
 * @param str   - 待搜索的 CSS 字符串
 * @param start - 起始位置, 通常是 `@` 字符的索引
 * @returns 匹配的闭合大括号索引, 未找到返回 -1
 */
const findBrace = (str: string, start: number): number => {
    // 大括号嵌套计数器
    let braceCount = 0;

    // 是否在字符串字面量内
    let inString = false;

    // 字符串字面量的引号字符 (" 或 ')
    let stringChar = "";

    // 从 start 位置开始遍历
    for (let i = start; i < str.length; i++) {
        const char = str[i];

        // 进入字符串模式: 遇到引号且不在字符串内
        if ((char === "\"" || char === "'") && !inString) {
            inString = true;
            stringChar = char;
        } else if (char === stringChar && inString) inString = false; // 退出字符串模式

        // 字符串内的字符忽略, 不计入括号计数
        if (inString) continue;

        // 括号计数
        if (char === "{") braceCount++;
        else if (char === "}") {
            braceCount--;
            if (braceCount === 0) return i;
        }
    }

    // 未找到匹配的闭合大括号, CSS 语法可能有问题
    return -1;
};


/**
 * 处理 @规则中的作用域 — 递归处理嵌套规则
 *
 * @param atRule   - 完整的 @规则字符串
 * @param scopedId - 唯一作用域标识
 * @returns 添加作用域后的 @规则字符串
 */
const scopeAtRule = (atRule: string, scopedId: string): string => {
    // 匹配 @规则名称和大括号内内容
    const match = atRule.match(/^(@[^{]+)\{([^]*)}$/);
    if (!match) return atRule;  // 格式不匹配, 原样返回

    // 提取 @规则名称
    const atRuleName = match[1].trim();

    // 提取大括号内内容
    const innerContent = match[2].trim();

    // 处理内部嵌套的 @规则和 CSS 规则
    let processedInner = "";
    let j = 0;
    const len = innerContent.length;

    // 遍历大括号内内容, 与 scopeCSS 的主循环逻辑相同
    while (j < len) {
        if (innerContent[j] === "@") {
            // 嵌套的 @规则, 递归调用 scopeAtRule 处理
            const innerAtRuleEnd = findBrace(innerContent, j);
            if (innerAtRuleEnd === -1) break;
            processedInner += scopeAtRule(innerContent.substring(j, innerAtRuleEnd + 1), scopedId);
            j = innerAtRuleEnd + 1;
        } else {
            // 普通 CSS 规则, 调用 scopeRule 处理
            const innerRuleEnd = innerContent.indexOf("}", j);
            if (innerRuleEnd === -1) break;
            processedInner += scopeRule(innerContent.substring(j, innerRuleEnd + 1), scopedId);
            j = innerRuleEnd + 1;
        }
    }

    // 拼接
    return `${ atRuleName } { ${ processedInner } }`;
};


/**
 * 处理单条 CSS 规则的作用域 — 为选择器添加
 *
 * @param rule     - 完整的 CSS 规则字符串
 * @param scopedId - 唯一作用域标识
 * @returns 添加作用域后的 CSS 规则字符串
 */
const scopeRule = (rule: string, scopedId: string): string => {
    // 分离选择器和声明块
    const match = rule.match(/^([^{]+)\{([^}]*)}$/);
    if (!match) return rule;  // 格式不匹配, 原样返回

    const selectors = match[1].trim();      // 选择器部分
    const declarations = match[2].trim();   // 声明块部分
    if (!selectors || !declarations) return rule;  // 空选择器或空声明块, 原样返回

    // 作用域属性选择器
    const dataAttr = `[data-v-${ scopedId }]`;

    // 全局选择器不添加作用域, 原样返回
    if (selectors === ":root" || selectors === "html" || selectors === "body") return `${ selectors } { ${ declarations } }`;

    // 处理多个选择器
    const scopedSelectors = selectors
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(selector => {
            // 支持 >>>, /deep/, ::v-deep 三种语法
            if (selector.includes(">>>") || selector.includes("/deep/") || selector.includes("::v-deep")) return processDeep(selector, scopedId);

            // 分割选择器, 提取基选择器和后缀
            const selectorParts = selector.split(/:|::|\.|#|\[/);
            if (selectorParts.length > 1) {
                const baseSelector = selectorParts[0];
                const suffix = selector.substring(baseSelector.length);
                return `${ baseSelector }${ dataAttr }${ suffix }`;
            }

            // 直接在选择器后追加作用域属性
            return `${ selector }${ dataAttr }`;
        })
        .join(", ");

    return `${ scopedSelectors } { ${ declarations } }`;
};


/**
 * 处理深层选择器语法
 *
 * @param selector - 含深层选择器语法的选择器`
 * @param scopedId - 作用域标识
 * @returns 转换后的选择器字符串
 */
const processDeep = (selector: string, scopedId: string): string => {
    const dataAttr = `[data-v-${ scopedId }]`;

    // 正则 `\s*>>>\s*` 匹配前后可能存在的空白字符
    if (selector.includes(">>>")) return selector.replace(/\s*>>>\s*/g, ` ${ dataAttr } `);

    // 正则 `\s*\/deep\/\s*` 匹配前后可能存在的空白字符, `/` 需要转义
    if (selector.includes("/deep/")) return selector.replace(/\s*\/deep\/\s*/g, ` ${ dataAttr } `);

    // 正则 `::v-deep\s*` 匹配后面可能存在的空白字符
    if (selector.includes("::v-deep")) return selector.replace(/::v-deep\s*/g, `${ dataAttr } `);

    // 无匹配的深层选择器语法, 原样返回
    return selector;
};

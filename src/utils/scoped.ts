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

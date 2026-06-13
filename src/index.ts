import { compile, reactive } from "./core";
import { RealDom } from "./core/realdom.ts";
import "./directives/index.ts";
import { router } from "./router";
import { dirs, mountCbs, pendProv, setRootScope } from "./utils/shared.ts";
import { observer } from "./utils/directive.ts";


/**
 * 挂载 API 到全局 window 对象
 */
window.RealDom = RealDom;


/**
 * DOMContentLoaded 事件处理 — 应用启动主流程
 */
document.addEventListener("DOMContentLoaded", (): void => {
    // 创建根作用域
    const rootScope = reactive({});
    setRootScope(rootScope);

    // 查找应用根元素
    const appEl = document.querySelector("[r-app]");
    const appRoot = appEl || document.body;

    // 注入 Provide 数据
    pendProv.forEach(([key, value]) => (rootScope as Record<string, unknown>)[key] = value);
    pendProv.length = 0;

    // 编译 DOM
    compile(appRoot as HTMLElement, rootScope);

    // 启动 DOM 变更监听
    observer.observe(appRoot as Node, { childList: true, subtree: true, attributes: true, attributeFilter: Array.from(dirs.keys()), });

    // 初始化路由系统
    router.init();

    // 延迟执行 onMounted 回调
    setTimeout(() => {
        // 执行所有通过 RealDom.onMounted() 注册的回调
        mountCbs.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error("[onMounted] 回调函数执行出错:", error);
            }
        });

        // 清空回调队列, 释放内存
        mountCbs.length = 0;
    });
});


// 导出 RealDom 类
export default RealDom;

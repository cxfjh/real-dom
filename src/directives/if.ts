import type { ReactiveObject } from "../types";
import { activeFns } from '../utils/shared.ts';
import { expressionParser } from "../core";
import { registerDirective } from './registry.ts';

/**
 * 注册 r-if 指令
 *
 * @remarks
 * - 通过 display 属性控制元素可见性（非 DOM 移除）
 * - 缓存初始 display 值，确保显示时恢复原始样式
 * - 结果无变化时跳过 DOM 操作，减少重排
 * - 解析失败时默认隐藏元素
 */
registerDirective('r-if', (el: HTMLElement, expr: string, scope: ReactiveObject, deps: Set<string>): void => {
    if (!scope || typeof scope !== 'object') return void console.warn('[r-if] 作用域无效，条件无法解析');
    if ((el as unknown as Record<string, unknown>).__ifProcessed) return;
    (el as unknown as Record<string, unknown>).__ifProcessed = true;

    // 缓存初始 display 值
    let initialDisplay = (el as unknown as Record<string, unknown>).__ifInitialDisplay as string | undefined;
    if (initialDisplay === undefined) {
        initialDisplay = el.style.display.trim() || window.getComputedStyle(el).display;
        (el as unknown as Record<string, unknown>).__ifInitialDisplay = initialDisplay === 'none' ? 'block' : initialDisplay;
    }

    // 上次显示状态
    let prevShow: boolean | null = null;
    let isFirstRender = true;

    // 更新元素可见性
    const update = (): void => {
        let show: boolean;

        // 解析表达式
        try {
            show = Boolean(expressionParser.parse(expr.trim(), scope, deps));
        } catch (parseErr) {
            console.error('[r-if] 条件表达式解析错误:', { expr: expr.trim(), error: (parseErr as Error).message, stack: (parseErr as Error).stack?.slice(0, 300), });
            show = false;
        }

        // 跳过无变化的更新
        if (show === prevShow && !isFirstRender) return;

        // 更新显示状态
        prevShow = show;
        isFirstRender = false;
        el.style.display = show ? ((el as unknown as Record<string, unknown>).__ifInitialDisplay as string) : 'none';
    };

    activeFns.push(update);
    try {
        update();
    } catch (initErr) {
        console.error('[r-if] 首次渲染错误:', (initErr as Error).message);
        el.style.display = 'none';
    } finally {
        activeFns.pop();
    }

    // 自动清理
    const cleanIf = (): void => {
        (el as unknown as Record<string, unknown>).__ifProcessed = false;
        el.removeEventListener('beforeunload', cleanIf);
    };
    el.addEventListener('beforeunload', cleanIf);
});

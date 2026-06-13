import type { ReactiveInterface } from "../types";
import { activeFns, depMap, elDeps } from "../utils/shared.ts";
import { parser } from "../core";
import { regDir } from "./regDir.ts";
import { initDir, onElRemove } from "../utils/directive.ts";


/**
 * 注册 r-if 指令
 *
 * @param el    - 条件渲染的目标元素
 * @param expr  - 条件表达式
 * @param scope - 当前数据作用域
 * @param deps  - 依赖收集容器
 */
regDir("r-if", (el: HTMLElement, expr: string, scope: ReactiveInterface, deps: Set<string>): void => {
	if (!initDir(el, expr, scope, "r-if", "rIf")) return;
	const elMap = el as unknown as Record<string, unknown>;

	// 缓存原始内联 display 值, 首次初始化时读取一次
	let initDisplay = elMap.__ifInitDisplay as string | undefined;
	if (initDisplay === undefined) {
		initDisplay = el.style.display;
		elMap.__ifInitDisplay = initDisplay;
	}

	// 缓存修剪后的表达式, 避免每次 update 重复 trim
	const trimmedExpr = expr.trim();

	// 上次显示状态, 初始为 null 确保首次必然执行
	let prevShown: boolean | null = null;

	/**
	 * 核心更新函数
	 */
	const update = (): void => {
		let shown: boolean;

		// 解析表达式, 转换为布尔值表达式
		try {
			shown = Boolean(parser.parse(trimmedExpr, scope, deps));
		} catch (error) {
			console.error("[r-if] 条件表达式解析错误:", { expr: trimmedExpr, error: (error as Error).message, stack: (error as Error).stack?.slice(0, 300), });
			shown = false;
		}

		// 状态未变化时跳过 DOM 操作
		if (shown === prevShown) return;
		prevShown = shown;

		// 切换显示状态
		if (shown) el.style.display = initDisplay;
		else el.style.setProperty("display", "none", "important");
	};

	// 推入 activeFns 栈收集依赖, 首次执行并完成订阅
	activeFns.push(update);
	try {
		update();
	} catch (error) {
		console.error("[r-if] 首次渲染错误:", (error as Error).message);
		el.style.setProperty("display", "none", "important");
	} finally {
		activeFns.pop();
	}

	// 元素移除时清理
	onElRemove(el, () => {
		// 重置处理标记, 允许 SPA 路由返回时重新编译
		elMap.__ifProcessed = false;

		// 取消所有依赖订阅
		const depSet = elDeps.get(el);
		if (depSet) {
			depSet.forEach(varName => depMap.get(scope)?.unsubscribe(update, varName));
			elDeps.delete(el);
		}

		// 清理缓存的初始 display 值
		delete elMap.__ifInitDisplay;
	});
});

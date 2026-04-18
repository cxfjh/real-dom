import type { DirectiveHandler } from "../types";
import { directives } from "../utils/shared.ts";

/**
 * 注册自定义指令
 *
 * @param name - 指令名称
 * @param handler - 指令处理函数
 * @throws {Error} handler 非函数类型时抛出异常
 */
export const registerDirective = (name: string, handler: DirectiveHandler): void => {
    if (typeof handler !== "function") throw new Error(`指令处理器必须是函数: ${ name }`);
    directives.set(name, handler);
};

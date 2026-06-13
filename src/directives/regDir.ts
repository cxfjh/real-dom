import type { DirectiveFn } from "../types";
import { dirs } from "../utils/shared.ts";

/**
 * 注册自定义指令
 *
 * @param name - 指令名称
 * @param handler - 指令处理函数
 * @throws {Error} handler 非函数类型时抛出异常
 */
export const regDir = (name: string, handler: DirectiveFn): void => {
    if (typeof handler !== "function") throw new Error(`指令处理器必须是函数: ${ name }`);
    dirs.set(name, handler);
};

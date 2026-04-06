import type { ReactiveObject } from "../types";
import { activeFns } from "../utils/shared.ts";
import { registerDirective } from "./registry.ts";

/**
 * 注册 r-model 指令
 *
 * 支持的路径语法：
 * - 简单路径：`r-model="name"`
 * - 嵌套路径：`r-model="user.profile.name"`
 * - Ref 路径：自动解包 Ref 对象的 .value
 */
registerDirective("r-model", (el: HTMLElement, path: string, scope: ReactiveObject): void => {
    /**
     * 解析模型路径并返回 getter/setter 访问器
     *
     * @param pathStr - 点分隔的属性路径
     * @param currentScope - 当前作用域
     * @returns 包含 get 和 set 方法的访问器对象
     */
    const resolvePath = (pathStr: string, currentScope: ReactiveObject) => {
        const pathSegments = pathStr.split(".");

        // 获取属性值
        const get = (): unknown => {
            let target: Record<string, unknown> = currentScope as unknown as Record<string, unknown>;

            // 遍历路径 segments
            for (let i = 0; i < pathSegments.length - 1; i++) {
                const seg = pathSegments[i];
                if ((target[seg] as unknown as Record<string, unknown>)?.__isRef) target = (target[seg] as unknown as Record<string, unknown>).value as unknown as Record<string, unknown>;
                else if ((target[seg] as unknown as Record<string, unknown>)?.__isReactive) target = target[seg] as unknown as Record<string, unknown>;
                else return undefined;
            }

            // 获取最后一个属性值
            const lastSeg = pathSegments[pathSegments.length - 1];
            if ((target[lastSeg] as unknown as Record<string, unknown>)?.__isRef) return (target[lastSeg] as unknown as Record<string, unknown>).value;
            return target[lastSeg];
        };

        // 设置属性值
        const set = (newValue: unknown): void => {
            let target: Record<string, unknown> = currentScope as unknown as Record<string, unknown>;

            // 遍历路径 segments
            for (let i = 0; i < pathSegments.length - 1; i++) {
                const seg = pathSegments[i];
                if ((target[seg] as unknown as Record<string, unknown>)?.__isRef) target = (target[seg] as unknown as Record<string, unknown>).value as unknown as Record<string, unknown>;
                else if ((target[seg] as unknown as Record<string, unknown>)?.__isReactive) target = target[seg] as unknown as Record<string, unknown>;
                else {
                    target[seg] = window.reactive({});
                    target = target[seg] as unknown as Record<string, unknown>;
                }
            }

            // 设置最后一个属性值
            const lastSeg = pathSegments[pathSegments.length - 1];
            if ((target[lastSeg] as unknown as Record<string, unknown>)?.__isRef) (target[lastSeg] as unknown as Record<string, unknown>).value = newValue;
            else target[lastSeg] = newValue;
        };

        return { get, set };
    };

    // 解析模型路径
    const { get: getModelValue, set: setModelValue } = resolvePath(path, scope);
    const inputEl = el as HTMLInputElement;
    const selectEl = el as HTMLSelectElement;

    // 将模型数据同步到视图
    const updateView = (): void => {
        // 获取模型值
        const modelValue = getModelValue();
        let viewValue: unknown;

        // 获取视图值
        if (inputEl.type === "checkbox") viewValue = inputEl.checked;
        else if (inputEl.type === "radio") viewValue = inputEl.checked;
        else viewValue = inputEl.value;

        // 判断是否需要更新视图
        let shouldUpdate: boolean;
        if (inputEl.type === "checkbox") shouldUpdate = !!modelValue !== viewValue;
        else if (inputEl.type === "radio") shouldUpdate = (inputEl.value === modelValue) !== viewValue;
        else shouldUpdate = String(modelValue ?? "") !== viewValue;

        // 更新视图
        if (shouldUpdate) {
            if (inputEl.type === "checkbox") inputEl.checked = !!modelValue;
            else if (inputEl.type === "radio") inputEl.checked = inputEl.value === modelValue;
            else if (el.tagName === "SELECT") selectEl.value = modelValue as string;
            else inputEl.value = modelValue != null ? String(modelValue) : "";
        }
    };

    // 将视图变化同步到模型
    const updateModel = (): void => {
        let newValue: unknown;

        // 判断元素类型并获取视图值
        if (inputEl.type === "checkbox") newValue = inputEl.checked;
        else if (inputEl.type === "radio") {
            if (!inputEl.checked) return;
            newValue = inputEl.value;
        } else if (el.tagName === "SELECT") newValue = selectEl.value;
        else newValue = inputEl.type === "number" && !isNaN(inputEl.valueAsNumber) ? inputEl.valueAsNumber : inputEl.value;

        // 判断是否需要更新模型
        const oldValue = getModelValue();
        if (oldValue !== newValue) setModelValue(newValue);
    };

    // 根据元素类型确定监听事件
    const eventType = el.tagName === "SELECT" ? "change" : ["checkbox", "radio"].includes(inputEl.type) ? "change" : "input";

    // 清理旧处理器
    const elAny = el as unknown as Record<string, unknown>;
    if (elAny.__modelHandler) el.removeEventListener((elAny.__modelEventType as string) || "input", elAny.__modelHandler as EventListener);

    // 绑定新处理器
    elAny.__modelHandler = updateModel;
    elAny.__modelEventType = eventType;
    el.addEventListener(eventType, updateModel);

    // 首次同步
    activeFns.push(updateView);
    try {
        updateView();
    } finally {
        activeFns.pop();
    }

    // 自动清理
    const cleanup = (): void => {
        if (elAny.__modelHandler) {
            el.removeEventListener(elAny.__modelEventType as string, elAny.__modelHandler as EventListener);
            elAny.__modelHandler = null;
        }
        el.removeEventListener("beforeunload", cleanup);
    };
    el.addEventListener("beforeunload", cleanup);
});

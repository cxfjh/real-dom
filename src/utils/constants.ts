/** 匹配插值表达式 */
export const INTERPOLATION_REGEX = /\{\{([^}]+?)}}/g;

/** 匹配 JS 变量路径 */
export const VARIABLE_REGEX = /[a-zA-Z_$][\w$]*(?:\.[\w$]+)*/g;

/** DOM 事件名称映射表 */
export const EVENT_MAP: Readonly<Record<string, string>> = Object.freeze({
    click: "click",
    dblclick: "dblclick",
    mousedown: "mousedown",
    mouseup: "mouseup",
    mouseover: "mouseover",
    mouseout: "mouseout",
    mousemove: "mousemove",
    keydown: "keydown",
    keyup: "keyup",
    keypress: "keypress",
    focus: "focus",
    blur: "blur",
    input: "input",
    change: "change",
    submit: "submit",
    contextmenu: "contextmenu",
    scroll: "scroll",
    resize: "resize",
});

/** 键盘按键别名映射表 */
export const KEY_MAP: Readonly<Record<string, string>> = Object.freeze({
    enter: "Enter",
    esc: "Escape",
    escape: "Escape",
    tab: "Tab",
    space: " ",
    backspace: "Backspace",
    delete: "Delete",
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    ctrl: "Control",
    shift: "Shift",
    alt: "Alt",
    meta: "Meta",
});

/**
 * @module directives
 * @description 指令模块统一入口
 * 导入所有内置指令的注册模块，确保指令在应用初始化前完成注册
 */
import './if.ts';
import './click.ts';
import './for.ts';
import './arr.ts';
import './api.ts';
import './model.ts';
import './cp.ts';
import './dom.ts';
import './route.ts';
import './ref.ts';

/* 导出注册 API 供外部扩展 */
export { registerDirective } from './registry.ts';

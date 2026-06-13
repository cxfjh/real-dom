<div align="center">
  <h1>RealDom</h1>
  <p>
    <strong>轻量级、高性能的响应式 DOM 框架</strong><br />
    压缩后仅 <strong>11 KB</strong>，<strong>零依赖</strong>，无需构建工具即可运行
  </p>
</div>
<br />
<div align="center">
  <img src="https://img.shields.io/badge/RealDom-v0.1.0-4f46e5?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMyAxMGgtM2wzIDdoLTNsMy03eiIvPjwvc3ZnPg==" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-success?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Size-11KB_gzip-f59e0b?style=for-the-badge" alt="Size" />
  <img src="https://img.shields.io/badge/Dependencies-zero-10b981?style=for-the-badge" alt="Dependencies" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178c6?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <br />
  <img src="https://img.shields.io/badge/Proxy-Reactive-4f46e5?style=flat-square" alt="Reactive" />
  <img src="https://img.shields.io/badge/SPA-Router-818cf8?style=flat-square" alt="Router" />
  <img src="https://img.shields.io/badge/Build-Vite_8-646cff?style=flat-square&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/ESM-Supported-f7df1e?style=flat-square&logo=javascript" alt="ESM" />
</div>

## 目录

- [快速开始](#快速开始)
- [特性一览](#特性一览)
- [使用文档](#使用文档)
- [许可证](#许可证)

---

## 快速开始

### 安装

| 方式 | 代码                                                                         | 适用场景 |
|------|----------------------------------------------------------------------------|----------|
| **IIFE** | `<script src="https://cxfjh.cn/js/rd/0.1.0.js"></script>`                  | 无构建工具 |
| **Module** | `<script type="module" src="https://cxfjh.cn/js/rd/es.0.1.0.js"></script>` | 模块化项目 |
| **Module** | `import RealDom from "./es.0.1.0.js";` | 模块化项目 |

### Todo 应用

```html
<div r-data="{title: '我的待办事项', input: '',list: [{ text: '学习 RealDom', done: false }]}">
  <h2>{{ title }}</h2>
  <div>
    <input type="text" r-model="input" placeholder="输入待办..." />
    <button r-click="list.push({text: input, done: false})">添加</button>
  </div>
  <div r-for="list">
    <span r-click="list[index].done = !list[index].done">{{ value.done ? '✓' : '○' }} {{ value.text }}</span>
    <span r-click="list.splice(index, 1)">×</span>
  </div>
  <p>总数: {{ list.length }} | 已完成: {{ list.filter(v => v.done).length }}</p>
</div>
```

---

## 特性一览

| 特性 | 说明 |
|------|------|
| **轻量级** | 压缩后仅 11KB，零外部依赖 |
| **高性能** | 基于 Proxy 的深度响应式 + requestAnimationFrame 批量异步更新 |
| **组件化** | 模板、样式、逻辑三者分离，支持 Scoped CSS |
| **指令系统** | 内置 8 个核心指令 + 可扩展的自定义指令 |
| **路由管理** | 内置 SPA 路由，支持懒渲染、多容器、激活样式 |
| **零配置** | 无需构建工具，`<script>` 标签引入即用 |

---

## 使用文档

- [使用教程](./docs/USAGE.md) — 从入门到进阶的完整 API 文档
- [教程官网](https://cxfjh.cn/js/rd/index.html) — 交互式在线文档页面

---

## 贡献指南

我们欢迎任何形式的贡献！推荐使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范

---

## 许可证

本项目基于 [MIT License](./LICENSE) 开源，允许个人和商业项目自由使用、修改和分发。

---

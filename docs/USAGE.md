# RealDom 官方文档

> 一个轻量级高性能的响应式 DOM 框架，压缩后仅 11KB，零依赖，无需构建工具即可使用。

---

## 目录

- [介绍](#介绍)
- [快速开始](#快速开始)
  - [引入方式](#引入方式)
  - [Hello World](#hello-world)
  - [Todo 应用](#todo-应用)
- [核心概念](#核心概念)
  - [响应式系统](#响应式系统)
  - [ref — 基本类型响应式](#ref--基本类型响应式)
  - [reactive — 对象类型响应式](#reactive--对象类型响应式)
  - [ref 与 reactive 对比](#ref-与-reactive-对比)
- [API 参考](#api-参考)
  - [ref()](#refinit)
  - [reactive()](#reactivetarget)
  - [provide()](#providedata)
  - [watch()](#watchsource-callback-options)
  - [onMounted()](#onmountedcallback)
  - [dom()](#domcomponentname-options)
- [指令系统](#指令系统)
  - [指令概览](#指令概览)
  - [r-if — 条件渲染](#r-if--条件渲染)
  - [r-for — 循环渲染](#r-for--循环渲染)
  - [r-model — 双向绑定](#r-model--双向绑定)
  - [r-click — 事件绑定](#r-click--事件绑定)
  - [r-data — 数据作用域](#r-data--数据作用域)
  - [r-api — 异步数据加载](#r-api--异步数据加载)
  - [r-dom — 组件挂载](#r-dom--组件挂载)
  - [r-route — 路由导航](#r-route--路由导航)
- [组件系统](#组件系统)
  - [组件定义](#组件定义)
  - [生命周期](#生命周期)
  - [$refs — DOM 引用](#refs--dom-引用)
  - [$props — 组件通信](#props--组件通信)
  - [Scoped CSS](#scoped-css)
  - [组件销毁](#组件销毁)
- [路由系统](#路由系统)
  - [架构概览](#架构概览)
  - [声明页面](#声明页面)
  - [路由导航](#路由导航)
  - [router API](#router-api)
  - [多容器路由](#多容器路由)
- [进阶用法](#进阶用法)
  - [表达式解析](#表达式解析)
  - [动态样式和类名](#动态样式和类名)
- [高级 API](#高级-api)
  - [regDir — 注册自定义指令](#regdir--注册自定义指令)
  - [parser — 表达式解析器](#parser--表达式解析器)
  - [batch — 批量更新管理器](#batch--批量更新管理器)
  - [compile — DOM 模板编译](#compile--dom-模板编译)
  - [bind — 元素响应式绑定](#bind--元素响应式绑定)
  - [bindText — 文本节点响应式绑定](#bindtext--文本节点响应式绑定)
  - [Dep — 依赖管理类](#dep--依赖管理类)
  - [onElRemove — 元素移除监听](#onelremove--元素移除监听)
  - [initDir — 指令初始化工具](#initdir--指令初始化工具)
- [常见问题](#常见问题)

---

## 介绍

RealDom 是一个**轻量级高性能的响应式 DOM 框架**，具有以下特点：

| 特性 | 说明 |
|------|------|
| **轻量级** | 压缩后仅 11KB，零依赖，不引入任何第三方库 |
| **高性能** | 基于 `Proxy` 的深度响应式系统，精准依赖追踪 + 批量异步更新 |
| **组件化** | 声明式组件定义，模板 / 样式 / 逻辑三者分离 |
| **指令系统** | 内置 8 个核心指令，覆盖条件渲染、列表渲染、双向绑定、事件处理等场景 |
| **路由管理** | 内置 SPA 路由，支持多容器独立切换、懒渲染、激活样式 |
| **批量更新** | 基于 `requestAnimationFrame` 自动合并同一帧内的多次数据变更 |
| **精准依赖** | 按变量名分组订阅，避免不必要的 DOM 更新 |
| **简单易用** | 无需 npm / webpack / vite 等构建工具，`<script>` 标签引入即可使用 |

---

## 快速开始

### 引入方式

RealDom 支持多种引入方式，根据你的项目类型选择：

| 方式 | 代码                                                                         | 适用场景 |
|------|----------------------------------------------------------------------------|----------|
| **IIFE** | `<script src="https://cxfjh.cn/js/rd/0.0.1.js"></script>`        | 无构建工具项目 |
| **Module** | `<script type="module" src="https://cxfjh.cn/js/rd/es.0.0.1.js"></script>` | 模块化项目 |
| **Module** | `import RealDom from "./es.0.1.0.js";` | 模块化项目 |

CDN 方式引入后，`RealDom` 对象会自动挂载到 `window.RealDom`，全局可用。

### Hello World

```html
<!DOCTYPE html>
<html>
<head>
    <title>RealDom — Hello World</title>
    <script src="https://cxfjh.cn/js/rd/0.0.1.js"></script>
</head>
<body>
    <div>
        <h1>{{ message }}</h1>
        <p>计数器: {{ counter }}</p>
        <button r-click="counter.value++">增加</button>
        <button r-click="counter.value--">减少</button>
        <label>
            <input type="text" r-model="input">
            <span>姓名: {{ input }}</span>
        </label>
    </div>

    <script>
        const { ref, provide, onMounted } = RealDom;

        // 创建响应式数据
        const message = ref("Hello RealDom!");
        const counter = ref(10);

        // 向根作用域注入数据，使 r-model 等指令可用
        const input = ref("Hello");
        provide({ input });

        // DOM 渲染完成后执行
        onMounted(() => console.log("应用已启动"));
    </script>
</body>
</html>
```

### Todo 应用

一个完整的 Todo 应用示例，展示 `r-data`、`r-model`、`r-for`、`r-click` 的组合使用：

```html
<div r-data="{title: '我的待办事项', input: '', list: [{ text: '学习 RealDom', done: false }]}">
    <h2>{{ title }}</h2>
    <div>
        <input type="text" r-model="input" placeholder="输入待办事项...">
        <button r-click="list.push({text: input, done: false})">添加</button>
    </div>
    <div r-for="list">
        <span r-click="list[index].done = !list[index].done">
            {{ value.done ? '✓' : '○' }} {{ value.text }}
        </span>
        <span r-click="list.splice(index, 1)">×</span>
    </div>
    <p>总数: {{ list.length }} | 已完成: {{ list.filter(value => value.done).length }}</p>
</div>
```

---

## 核心概念

### 响应式系统

RealDom 的响应式系统基于 JavaScript 的 `Proxy` 对象实现，分为两种类型：

```
数据变更 → Proxy 拦截 → 依赖收集 → 精准通知 → 批量异步更新 → DOM 渲染
```

### ref — 基本类型响应式

`ref()` 用于包装`基本类型`值，使其变为响应式。因为 `Proxy` 只能代理对象，无法代理基本类型，所以需要 `ref` 来桥接。

```javascript
const { ref } = RealDom;

// 创建响应式引用
const count = ref(0);
const name = ref("张三");

// JavaScript 代码中通过 .value 读写
console.log(count.value); // 0
count.value++;            // 修改值，触发视图更新
name.value = "李四";      // 修改值，触发视图更新
```

**在模板中自动解包**，无需 `.value`：

```html
<p>{{ count }}</p>   <!-- 自动显示 count.value -->
<p>{{ name }}</p>    <!-- 自动显示 name.value -->
```

### reactive — 对象类型响应式

`reactive()` 用于创建`对象或数组`的响应式代理。通过 `Proxy` 拦截属性的读写操作，实现深度响应式。

```javascript
const { reactive } = RealDom;

// 对象响应式（深层嵌套自动代理）
const user = reactive({
    name: "李四",
    age: 20,
    address: { city: "北京" }
});

// 直接修改属性，无需 .value
user.age = 21;
user.address.city = "上海";  // 深层属性也自动响应

// 数组响应式
const list = reactive([1, 2, 3]);
list.push(4);          // 变异方法自动触发更新
list.splice(0, 1);     // splice 也自动响应
list[0] = 100;         // 索引赋值也自动响应
```

### ref 与 reactive 对比

| 特性 | `ref()` | `reactive()` |
|------|---------|--------------|
| **支持类型** | 基本类型 + 对象 | 仅对象（含数组） |
| **访问方式** | `.value` 读写 | 直接属性访问 |
| **模板解包** | 自动解包，无需 `.value` | 无需解包 |
| **深层响应式** | 仅 `.value` 一层 | 惰性深层代理 |
| **适用场景** | 单个值、计数器、开关 | 表单数据、列表、复杂状态 |

---

## API 参考

### ref(init)

创建一个响应式引用。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `init` | `any` | 是 | 初始值，可以是任意类型 |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| Ref 对象 | `RefInterface` | 带有 `.value` 属性的响应式对象 |

```javascript
const { ref } = RealDom;

const count = ref(0);
console.log(count.value); // 0

count.value = 5;          // 修改值，触发视图更新
```

### reactive(target)

创建一个响应式代理对象。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `target` | `object \| array` | 是 | 要转换为响应式的对象或数组 |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| Proxy 对象 | `ReactiveInterface` | 响应式代理对象，深层属性自动代理 |

```javascript
const { reactive } = RealDom;

const state = reactive({
    count: 0,
    name: "RealDom",
    nested: { value: 1 }   // 深层属性也自动代理
});

state.count++;              // 直接修改，触发更新
state.nested.value = 2;     // 深层修改也触发更新

// 数组也完全支持
const arr = reactive([1, 2, 3]);
arr.push(4);                // 变异方法自动响应
```

### provide(data)

向根作用域注入响应式数据，使数据可在 `r-model` 中使用，其他场景不推荐使用，只有 `r-model` 才需要注入。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `data` | `Record<string, unknown>` | 是 | 包含响应式数据的键值对对象 |

> **注意**：在 `r-data` 和 `dom()` 组件内部定义的变量不需要 `provide`，直接可用。`provide` 主要用于 `<script>` 标签中定义的全局响应式数据。

```javascript
const { provide, ref } = RealDom;

const count = ref(0);

// 注入后，模板中的 r-model 可直接使用 count
provide({ count });
```

```html
<!-- 注入后模板中可直接使用 -->
<input r-model="count">
```

### watch(source, callback, options)

监听响应式数据的变化，当数据变化时执行回调。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | `() => any` | 是 | 返回要监听值的 getter 函数 |
| `callback` | `(newVal, oldVal) => void` | 是 | 变化时执行的回调 |
| `options` | `object` | 否 | 配置选项 |

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `immediate` | `boolean` | `false` | 是否立即执行一次回调 |
| `once` | `boolean` | `false` | 是否只执行一次后自动停止 |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| unwatch | `() => void` | 调用此函数可手动停止监听 |

```javascript
const { watch, ref, reactive } = RealDom;

// 监听 ref
const count = ref(0);
watch(() => count.value, (newVal, oldVal) => {
    console.log(`计数从 ${oldVal} 变为 ${newVal}`);
});

// 监听 reactive 对象属性
const user = reactive({ name: "张三", age: 20 });
watch(() => user.age, (newAge, oldAge) => {
    console.log(`年龄从 ${oldAge} 变为 ${newAge}`);
}, { immediate: true });  // 立即执行一次

// 监听多个值
watch(
    () => [user.name, user.age],
    ([newName, newAge], [oldName, oldAge]) => {
        console.log(`${oldName}→${newName}, ${oldAge}→${newAge}`);
    }
);

// 只执行一次
const unwatch = watch(() => count.value, () => {
    console.log("count 变化了（仅触发一次）");
}, { once: true });

// 手动停止监听
// unwatch();
```

### onMounted(callback)

注册在 DOM 初始化完成后执行的回调函数。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `callback` | `() => void` | 是 | 回调函数，在 DOMContentLoaded 后延迟执行 |

```javascript
const { onMounted } = RealDom;

onMounted(() => {
    console.log("DOM 已准备就绪");
    // 可以安全地操作 DOM 元素
});
```

### dom(componentName, options)

定义一个组件。这是 RealDom 组件化的核心 API。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `componentName` | `string` | 是 | 组件名称，全局唯一，后续通过 `r-dom` 或函数调用使用 |
| `options` | `CompOptions` | 是 | 组件配置对象 |

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| `template` | `string` | 是 | — | 组件 HTML 模板，支持插值和所有指令 |
| `style` | `string` | 否 | — | 组件 CSS 样式，支持 Scoped 隔离 |
| `script` | `function` | 否 | — | 组件逻辑工厂函数，返回 `{ setup, mounted, unmounted }` |
| `props` | `object` | 否 | `{}` | 组件属性默认值 |
| `to` | `string` | 否 | — | 自动挂载目标，格式 `"#id,container"` |
| `sty` | `boolean` | 否 | `true` | 是否启用 CSS 作用域隔离 |

```javascript
const { dom } = RealDom;

// 定义组件
const UserCard = dom("user-card", {
    template: `
        <div class="card">
            <h2>{{ $props.title }}</h2>
            <p>姓名: {{ name }}</p>
            <p ref="age">年龄: {{ age }}</p>
            <button r-click="grow()">长大一岁</button>
        </div>
    `,

    style: `
        .card {
            border: 1px solid #ddd;
            padding: 16px;
            border-radius: 8px;
        }
        .card button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
        }
    `,

    script: ({ $props, $refs }, { ref }) => {
        // setup 外定义的变量需要在 setup 中返回
        const name = ref("张三");

        const setup = (ctx) => {
            // ctx 上定义的变量无需返回，模板中直接可用
            ctx.age = ref(20);

            const grow = () => {
              ctx.age.value++;
              console.log($props.title, $refs.age.innerHTML)
            };

            // 手动返回的变量优先级高于 ctx 上的变量
            return { name, grow };
        };

        function mounted() {
            console.log("组件已挂载到 DOM");
            console.log(name.value);   
            console.log(this.age.value);    // 通过 this 访问 ctx 上的变量
        }

        function unmounted() {
            console.log("组件即将销毁");
        }

        return { setup, mounted, unmounted };
    },

    props: {
        title: "默认标题",
    },
});

// 手动挂载组件
const instance = UserCard({
    props: { title: "用户信息" },
    to: "#app",
});
```

> **提示**：`to` 参数格式说明：
> - `"#user"` — 自动创建 `id="user"` 的元素，挂载到 `<body>`
> - `"#user,app"` — 自动创建 `id="user"` 的元素，挂载到 `id="app"` 的元素内
> - 使用 `to` 后，`dom()` 返回 `undefined`（已自动挂载，无需手动调用）

#### 销毁组件实例和样式

| 方法 | 参数 | 说明 |
|------|------|------|
| `inst.del(removeStyle?)` | `removeStyle`: 是否同时删除样式，默认 `false` | 销毁组件实例 |
| `inst.delSty()` | 无参数 | 仅删除组件样式（多实例共享样式时） |
| `RealDom.delSty(name)` | `name`: 组件名称 | 按名称删除全局样式 |

```javascript
const instance = UserCard({ props: { title: "测试" }, to: "#demo" });

// 销毁组件实例（保留样式，其他实例仍可使用）
instance.del();

// 销毁组件实例并删除样式
instance.del(true);

// 仅删除样式（组件实例保留）
instance.delSty();

// 按组件名删除样式
RealDom.delSty("user-card");
```

---

## 指令系统

### 指令概览

RealDom 内置 8 个核心指令，覆盖常见 DOM 操作场景：

| 指令 | 属性 | 用途 | 核心能力 |
|------|------|------|----------|
| `r-if` | 条件 | 控制元素显示/隐藏 | CSS 类切换，保留 DOM 状态 |
| `r-for` | 循环 | 列表/数字循环渲染 | 节点缓存复用，支持 key |
| `r-model` | 双向绑定 | 表单数据双向绑定 | 支持 5 种控件类型 |
| `r-click` | 事件 | 事件绑定 | 支持 18 种事件 + 键盘过滤 |
| `r-data` | 数据 | 局部数据作用域 | 创建响应式上下文 |
| `r-api` | 异步 | API 数据加载 | 自动/手动请求，数组缓存 |
| `r-dom` | 组件 | 组件挂载 | Props 传递，驼峰自动转换 |
| `r-route` | 路由 | 路由导航 | 点击跳转，激活样式 |

---

### r-if — 条件渲染

根据表达式的真假值控制元素的显示/隐藏。

```html
<div r-if="isVisible">这会根据条件显示或隐藏</div>
<div r-if="count.value > 10">当 count 大于 10 时显示</div>
<div r-if="user.loggedIn && user.role === 'admin'">管理员面板</div>

<script>
    const { ref, reactive } = RealDom;

    const isVisible = ref(true);
    const count = ref(5);
    const user = reactive({ loggedIn: true, role: "admin" });
</script>
```

| 特性 | 说明 |
|------|------|
| 显示/隐藏 | `true` 显示，`false` 隐藏 |
| 状态保留 | 使用 CSS 类控制，隐藏时 DOM 状态保留 |
| 动态运算 | 表达式运算时需使用 `.value` 获取真实值 |

---

### r-for — 循环渲染

支持数组循环和数字循环两种模式。

#### 数组循环

```html
<!-- 基础数组 -->
<ul>
    <li r-for="items">{{ value }}</li>
</ul>

<!-- 对象数组 + 自定义变量名 -->
<div r-for="users" value="user" index="i">
    <p>{{ i + 1 }}. {{ user.name }} — {{ user.age }}岁</p>
</div>

<!-- 配合 key 提升性能 -->
<div r-for="products" key="id">
    <h3>{{ value.title }}</h3>
</div>
```

#### 数字循环

```html
<!-- 循环 5 次，索引从 1 开始 -->
<div r-for="5" start="1">第 {{ index }} 次</div>

<!-- 响应式变量控制次数 -->
<div r-for="loopCount">{{ index }}</div>

<!-- 嵌套循环（九九乘法表） -->
<div r-for="outer" index="i" start="1">
    <div r-for="i" index="j" start="1">
        {{ j }} × {{ i }} = {{ i * j }}
    </div>
</div>
```

```javascript
const { ref, reactive } = RealDom;

const items = ref(["苹果", "香蕉", "橙子"]);
const loopCount = ref(3);
const outer = ref(3);

const users = reactive([
    { name: "张三", age: 25 },
    { name: "李四", age: 30 },
]);

const products = reactive([
    { id: 1, title: "笔记本电脑", price: 5999 },
    { id: 2, title: "手机", price: 3999 },
]);
```

| 属性 | 默认值 | 说明 |
|------|--------|------|
| `r-for="expr"` | — | 数组变量名或数字 |
| `value="name"` | `"value"` | 自定义数组项变量名 |
| `index="name"` | `"index"` | 自定义索引变量名 |
| `start="n"` | `0` | 数字循环的起始索引 |
| `key="prop"` | — | 优化渲染的 key 属性 |

---

### r-model — 双向绑定

实现表单元素与响应式数据的双向绑定，支持 5 种控件类型。

```html
<!-- 文本输入 -->
<input type="text" r-model="inputValue" placeholder="请输入内容">
<p>当前输入: {{ inputValue }}</p>

<!-- 数字输入 -->
<input type="number" r-model="numberValue">
<p>数字: {{ numberValue }}</p>

<!-- 复选框 -->
<input type="checkbox" r-model="isChecked"> 我同意条款
<p>状态: {{ isChecked }}</p>

<!-- 单选按钮 -->
<input type="radio" r-model="gender" value="male" id="male">
<label for="male">男</label>
<input type="radio" r-model="gender" value="female" id="female">
<label for="female">女</label>
<p>选择: {{ gender }}</p>

<!-- 下拉选择 -->
<select r-model="selectedOption">
    <option value="">请选择</option>
    <option value="a">选项A</option>
    <option value="b">选项B</option>
</select>
<p>选择: {{ selectedOption }}</p>

<script>
    const { provide, ref } = RealDom;

    const inputValue = ref("");
    const numberValue = ref(0);
    const isChecked = ref(false);
    const gender = ref("");
    const selectedOption = ref("");

    // 在 <script> 中定义的变量需要 provide 才能在 r-model 中使用
    provide({ inputValue, numberValue, isChecked, gender, selectedOption });
</script>
```

| 控件类型 | 绑定的值 | 触发事件 |
|----------|----------|----------|
| `text` / `number` / `textarea` | `input.value` | `input` |
| `checkbox` | `input.checked` | `change` |
| `radio` | `input.value`（选中时） | `change` |
| `select` | `select.value` | `change` |

> **注意**: 在 `<script>` 标签中定义的变量必须通过 `provide()` 注入才能在 `r-model` 中使用；在 `r-data` 和 `dom()` 组件内部定义的变量无需 `provide`。

---

### r-click — 事件绑定

绑定事件处理器，支持 18 种 DOM 事件和键盘按键过滤。

```html
<!-- 基础点击 -->
<button r-click="handleClick()">点击我</button>

<!-- 双击 -->
<button r-click="counter.value++" dblclick>双击增加 {{ counter.value }}</button>

<!-- 键盘事件 + 按键过滤 -->
<input r-click="submit()" keydown="Enter" placeholder="按回车提交">

<!-- 键盘事件使用别名 -->
<input r-click="close()" keydown="esc" placeholder="按 ESC 关闭">

<script>
    const { ref } = RealDom;

    const counter = ref(0);

    const handleClick = () => console.log("按钮被点击了");
    const submit = () => console.log("提交表单");
    const close = () => console.log("关闭弹窗");
</script>
```

| 支持的事件 | 说明 |
|-----------|------|
| 鼠标事件 | `click`, `dblclick`, `mousedown`, `mouseup`, `mouseover`, `mouseout`, `mousemove`, `contextmenu` |
| 键盘事件 | `keydown`, `keyup`, `keypress` |
| 焦点事件 | `focus`, `blur` |
| 表单事件 | `input`, `change`, `submit` |
| 其他 | `scroll`, `resize` |

| 按键别名 | 对应 key 值 |
|----------|------------|
| `enter` | `Enter` |
| `esc` / `escape` | `Escape` |
| `tab` | `Tab` |
| `space` | ` ` (空格) |
| `up` / `down` / `left` / `right` | `ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight` |
| `ctrl` / `shift` / `alt` / `meta` | `Control` / `Shift` / `Alt` / `Meta` |

---

### r-data — 数据作用域

在元素范围内创建局部响应式数据作用域，子元素可直接使用。

```html
<!-- 基础用法 -->
<div r-data="{ name: 'RealDom', version: '0.0.1', features: ['轻量', '高性能'] }">
    <h1>{{ name }} v{{ version }}</h1>
    <ul>
        <li r-for="features">{{ value }}</li>
    </ul>
</div>

<!-- 嵌套使用 + r-model + r-click -->
<div r-data="{user: {name: '张三', age: 25}, count: 0}">
    <p>姓名: {{ user.name }}</p>
    <p>年龄: {{ user.age }}</p>
    <p><input r-model="count"> 当前计数: {{ count }}</p>
    <button r-click="user.age++">增长一岁</button>
    <button r-click="_.count++">增加计数</button>
</div>
```

| 规则 | 说明                                     |
|------|----------------------------------------|
| 作用域 | 在 `r-data` 子元素中可直接使用父级定义的变量            |
| 访问 | 因为值是对象所以所有访问都不需要加 `.value`             |
| 对象/数组修改 | `r-click` 中直接修改：`user.age++`           |
| 基本类型修改 | `r-click` 中需通过 `_.` 前缀：`_.count++`     |
| 外部访问 | 可通过 `element._data` 访问 `r-data` 的响应式数据 |

---

### r-api — 异步数据加载

从 API 加载数据并自动渲染，支持自动请求和手动触发两种模式。属性绑定了响应式变量后，变量更新会自动触发请求。

```html
<!-- 自动请求（GET） -->
<div r-api="https://lv.cxfjh.cn/loves/api/public/wish" list="data">
    <p>{{ value.id }}. {{ value.title }}</p>
</div>

<!-- 手动触发 + 自定义配置 -->
<div r-api="https://lv.cxfjh.cn/loves/api/public/wish" list="data" method="GET" manual refresh="#btn">
    <p>{{ value.title }}</p>
</div>
<button id="btn">点击加载数据</button>

<!-- POST 请求 + 自定义请求头 -->
<div r-api="url" list="data" method="POST" headers="requestHeaders" data-body="requestBody">
    <p>{{ value.name }}</p>
</div>

<!-- 手动渲染 + 自定义变量名 -->
<div r-api="url" list="data" method="GET" manual refresh="#loadBtn" arr="users">
    <span>请求状态: {{ _manual ? '成功' : '加载中...' }}</span>
    <div r-for="users">
        <p>{{ value.id }}. {{ value.title }}</p>
    </div>
</div>
<button id="loadBtn">点击加载</button>

<script>
    const { ref } = RealDom;
    
    const url = ref("https://lv.cxfjh.cn/loves/api/public/wish");

    const requestHeaders = {
        "Authorization": "Bearer token123",
        "Content-Type": "application/json",
    };

    const requestBody = ref({ content: "Hello RealDom" });
</script>
```

| 属性 | 类型 | 默认值 | 说明                             |
|------|------|--------|--------------------------------|
| `r-api="url"` | `string` | — | API 请求地址，支持响应式变量          |
| `list="key"` | `string` | — | 指定返回数据中数组的 key，如 `list="data"` |
| `method="GET"` | `string` | `"GET"` | HTTP 请求方法，支持响应式变量                      |
| `manual` | `boolean` | `false` | 是否手动触发请求                       |
| `refresh="#id"` | `string` | — | 手动模式下的触发按钮选择器                  |
| `arr="name"` | `string` | `"value"` | 自定义数组项变量名，同时返回 `_manual` 状态变量  |
| `headers="var"` | `string` | — | 自定义请求头变量名，支持响应式变量                      |
| `data-body="var"` | `string` | — | POST/PUT/PATCH 请求体变量名，支持响应式变量          |

---

### r-dom — 组件挂载

将已定义的组件挂载到指定 DOM 元素上，通过 `$` 前缀属性传递 Props。

```html
<!-- 基础挂载 -->
<div r-dom="user-card" id="user1"></div>

<!-- 传递 Props -->
<div r-dom="user-card" $title="'用户信息'" $email="'test@qq.com'"></div>

<!-- 动态 Props -->
<div r-dom="user-card" $title="userTitle" $count="10"></div>

<script>
    const { ref, onMounted } = RealDom;

    const userTitle = ref("动态标题");
    
    // 可通过 cpInsts.get 获取 r-dom 注册组件的实例
    let user1;
    onMounted(() => {
      user1 = RealDom.cpInsts.get(document.querySelector("#user1"))
    })
</script>
```

| 规则       | 说明                                     |
|----------|----------------------------------------|
| 组件名      | `r-dom="componentName"` 指定已注册的组件名称     |
| Props 传递 | `$propName="value"` 传递属性，`$` 前缀 + 驼峰命名 |
| 静态值      | `$title="'hello'"` 使用单引号/双引号嵌套传递字符串    |
| 动态值      | `$title="variable"` 引用响应式变量            |
| 驼峰转换     | `$user-name="val"` 自动转换为 `userName`    |
| 获取实例     | 如果 `RealDom.cpInsts.get(element)` 获取返回值实例     |

---

### r-route — 路由导航

将元素转换为 SPA 路由导航链接，点击时触发路由跳转。

```html
<!-- 路由内容 -->
<div r-page="home">
  <h3>【首页】 我是 view 容器的内容</h3>
</div>
<div r-page="settings" &route="view">
  <h3>【设置】 我是 view 容器的内容</h3>
</div>

<!-- 路由内容 -->
<div r-page="about" &route="info">
  <h3>【关于】 我是 info 容器的内容</h3>
</div>
<div r-page="mine" &route="info">
  <h3>【我的】 我是 info 容器的内容</h3>
</div>

<!-- 路由容器 -->
<div>
  <h1>view 容器</h1>
  <div route="view"></div>
</div>
<div>
  <h1>info 容器</h1>
  <div route="info"></div>
</div>

<!-- 路由导航 -->
<button r-route="home" route-active="r-x">view首页</button>
<button r-route="about" route-active>info关于</button>
<button r-route="settings" route-active>view设置</button>
<button r-click="router.nav('mine')">info我的</button>

<script>
  const { router } = RealDom;

  // 路由激活时触发
  router.add("mine", () => {
    console.log("路由激活");
  }, "info");

  router.add("about", () => {
    console.log("路由激活");
  }, "info");
</script>
```

| 属性                     | 默认值          | 说明            |
|------------------------|--------------|---------------|
| `r-route="path"`       | —            | 目标路由路径        |
| `route-active="class"` | `"r-active"` | 激活时添加的 CSS 类名 |
| `route="info"` | `"view"`     | 路由容器名         |
| `&route="info"` | `"view"`     | 渲染到指定容器名      |

---

## 组件系统

### 组件定义

组件通过 `RealDom.dom(name, options)` 定义，完整结构如下：

```
dom("component-name", {
    template: "HTML 模板 → 支持插值和所有指令",
    style:    "CSS 样式 → 支持 Scoped 隔离",
    script:   "逻辑函数 → 返回 { setup, mounted, unmounted }",
    props:    "属性默认值 → 外部通过 $propName 传入",
    to:       "自动挂载目标 → 可选，使用后无需手动挂载",
    sty:      "是否 Scoped → 默认 true",
})
```

### 生命周期

| 钩子 | 调用时机 | 能做什么 |
|------|----------|----------|
| `setup(ctx)` | 组件初始化，DOM 挂载前 | 定义响应式变量、方法；ctx 上的变量无需返回 |
| `mounted()` | DOM 挂载完成后 | 操作 DOM（`$refs`）、获取元素尺寸、启动定时器 |
| `unmounted()` | 组件销毁前 | 清理定时器、取消订阅、释放资源 |

### $refs — DOM 引用

在模板中通过 `ref="name"` 标记元素，在 `mounted()` 中通过 `$refs.name` 访问。

```javascript
dom("demo", {
    template: `
        <div>
            <h1 ref="title">标题</h1>
            <p ref="content">内容</p>
            <button r-click="changeStyle()">修改样式</button>
        </div>
    `,

    script: ({ $refs }) => {
        const setup = (ctx) => {
            ctx.changeStyle = () => $refs.title.style.color = "blue";
        };

        const mounted = () => {
            // $refs 在 mounted 中可用
            console.log($refs.title);     // <h1> 元素
            console.log($refs.content);   // <p> 元素
            $refs.title.style.color = "red";
        }

        return { setup, mounted };
    },
});
```

### $props — 组件通信

组件之间通信，通过 `$props` 传递响应式 `ref` `reactive` 引用数据进行通信。

```javascript
// 父组件
dom("parent", {
    template: `
        <div>
            <div r-dom="child" $count="count"></div>
            <button r-click="count.value++">父修改值</button>
        </div>
    `,

    script: ({}, { ref }) => {
        const setup = () => {
            const count = ref(10);
            return { count };
        };

        return { setup };
    }
});

// 子组件
dom("child", {
    template: `
        <div>
            <p>{{ $props.count }}</p>
            <button r-click="$props.count.value++">子修改值</button>
        </div>
    `,
});
```

### Scoped CSS

默认启用 CSS 作用域隔离，每个组件的样式仅作用于自身。

```css
/* 组件内的样式 */
.title { color: red; }
/* 编译后: .title[data-v-a1b2] { color: red; } */
/* 仅影响该组件内带 data-v-a1b2 属性的 .title 元素 */
```

**样式穿透**（修改子组件内部样式）：

| 语法 | 示例 | 编译结果 |
|------|------|----------|
| `>>>` | `.parent >>> .child` | `.parent[data-v-xxx] .child` |
| `/deep/` | `.parent /deep/ .child` | `.parent[data-v-xxx] .child` |
| `::v-deep` | `.parent::v-deep .child` | `.parent[data-v-xxx] .child` |

> 穿透后，作用域属性只加在父选择器上，子选择器不加，从而可以匹配到子组件内部元素。

### 组件销毁

```javascript
const instance = UserCard({ props: { title: "测试" }, to: "#demo" });

// 销毁组件实例，保留样式（多实例共享样式时）
instance.del();

// 销毁组件实例 + 删除样式
instance.del(true);

// 仅删除样式，保留实例
instance.delSty();

// 按组件名全局删除样式
RealDom.delSty("user-card");
```

---

## 路由系统

### 架构概览

RealDom 内置基于 URL `?path=` 查询参数的 SPA 路由系统。

### 声明页面

通过 `r-page` 属性声明路由页面，`&route` 指定目标容器。

```html
<!-- 声明页面 -->
<div r-page="home" &route="view">
    <h3>【首页】我是 view 容器的内容</h3>
</div>
<div r-page="about" &route="info">
    <h3>【关于】我是 info 容器的内容</h3>
</div>

<!-- 声明路由容器 -->
<div route="view"></div>
<div route="info"></div>
```

### 路由导航

```html
<!-- r-route 指令导航 -->
<button r-route="home" route-active="active">首页</button>
<button r-route="about" route-active>关于</button>

<!-- 手动调用 API 导航 -->
<button r-click="router.nav('settings')">设置</button>
```

### router API

| 方法 | 参数 | 说明 |
|------|------|------|
| `router.add(path, handler, target?)` | path: 路径, handler: 激活回调, target: 容器名（默认 `"view"`） | 手动注册路由 |
| `router.nav(path, replace?)` | path: 路径, replace: 是否替换历史记录 | 导航到指定路径 |
| `router.init()` | — | 初始化路由系统（框架自动调用） |

```javascript
const { router } = RealDom;

// 手动注册路由 + 激活回调
router.add("mine", () => {
    console.log("进入「我的」页面");
}, "info");

router.add("about", () => {
    console.log("进入「关于」页面");
}, "info");

// 手动导航
router.nav("mine");           // 新增历史记录
router.nav("login", true);   // 替换当前历史记录（不可后退）
```

### 多容器路由

支持多个独立的路由容器，互不影响：

```html
<!-- 侧边栏容器 -->
<div r-page="home" &route="sidebar">侧边栏首页</div>
<div r-page="settings" &route="sidebar">侧边栏设置</div>
<div route="sidebar"></div>

<!-- 主内容容器 -->
<div r-page="home" &route="main">主内容首页</div>
<div r-page="about" &route="main">主内容关于</div>
<div route="main"></div>

<!-- 导航 -->
<button r-route="home">首页</button>      <!-- 两个容器同时切换到 home -->
<button r-route="settings">设置</button>  <!-- 侧边栏切换，主内容不变 -->
<button r-route="about">关于</button>     <!-- 主内容切换，侧边栏不变 -->
```

---

## 进阶用法

### 表达式解析

支持在 `{{ }}` 插值中使用复杂的 JavaScript 表达式：

```html
<!-- 三元运算 -->
<p>{{ isLoggedIn.value ? '欢迎回来' : '请登录' }}</p>

<!-- 函数调用 -->
<p>{{ formatCurrency(price.value) }}</p>

<!-- 数组方法 -->
<p>未完成任务: {{ tasks.filter(t => !t.completed).length }}</p>

<!-- 深层属性访问 -->
<p>{{ user.profile.settings.theme }}</p>

<script>
    const { ref, reactive } = RealDom;

    const isLoggedIn = ref(false);
    const price = ref(99.99);

    const tasks = reactive([
        { text: "任务1", completed: true },
        { text: "任务2", completed: false },
    ]);

    const user = reactive({
        profile: { settings: { theme: "dark" } },
    });

    const formatCurrency = (amount) => `¥${amount.toFixed(2)}`;
</script>
```

### 动态样式和类名

```html
<!-- 动态类名 -->
<div class="{{ isActive.value ? 'active' : 'inactive' }}">状态块</div>

<!-- 多个类名 -->
<div class="{{ ['base', isSpecial.value ? 'special' : '', isEnabled.value ? 'enabled' : ''].join(' ') }}">
    多类名
</div>

<!-- 动态内联样式 -->
<div style="color: {{ textColor.value }}; font-size: {{ fontSize.value }}px;">
    动态样式
</div>

<script>
    const { ref } = RealDom;

    const isActive = ref(true);
    const isSpecial = ref(false);
    const isEnabled = ref(true);
    const textColor = ref("blue");
    const fontSize = ref(16);
</script>
```

---

## 高级 API

> 面向高级用户和插件/指令开发者。这些 API 是框架内部的核心构建块，了解它们可以帮助你扩展 RealDom 的能力。

### regDir — 注册自定义指令

`regDir(name, handler)` 用于注册自定义指令，这是扩展 RealDom 能力的核心入口。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 指令名称，推荐 `r-xxx` 格式 |
| `handler` | `DirectiveFn` | 是 | 指令处理函数，需符合签名 `(el, expr, scope, deps) => void` |

| 返回值 | 说明 |
|--------|------|
| `void` | handler 非函数类型时抛出 `Error` |

**指令处理函数签名（DirectiveFn）**：

```typescript
type DirectiveFn = (
    el: HTMLElement,           // 指令绑定的 DOM 元素
    expr: string,              // 指令表达式字符串（属性值）
    scope: ReactiveInterface,  // 当前响应式作用域
    deps: Set<string>          // 依赖变量集合，收集表达式中引用的变量名
) => void | Promise<void>;
```

**示例 — 实现一个自定义 `r-tooltip` 指令**：

```javascript
const { regDir, parser, onElRemove, initDir } = RealDom;

regDir("r-tooltip", (el, expr, scope, deps) => {
    // 1. 初始化校验（防重复处理 + 作用域检查 + 表达式检查）
    if (!initDir(el, expr, scope, "r-tooltip", "rTooltip")) return;

    // 2. 解析表达式，自动收集依赖
    const tooltipText = parser.parse(expr, scope, deps);

    // 3. 添加 title 属性作为原生提示
    el.setAttribute("title", String(tooltipText));

    // 4. 注册元素移除时的清理逻辑
    onElRemove(el, () => {
        el.removeAttribute("title");
    });
});
```

```html
<!-- 使用自定义指令 -->
<button r-tooltip="'点击提交表单'">提交</button>
<span r-tooltip="user.status">状态</span>
```

**注意事项**：

- 内置指令也通过 `regDir` 注册，自定义指令与内置指令使用同一注册表
- 指令处理函数内部**必须**调用 `initDir()` 进行重复处理防护
- 需要在 `compile()` 之前完成注册，否则新 DOM 节点上的自定义指令不会被处理

---

### parser — 表达式解析器

`parser` 是 RealDom 的表达式引擎，负责解析 `{{ }}` 插值和指令表达式。

#### parser.parse(expr, scope, deps, unwrapRef?)

解析 JavaScript 表达式并求值，同时自动收集依赖。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `expr` | `string` | 是 | — | 表达式字符串，可包含 `{{ }}` 包裹 |
| `scope` | `ReactiveInterface` | 否 | `{}` | 响应式作用域，提供变量值 |
| `deps` | `Set<string>` | 否 | `new Set()` | 依赖收集器，自动添加引用的根变量名 |
| `unwrapRef` | `boolean` | 否 | `true` | 是否自动解包 Ref 的 `.value` |

| 返回值 | 说明 |
|--------|------|
| `unknown` | 表达式计算结果，解析失败时返回原始字符串 |

```javascript
const { parser, ref, reactive } = RealDom;

const count = ref(5);
const user = reactive({ name: "张三", age: 25 });

const scope = { count, user };
const deps = new Set();

// 基础求值
parser.parse("count.value + 10", scope, deps); // 15
console.log(deps); // Set { "count" }

// 模板插值
parser.parse("{{ user.name }}", scope, deps); // "张三"

// 复杂表达式
parser.parse("user.age >= 18 ? '成年' : '未成年'", scope, deps); // "成年"
```

**内部机制**：

- 使用 `new Function()` 动态编译表达式，并缓存编译结果（LRU 上限 200 条）
- 通过正则 `VARIABLE_REGEX` 提取变量名，自动加入 `deps` 集合
- 全局变量白名单 `_globals`：`window`、`document`、`console`、`alert` 不会被收集为依赖

#### parser.text(text, scope, deps, unwrapRef?)

解析包含多个 `{{ }}` 插值的文本，替换所有插值后返回纯文本。

| 参数 | 类型 | 说明 |
|------|------|------|
| `text` | `string` | 包含插值的模板文本 |
| `scope` | `ReactiveInterface` | 作用域对象 |
| `deps` | `Set<string>` | 依赖收集器 |
| `unwrapRef` | `boolean` | 是否解包 Ref，默认 `true` |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 替换后的文本 | `string` | 所有 `{{ }}` 被实际值替换 |

```javascript
const text = "你好 {{ user.name }}，你的分数是 {{ score.value }}";
const result = parser.text(text, { user, score: ref(95) }, new Set());
// "你好 张三，你的分数是 95"
```

#### parser._globals

全局变量白名单 `Set<string>`，可动态增删：

```javascript
// 添加自定义全局变量
parser._globals.add("Math");
parser._globals.add("JSON");

// 移除某全局变量（使其可被收集为依赖）
parser._globals.delete("console");
```

---

### batch — 批量更新管理器

`batch` 负责将多次数据变更合并为**一次 DOM 更新**，基于 `requestAnimationFrame` 调度。

#### batch.add(fn)

将更新函数加入执行队列。

| 参数 | 类型 | 说明 |
|------|------|------|
| `fn` | `Function` | 需要延迟执行的更新函数 |

```javascript
const { batch } = RealDom;

batch.add(() => {
    console.log("这条更新会在下一帧执行");
});
```

#### 执行流程图

```
数据变更 1 → batch.add(fn1) ┐
数据变更 2 → batch.add(fn2) ├── 同一帧内收集
数据变更 3 → batch.add(fn3) ┘
                                │
                    requestAnimationFrame
                                │
                    batch._execute() → 遍历快照执行 fn1, fn2, fn3 → 一次性 DOM 更新
```

**关键设计**：

- 使用 `Set` 存储队列，自动去重（同一个更新函数多次 add 只执行一次）
- 执行前创建快照并清空队列，避免执行过程中新增的任务干扰当前批次
- `_pending` 标志防止重复调度 `requestAnimationFrame`

---

### compile — DOM 模板编译

`compile(el, scope?)` 递归遍历 DOM 子树，为每个元素建立响应式关联。

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `el` | `HTMLElement \| DocumentFragment` | 是 | — | 根元素或文档片段 |
| `scope` | `ReactiveInterface` | 否 | `{}` | 当前响应式作用域 |

| 返回值 | 说明 |
|--------|------|
| `void` | 完成后 `el.__processed = true` 防重复 |

```javascript
const { compile, reactive } = RealDom;

const scope = reactive({ name: "RealDom" });

// 手动编译某个 DOM 区域
const container = document.getElementById("dynamic-area");
container.innerHTML = `<p>{{ name }}</p>`;
compile(container, scope);
```

**内部流程**：

```
compile(el, scope)
  ├── 1. 防重复检查 (el.__processed)
  ├── 2. 元素节点 → bind(el, scope)() 立即执行一次
  ├── 3. 文本节点 → 检测 {{ }} → bindText(node, scope)
  └── 4. 递归子元素 → compile(child, scope)
```

> **注意**：通常情况下你不需要手动调用 `compile`，框架在初始化时会自动处理。但在动态插入 HTML 片段等场景下需要手动调用。

---

### bind — 元素响应式绑定

`bind(el, scope)` 为指定 DOM 元素创建或获取缓存的更新函数。

| 参数 | 类型 | 说明 |
|------|------|------|
| `el` | `HTMLElement` | 目标 DOM 元素 |
| `scope` | `ReactiveInterface` | 当前响应式作用域 |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| `update` | `Function` | 返回更新函数，调用后执行指令+插值更新 |

```javascript
const { bind, reactive } = RealDom;

const scope = reactive({ visible: true });
const el = document.createElement("div");
el.setAttribute("r-if", "visible");
el.innerHTML = "我在这里";

// 绑定元素，返回更新函数
const update = bind(el, scope);

// 首次执行
update();

// 数据变化后再次调用
scope.visible = false;
update(); // 元素被隐藏
```

**内部机制**：

- 返回的 `update` 函数被缓存到 `WeakMap` 中，同一元素多次调用 `bind` 返回同一个函数
- `update` 内部遍历元素的属性，依次执行指令处理器 + 解析插值属性
- 元素被移除时自动清理缓存（通过 `beforeunload` 事件）

---

### bindText — 文本节点响应式绑定

`bindText(node, scope)` 为包含 `{{ }}` 插值的文本节点建立响应式关联。

| 参数 | 类型 | 说明 |
|------|------|------|
| `node` | `Text` | 包含插值的文本节点 |
| `scope` | `ReactiveInterface` | 响应式作用域 |

| 返回值 | 说明 |
|--------|------|
| `void` | 调用后立即执行一次更新，完成依赖收集 |

```javascript
const { bindText, ref } = RealDom;

const name = ref("RealDom");
const scope = { name };

// 模拟动态创建的文本节点
const textNode = document.createTextNode("Hello {{ name }}!");
bindText(textNode, scope);
// textNode.textContent === "Hello RealDom!"

name.value = "World";
// 由于依赖已收集，ref 变化时自动触发文本更新
```

> **注意**：通常由 `compile()` 内部自动调用，手动调用场景较少。

---

### Dep — 依赖管理类

`Dep` 是响应式系统的**核心基础设施**，实现了发布-订阅模式。

```javascript
const { Dep } = RealDom;

const dep = new Dep();
```

#### dep.subscribe(fn, variable?)

订阅数据变化通知。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fn` | `Function` | 是 | 订阅回调函数 |
| `variable` | `string \| null` | 否 | 变量名，指定后加入精准订阅集合 |

```javascript
const dep = new Dep();

// 全量订阅：任何数据变化都会通知
dep.subscribe(() => console.log("数据变了"));

// 精准订阅：仅 name 变量变化时通知
dep.subscribe(() => console.log("name 变了"), "name");
```

#### dep.notify(variable?)

通知订阅者执行更新。

| 参数 | 类型 | 说明 |
|------|------|------|
| `variable` | `string \| null` | 指定时优先精准通知，无匹配时全量通知 |

```javascript
dep.notify("name");  // 优先通知 name 的精准订阅者，无精准订阅者时通知全量
dep.notify();        // 全量通知
```

#### dep.unsubscribe(fn, variable?)

移除订阅者。

| 参数 | 类型 | 说明 |
|------|------|------|
| `fn` | `Function` | 要移除的订阅函数 |
| `variable` | `string \| null` | 指定时仅从该变量集合移除，不指定时从所有集合移除 |

```javascript
const callback = () => console.log("更新");

dep.subscribe(callback, "age");
dep.unsubscribe(callback, "age"); // 仅从 age 订阅者中移除

dep.subscribe(callback);
dep.unsubscribe(callback); // 从所有集合中移除
```

#### 数据结构

```javascript
dep.subs    // Set<Function>          — 全量订阅者集合
dep.varSubs // Map<string, Set<Function>> — 按变量名分组的精准订阅者
dep._paused // boolean | undefined     — 暂停通知标志
```

#### 使用场景

```javascript
const { Dep, batch, reactive } = RealDom;

// 创建一个独立的数据源
const store = reactive({ count: 0, name: "RealDom" });
const storeDep = new Dep();

// 订阅 store 更新
storeDep.subscribe(() => {
    console.log("store 已更新:", store.count, store.name);
});

// 手动控制通知
function updateStore(newCount) {
    store.count = newCount;
    storeDep.notify(); // 不再依赖 reactive 的自动通知
}
```

---

### onElRemove — 元素移除监听

`onElRemove(el, cleanup)` 注册元素从 DOM 中移除时的清理回调，实现**自动资源管理**。

| 参数 | 类型 | 说明 |
|------|------|------|
| `el` | `HTMLElement` | 要监听的 DOM 元素 |
| `cleanup` | `() => void` | 元素被移除时执行的回调函数 |

| 返回值 | 说明 |
|--------|------|
| `void` | — |

```javascript
const { onElRemove, ref } = RealDom;

const timer = ref(null);

function startPolling(el) {
    const id = setInterval(() => console.log("轮询中..."), 1000);
    timer.value = id;

    // 当元素被移除时，自动清理定时器
    onElRemove(el, () => {
        clearInterval(id);
        console.log("元素已移除，定时器已清理");
    });
}
```

**内部实现要点**：

- 基于全局 `MutationObserver` 监听 `document` 的子节点移除
- 使用 `WeakMap` 存储元素 → 回调的映射，元素被 GC 时自动释放
- 全局计数器 `count` 跟踪活跃监听数，为 0 时不启动 observer
- 同一元素可注册多个回调（`Set` 存储）

---

### initDir — 指令初始化工具

`initDir(el, expr, scope, dirName, flag)` 是指令开发的**统一初始化入口**，提供校验和防重复处理。

| 参数 | 类型 | 说明 |
|------|------|------|
| `el` | `HTMLElement` | 指令绑定的 DOM 元素 |
| `expr` | `string` | 指令表达式字符串（属性值） |
| `scope` | `ReactiveInterface \| null \| undefined` | 当前响应式作用域 |
| `dirName` | `string` | 指令名称，用于 warn 日志 |
| `flag` | `string` | 唯一标记后缀，如指令名驼峰形式 |

| 返回值 | 说明 |
|--------|------|
| `true` | 校验通过，应继续执行指令逻辑 |
| `false` | 校验未通过，应终止指令处理 |

**校验规则**：

1. `expr` 为空或纯空白 → `console.warn` + 返回 `false`
2. `scope` 无效（`null`/`undefined`/非对象） → `console.warn` + 返回 `false`
3. 元素上已有 `__{flag}Processed` 标记 → 返回 `false`（防重复处理）
4. 校验通过 → 打上 `__{flag}Processed = true` 标记 + 返回 `true`

**标准用法**（编写自定义指令时的模板代码）：

```javascript
const { regDir, parser, initDir, onElRemove } = RealDom;

regDir("r-my-directive", (el, expr, scope, deps) => {
    // 第一步：初始化校验
    if (!initDir(el, expr, scope, "r-my-directive", "rMyDirective")) return;

    // 第二步：解析表达式
    const value = parser.parse(expr, scope, deps);

    // 第三步：执行指令逻辑
    // ...

    // 第四步：注册清理
    onElRemove(el, () => {
        // 清理资源：取消订阅、移除事件监听等
    });
});
```

---

## 常见问题

### Q1: 为什么在 JavaScript 中需要 `.value`，而在模板中不需要？

`ref()` 创建的是一个包装对象，实际值存储在 `.value` 属性中。模板引擎会自动检测并解包，所以模板中可以直接写 `{{ count }}` 而非 `{{ count.value }}`。但在 JavaScript 代码中，你必须显式访问 `.value`。

### Q2: `ref()` 和 `reactive()` 什么时候用哪个？

| 场景 | 推荐 |
|------|------|
| 基本类型（string, number, boolean） | `ref()` |
| 对象/数组 | `reactive()` |
| 需要替换整个值 | `ref()`（`ref.value = newObj`） |
| 需要解构 | `reactive()`（`const { a, b } = obj`） |

### Q3: `r-model` 什么时候需要 `provide()`？

- **需要**：在 `<script>` 标签中定义的变量
- **不需要**：在 `r-data` 或 `dom()` 组件内部定义的变量

### Q4: 插值中什么时候需要 `.value`？

只有在**进行动态运算**时才需要 `.value`：

```html
{{ count }}              <!-- 不需要，自动解包 -->
{{ count.value + 1 }}    <!-- 需要，做运算时获取真实值 -->
{{ user.name }}          <!-- reactive 不需要 -->
```

### Q5: `r-click` 中为什么基本类型需要 `_.` 前缀？

在 `r-data` 作用域内，基本类型变量通过 `_.变量名` 访问，这是为了区分"读取变量值"和"修改变量本身"。对象和数组类型则可以直接修改属性。

```html
<div r-data="{count: 0, user: {age: 20}}">
    <button r-click="_.count++">修改基本类型</button>
    <button r-click="user.age++">修改对象属性</button>
</div>
```

### Q6: 为什么修改了数据但页面没更新？

检查以下几点：
1. 数据是否用 `ref()` 或 `reactive()` 创建？
2. 是否在 `r-data` 作用域外使用了 `r-model` 但没有 `provide()`？
3. 是否直接替换了 `reactive()` 对象的整个引用？（`reactive` 不支持整体替换，用 `ref` 替代）
4. 是否在 `ref` 中存储了对象但修改了对象内部属性？（建议用 `reactive` 或 `ref.value.xxx`）

### Q7: 组件销毁后样式残留怎么办？

```javascript
// 销毁时同时删除样式
instance.del(true);

// 或手动删除
RealDom.delSty("component-name");
```

### Q8: 如何在 dom() 组件中 获取 DOM 元素引用？

在模板中使用 `ref="name"`，在 `mounted()` 生命周期中通过 `this.$refs.name` 访问。

### Q9: 路由切换时页面状态会丢失吗？

不会。路由系统使用 `display` 属性切换页面（而非销毁 DOM），表单输入、滚动位置等状态都会保留。

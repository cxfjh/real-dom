# RealDom

> 一个轻量级、高性能的响应式 DOM 框架

## 简介

RealDom 是一个现代化的前端框架，采用响应式编程范式，提供简洁直观的 API 来构建交互式 Web 应用。框架基于 Proxy 实现响应式系统，支持组件化开发、指令系统、路由管理等企业级特性。

### 核心特性

- **响应式系统** - 基于 Proxy 的深度响应式代理，支持对象和数组
- **组件化开发** - 声明式组件定义，支持模板、样式、逻辑分离
- **指令系统** - 内置丰富的指令（if、for、model、click 等）
- **路由管理** - 基于 URL Search Params 的 SPA 路由
- **批量更新** - 自动批处理 DOM 更新，提升性能
- **依赖收集** - 精准的依赖追踪和更新通知
- **零依赖** - 纯原生 JavaScript 实现，无需构建工具

## 快速开始

### 安装

```bash
npm install realdom
```

### 基础使用

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RealDom 示例</title>
    <script type="module" src="https://cdn.jsdelivr.net/npm/realdom/dist/0.0.1.js"></script>
</head>
<body r-app>
    <div>
        <h1>{{ title }}</h1>
        <p>计数: {{ count }}</p>
        <button r-click="increment">增加</button>
    </div>

    <script src="">
        const state = reactive({
            title: 'Hello RealDom',
            count: 0
        });

        function increment() {
            state.count++;
        }

        provide('state', state);
    </script>
</body>
</html>
```

## 核心 API

### 响应式 API

#### `reactive(target)`

创建响应式代理对象，支持深度响应式。

```javascript
const state = reactive({
    name: 'RealDom',
    count: 0,
    items: [1, 2, 3]
});

// 自动追踪依赖
console.log(state.name); // 读取时收集依赖
state.count = 1; // 修改时触发更新
```

**特性：**
- 支持对象和数组的深度代理
- 数组变异方法自动响应式（push、pop、shift、unshift、splice、sort、reverse）
- 防止重复代理
- 内置属性保护（`__isReactive`、`__raw`、`__isReactiveProxy`）

#### `ref(initialValue)`

创建响应式引用对象。

```javascript
const count = ref(0);

// 读取值
console.log(count.value); // 0

// 修改值
count.value = 1;
```

**特性：**
- 适用于基本类型和复杂类型
- 自动解包（在表达式中使用时）
- 支持类型推断

### 应用 API

#### `provide(key, value)`

向根作用域注入数据。

```javascript
// 单个键值对
provide('user', { name: 'Alice', age: 25 });

// 批量注入
provide({
    theme: 'dark',
    locale: 'zh-CN'
});
```

#### `dom(compName, options)`

定义组件。

```javascript
dom('my-component', {
    template: `
        <div class="card">
            <h3>{{ title }}</h3>
            <p>{{ content }}</p>
        </div>
    `,
    style: `
        .card {
            border: 1px solid #ccc;
            padding: 16px;
            border-radius: 8px;
        }
    `,
    script: (props, utils) => {
        return {
            title: props.title || '默认标题',
            content: props.content || '默认内容'
        };
    },
    pro: {
        title: '默认标题',
        content: '默认内容'
    },
    to: '#app',
    sty: true
});
```

**参数说明：**
- `template`: 组件 HTML 模板
- `style`: 组件 CSS 样式
- `script`: 组件逻辑函数，返回响应式数据
- `pro`: 组件属性默认值
- `to`: 自动挂载目标
- `sty`: 是否启用样式作用域，默认 true
- `as`: 组件注册别名

#### `onMounted(callback)`

注册 DOM 挂载完成回调。

```javascript
onMounted(() => {
    console.log('DOM 已挂载');
    // 执行初始化操作
});
```

## 指令系统

### 内置指令

#### `r-if`

条件渲染指令。

```html
<div r-if="isVisible">显示内容</div>
```

#### `r-for`

列表渲染指令。

```html
<ul>
    <li r-for="item in items" :key="item.id">
        {{ item.name }}
    </li>
</ul>
```

#### `r-click`

点击事件绑定。

```html
<button r-click="handleClick">点击我</button>
```

#### `r-model`

双向数据绑定。

```html
<input r-model="username" type="text">
<p>输入: {{ username }}</p>
```

#### `r-api`

异步数据加载。

```html
<div r-api="loadData">
    {{ data }}
</div>
```

#### `r-cp`

组件引用。

```html
<my-component r-cp="myComp"></my-component>
```

#### `r-ref`

DOM 元素引用。

```html
<div r-ref="myElement">内容</div>
```

#### `r-arr`

数组操作指令。

```html
<div r-arr="items">
    <!-- 数组内容 -->
</div>
```

#### `r-route`

路由目标容器。

```html
<div route="view">
    <!-- 路由页面将渲染在这里 -->
</div>
```

### 自定义指令

```javascript
import { registerDirective } from 'realdom';

registerDirective('highlight', (el, expr, scope, deps) => {
    const color = expressionParser.parse(expr, scope, deps);
    el.style.backgroundColor = color;
});
```

使用：

```html
<div r-highlight="'yellow'">高亮文本</div>
```

## 路由系统

### 路由注册

```javascript
router.add('home', () => {
    console.log('首页路由激活');
}, 'view');

router.add('about', () => {
    console.log('关于页面路由激活');
}, 'view');
```

### 路由导航

```javascript
// 导航到指定路由
router.nav('home');

// 替换当前历史记录
router.nav('about', true);
```

### 路由页面定义

```html
<div r-page="home" &route="view">
    <h1>首页</h1>
    <p>欢迎来到 RealDom</p>
</div>

<div r-page="about" &route="view">
    <h1>关于</h1>
    <p>RealDom 是一个轻量级响应式框架</p>
</div>

<div route="view">
    <!-- 路由页面将渲染在这里 -->
</div>
```

### 路由参数

路由使用 URL Search Params 传递参数：


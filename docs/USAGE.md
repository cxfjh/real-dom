# RealDom 官方文档

> 一个轻量级、高性能的响应式 DOM 框架

## 快速开始

### 1. 引入库

直接在 HTML 中引入 RealDom.js，无需任何构建步骤：

```html
<script src="https://cxfjh.cn/js/rd/0.0.1.js"></script>
```

### 2. 基础示例

```html
<body r-app>
   <!-- 响应式计数示例 -->
   <h1>{{ count }}</h1>

   <!-- 事件绑定示例 -->
   <button r-click="count.value++">增加</button>
   <button r-click="count.value--">减少</button>

   <!-- 双向绑定 -->
   <input type="text" r-model="name" placeholder="输入名字">
   <p>你好，{{ name }}!</p>

   <script>
      // 定义响应式数据
      const count = ref(0);
      const name = ref("");

      // 注入到根作用域
      provide({ count, name });
   </script>
</body>
```

## 核心 API

### 响应式系统

#### `ref()` - 基础类型响应式

创建响应式引用对象，适用于基本类型和复杂类型。

```javascript
// 定义基础类型响应式数据
const count = ref(0);
const name = ref("张三");
const user = ref({ name: "李四", age: 20 });

// 在脚本中访问或修改值（需要 .value）
console.log(count.value); // 0
count.value++; // 修改值，页面自动更新

// 在模板中使用时无需 .value
<h1>{{ count }}</h1>
```

**特性：**
- 适用于基本类型和复杂类型
- 在脚本中通过 `.value` 访问/修改
- 在模板中使用时自动解包，无需 `.value`

#### `reactive()` - 对象/数组响应式

创建响应式代理对象，支持深度响应式。

```javascript
// 定义对象响应式数据
const user = reactive({
   name: "李四",
   age: 20,
   address: {
      city: "北京"
   }
});

// 直接修改，无需写 .value
user.age = 21;
user.address.city = "上海";

// 数组响应式
const list = reactive([1, 2, 3]);
list.push(4); // 自动响应式
list.splice(0, 1); // 自动响应式
```

**特性：**
- 支持对象和数组的深度代理
- 数组变异方法自动响应式（push、pop、shift、unshift、splice、sort、reverse）
- 在脚本中直接访问/修改，无需 `.value`
- 在模板中使用时无需 `.value`

#### `provide()` - 向根作用域注入数据

将数据注入到根作用域，使其在整个应用中可用。

```javascript
// 单个键值对
provide('user', { name: 'Alice', age: 25 });

// 批量注入
provide({
   theme: 'dark',
   locale: 'zh-CN'
});

// 注入响应式数据
const count = ref(0);
const user = reactive({ name: '张三' });
provide({ count, user });
```

**注意：** `r-model` 双向绑定的变量需要通过 `provide()` 注入到根作用域。

### 指令系统

RealDom 提供了丰富的内置指令，用于实现条件渲染、列表渲染、事件绑定、双向数据绑定等功能。

#### 指令概览

| 指令        | 作用          | 示例                                            |
|-----------|-------------|-----------------------------------------------|
| `r-if`    | 条件渲染        | `<div r-if="isVisible">显示</div>`              |
| `r-click` | 事件绑定        | `<button r-click="handleClick">点击</button>`     |
| `r-model` | 双向数据绑定      | `<input r-model="username">`                    |
| `r-for`   | 数字循环渲染      | `<div r-for="5">第{{ index }}项</div>`          |
| `r-arr`   | 数组循环渲染      | `<div r-arr="list">值：{{ value }}</div>`       |
| `r-api`   | 异步数据加载      | `<div r-api="/api/data">...</div>`              |
| `r-cp`    | 组件引用        | `<div r-cp="user-card"></div>`                  |
| `r`       | DOM 元素引用    | `<div r="container">容器</div>`                 |

#### 指令详细说明

##### `r-if` - 条件渲染

根据条件表达式的值控制元素的显示/隐藏（通过 `display` 属性，非 DOM 移除）。

```html
<!-- 基础用法 -->
<div r-if="isVisible">显示内容</div>

<!-- 复杂表达式 -->
<div r-if="count.value > 5">计数大于5</div>
<div r-if="user.age >= 18">已成年</div>
<div r-if="isLoggedIn && user.role === 'admin'">管理员</div>

<script src="">
   const isVisible = ref(true);
   const count = ref(10);
   const user = reactive({ age: 20 });
   const isLoggedIn = ref(true);
</script>
```

**特性：**
- 通过 `display` 属性控制可见性，元素保留在 DOM 中
- 缓存初始 `display` 值，确保显示时恢复原始样式
- 结果无变化时跳过 DOM 操作，减少重排

##### `r-for` - 数字循环渲染

根据数字表达式重复渲染元素，索引从 1 开始。

```html
<!-- 基础用法：循环 5 次 -->
<div r-for="5">
   <p>第{{ index }}项</p>
</div>

<!-- 使用变量控制循环次数 -->
<div r-for="count">
   <p>索引：{{ index }}</p>
</div>

<!-- 自定义索引变量名 -->
<div r-for="10" index="i">
   <p>当前索引：{{ i }}</p>
</div>

<script src="">
   const count = ref(5);
</script>
```

**特性：**
- 索引从 1 开始
- 通过 `index` 属性自定义索引变量名（默认 "index"）
- 支持节点缓存复用，提升列表更新性能
- 自动清理过期节点缓存，防止内存泄漏

##### `r-arr` - 数组循环渲染

遍历数组并逐项渲染模板。

```html
<!-- 基础用法 -->
<div r-arr="list">
   索引：{{ index }} - 值：{{ value.name }}
</div>

<!-- 自定义值和索引变量名 -->
<div r-arr="list" value="user" index="idx">
   {{ user.name }} - {{ user.age }} - {{ idx }}
</div>

<!-- 直接使用数组字面量 -->
<div r-arr="['苹果', '香蕉', '橙子']">
   索引：{{ index }} - 值：{{ value }}
</div>

<!-- 指定唯一键属性（默认 id） -->
<div r-arr="list" key="id">
   {{ value.name }} (ID: {{ value.id }})
</div>

<script src="">
   const list = reactive([
       { id: 1, name: "张三", age: 18 },
       { id: 2, name: "李四", age: 20 },
   ]);
</script>
```

**属性说明：**
- `value` - 自定义项变量名（默认 "value"）
- `index` - 自定义索引变量名（默认 "index"）
- `key` - 指定唯一键属性（默认 "id"），用于高效复用节点

**特性：**
- 支持复杂对象数组和基本类型数组
- 通过唯一键属性实现节点复用，提升性能
- 自动清理过期节点缓存

##### `r-api` - 异步数据加载

自动发起 HTTP 请求并渲染数据。

```html
<!-- 基础用法：GET 请求 -->
<div r-api="https://api.example.com/users">
   {{ value.name }}
</div>

<!-- 指定响应数据字段 -->
<div r-api="https://api.example.com/data" list="items">
   {{ value.title }}
</div>

<!-- POST 请求 -->
<div r-api="https://api.example.com/create" meth="post" data-body='{"name": name.value}'>
   创建成功：{{ value.id }}
</div>

<!-- 自定义请求头 -->
<div r-api="https://api.example.com/protected" hdr='hdr'>
   {{ value.data }}
</div>

<!-- 手动加载模式 -->
<div r-api="https://api.example.com/data" aw>
   <span>{{ _aw ? '加载完成' : '等待加载' }}</span>
   <button id="refreshBtn">刷新数据</button>
</div>

<!-- 动态 URL -->
<div r-api="https://api.example.com/users/{{ userId.value }}">
   {{ value.name }}
</div>

<script src="">
   const name = ref("张三");
   const userId = ref(123);
   
   const hdr = {
       "Authorization": "Bearer token123",
       "Content-Type": "application/json"
   };
</script>
```

**属性说明：**
- `meth` - HTTP 方法（默认 GET），支持 GET、POST、PUT、PATCH、DELETE
- `hdr` - 请求头（JSON 字符串或表达式）
- `list` - 响应中的数组字段名
- `key` - 数组项唯一键属性（默认 "id"）
- `value` - 模板中的项变量名（默认 "value"）
- `index` - 模板中的索引变量名（默认 "index"）
- `arr` - 将整个数组注入作用域的变量名
- `refr` - 刷新按钮选择器
- `aw` - 手动加载模式标志
- `data-body` - POST/PUT/PATCH 请求体表达式

**特性：**
- 支持动态 URL（插值和变量引用）
- 支持手动加载模式
- 支持刷新按钮绑定
- 自动处理请求状态（`_aw` 变量表示是否完成）

##### `r-click` - 事件绑定

绑定 DOM 事件，支持所有原生事件类型。

**基础用法：点击事件**

```html
<!-- 基础点击事件 -->
<button r-click="count.value++">增加计数</button>
<button r-click="info.age = 0">重置年龄</button>

<!-- 多条语句 -->
<button r-click="count.value++; alert('当前计数：' + count.value)">增加并弹窗</button>

<!-- 调用函数 -->
<button r-click="handleSubmit()">提交</button>

<script src="">
   const count = ref(0);
   const info = reactive({ age: 0 });

   const handleSubmit = () => {
      console.log("提交数据", count.value, info.age);
      alert("提交成功！");
   };
</script>
```

**扩展事件类型**

通过元素属性指定事件类型，支持所有原生事件：

```html
<!-- 双击事件 -->
<div r-click="alert('双击触发')" dblclick>双击我</div>

<!-- 鼠标移入事件 -->
<div r-click="console.log('鼠标移入')" mouseover>鼠标移入</div>

<!-- 鼠标移出事件 -->
<div r-click="console.log('鼠标移出')" mouseout>鼠标移出</div>

<!-- 键盘事件 -->
<input type="text" r-click="console.log('按下了：' + event.key)" keydown placeholder="按下键盘触发">

<!-- 右键菜单事件 -->
<div r-click="alert('右键菜单')" contextmenu>右键点击</div>
```

**键盘事件按键过滤**

支持按特定按键触发事件：

```html
<!-- 只在按下 Enter 键时触发 -->
<input type="text" r-click="handleSearch()" keydown="enter" placeholder="按 Enter 搜索">

<!-- 只在按下 Esc 键时触发 -->
<input type="text" r-click="clearInput()" keydown="esc" placeholder="按 Esc 清空">

<!-- 组合键 -->
<input type="text" r-click="handleSave()" keydown="ctrl+s" placeholder="按 Ctrl+S 保存">

<script src="">
   const handleSearch = () => console.log('搜索');
   const clearInput = () => console.log('清空');
   const handleSave = () => console.log('保存');
</script>
```

**特性：**
- 自动检测元素上的事件类型属性
- 键盘事件支持按键名过滤
- 右键菜单事件自动阻止默认行为
- 预编译事件处理函数，避免重复编译

##### `r-cp` - 组件引用

引用通过 `<template>` 标签定义的组件。

```html
<!-- 定义组件 -->
<template r-cp="user-card">
   <div class="card">
      <h3>{{ name }}</h3>
      <p>年龄：{{ age }}</p>
   </div>
</template>

<!-- 使用组件 -->
<div r-cp="user-card" $name="张三" $age="18"></div>

<!-- 使用变量传递 props -->
<div r-cp="user-card" $name="userName.value" $age="userAge.value"></div>

<script src="">
   const userName = ref("李四");
   const userAge = ref(25);
</script>
```

**Props 传递规则：**
- 使用 `$` 前缀传递 props
- 驼峰命名使用短横杠转换：`$user-name` → `userName`
- 支持静态值和动态表达式

**特性：**
- 组件作用域继承根作用域并合并 props
- 支持 props 变化时自动重新渲染

### 组件系统

#### `dom()` - 定义组件

使用 `dom()` 函数定义组件，支持模板、样式、脚本分离。

```html
<body>
    <div id="user"></div>
</body>

<script src="">
    // 定义组件
    const UserComponent = dom("user", {
       // HTML 模板
       template: `
           <div class="user-card">
               <h3>{{ username }}</h3>
               <p>年龄：{{ age.value }}</p>
               <button r-click="increaseAge()">增加年龄</button>
           </div>
        `,

       // CSS 样式
       style: `
           .user-card {
               border: 1px solid #ccc;
               padding: 16px;
               border-radius: 8px;
           }
           button {
               background: #42b983;
               color: white;
               border: none;
               padding: 8px 16px;
               border-radius: 4px;
           }
        `,

       // 脚本逻辑
       script: (props, utils) => {
          const { $pro, $refs } = utils;
          
          // 初始化数据
          const setup = ($) => {
             const age = ref($pro.age.value);
             const username = ref("匿名用户");

             // 方法
             const increaseAge = () => {
                age.value++;
                console.log($refs.p.innerText);
             };
             
             // 通过 $ 定义的数据（可选）
             $.text = ref("Hello");
             $.setText = () => $.text.value = "Hello World";

             return { age, username, increaseAge };
          };

          // 生命周期钩子
          function mounted() {
             console.log("组件 DOM 挂载完成");
             console.log(this.$refs.p);
          }

          function unmounted() {
             console.log("组件 DOM 销毁时调用");
          }

          return { setup, mounted, unmounted };
       },

       // 样式隔离（默认启用）
       sty: true,

       // 组件属性默认值
       pro: {
          age: ref(18),
          title: ref("用户信息"),
          x: 12
       }
    });

    // 挂载组件
    const uc = UserComponent({ 
        name: "#user", 
        sty: true, 
        pro: { age: ref(11) } 
    });
    
    // 组件实例方法
    setTimeout(() => {
        console.log(uc.root()); // 获取组件的根元素
        uc.age.value = 20; // 修改内部数据
        uc.$pro.age = 15; // 修改默认值
        uc.delSty(); // 删除共享样式
        uc.del(false); // 删除组件
    }, 2000);
</script>
```

**组件配置选项：**
- `template` - 组件 HTML 模板字符串
- `style` - 组件 CSS 样式字符串
- `script` - 组件脚本逻辑工厂函数
- `pro` - 组件属性默认值
- `sty` - 是否启用 CSS 作用域隔离，默认 true
- `to` - 自动挂载的目标元素选择器或 DOM 元素

**生命周期钩子：**
- `mounted()` - 组件 DOM 挂载完成后调用
- `unmounted()` - 组件 DOM 销毁时调用

**组件实例方法：**
- `root()` - 获取组件的根元素
- `delSty()` - 删除共享样式
- `del(deleteStyle)` - 删除组件，参数表示是否删除共享样式

### 路由系统

RealDom 提供基于 URL Search Params 的 SPA 路由功能。

#### 路由页面定义

使用 `r-page` 属性定义路由页面，`&route` 属性指定渲染容器。

```html
<body>
   <!-- 定义路由页面 -->
   <div r-page="home">
      <h3>首页</h3>
      <p>欢迎来到 RealDom</p>
   </div>
   
   <div r-page="about" &route="info">
      <h3>关于</h3>
      <p>RealDom 是一个轻量级响应式框架</p>
   </div>
   
   <div r-page="settings" &route="view">
      <h3>设置</h3>
      <p>应用设置页面</p>
   </div>

   <!-- 路由容器 -->
   <div>
      <h1>主视图容器</h1>
      <div route="view"></div>
   </div>
   <div>
      <h1>信息容器</h1>
      <div route="info"></div>
   </div>

   <!-- 路由导航 -->
   <button r-route="home">首页</button>
   <button r-route="about">关于</button>
   <button r-route="settings">设置</button>
   
   <!-- 编程式导航 -->
   <button r-click="router.nav('home')">编程式导航</button>
</body>
```

#### 路由 API

```javascript
// 注册路由
router.add('home', () => {
   console.log('首页路由激活');
}, 'view');

router.add('about', () => {
   console.log('关于页面路由激活');
}, 'info');

// 导航到指定路由
router.nav('home');

// 替换当前历史记录
router.nav('about', true);
```

**路由参数：**
- 路由使用 URL Search Params 传递参数
- 格式：`?path=home`
- 示例：`https://example.com/?path=home`

**特性：**
- 支持多容器路由
- 支持声明式和编程式导航
- 自动预渲染所有路由页面

### DOM 引用

使用 `r` 指令和 `$r` 对象获取 DOM 元素引用。

#### 静态引用

```html
<body>
   <div r="container">内容容器</div>
   <input type="text" r="username" placeholder="用户名">
</body>

<script src="">
   // 在 onMounted 中访问引用
   onMounted(() => {
      console.log($r.container); // 获取 DOM 元素
      $r.container.innerText = "修改后的内容";
      $r.username.value = "默认值";
   });
</script>
```

#### 动态引用

```html
<body>
   <div r="{{ refName }}">内容容器</div>
   <input type="text" r="{{ inputRef }}" placeholder="用户名">
</body>

<script src="">
   const refName = ref("container");
   const inputRef = ref("username");

   onMounted(() => {
      console.log($r.container);
      console.log($r.username);
   });
</script>
```

#### 使用空 src 脚本

```html
<body>
   <div r="container">内容容器</div>
</body>

<script src>
   // 空 src 脚本在 DOM 初始化后执行
   $r.container.innerText = "DOM 已加载";
   console.log($r.container);
</script>
```

**特性：**
- 静态引用：`r="myEl"` → `$r.myEl`
- 动态引用：`r="{{refName}}"` → refName 变化时自动更新
- 元素销毁时自动清理引用，防止内存泄漏

## 注意事项

### 响应式数据访问

- **ref 类型**：在脚本中需要通过 `.value` 访问/修改，在模板中使用时自动解包
- **reactive 类型**：在脚本中直接访问/修改，无需 `.value`，在模板中使用时也无需 `.value`

```javascript
const count = ref(0);
const user = reactive({ name: '张三' });

// 脚本中
console.log(count.value); // 0
count.value = 1;
console.log(user.name); // '张三'
user.name = '李四';

// 模板中
<h1>{{ count }}</h1>
<p>{{ user.name }}</p>
```

### r-model 双向绑定

- 必须通过 `provide()` 注册后才能使用
- 支持简单路径：`r-model="name"`
- 支持嵌套路径：`r-model="user.profile.name"`
- 支持 input、select、checkbox、radio 等表单元素

### 组件样式隔离

- 默认启用样式隔离，组件样式不会影响全局
- 可通过 `sty: false` 关闭隔离

### 表达式解析

- 模板中的 `{{ }}` 支持 JS 表达式和插值
- 指令中的值（如 r-if、r-click）直接执行 JS 代码
- 支持动态 URL 和属性值

### 性能优化建议

1. **使用 r-for 和 r-arr 时提供唯一键**
   ```html
   <div r-arr="list" key="id">{{ value.name }}</div>
   ```

2. **避免深层嵌套响应式对象**
   ```javascript
   // 不推荐
   const state = reactive({
       level1: { level2: { level3: { value: 1 } } }
   });
   
   // 推荐：扁平化结构
   const state = reactive({
       level1Value: 1,
       level2Value: 2,
       level3Value: 3
   });
   ```

3. **合理使用批量更新**
   ```javascript
   // 批量操作，只触发一次更新
   state.items.push(1);
   state.items.push(2);
   state.items.push(3);
   ```

## 浏览器兼容性

- Chrome/Edge: >= 88
- Firefox: >= 78
- Safari: >= 14
- Opera: >= 74

## 许可证

MIT License

---

**RealDom** - 让响应式开发更简单

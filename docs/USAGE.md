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
<h1 class="{{ className }}">基础响应式</h1>
<p style="color: {{ color }}">{{ text }}</p>
<p>{{ textArr.region }}</p>
<p>({{ num1 }} + 2) × {{ num2 }} = {{ (num1.value + 2) * num2.value }}</p>
<p>当前 num2 = {{ num2 }}</p>

<label>
   num1 = {{ num1 }}
   <input type="number" r-model="num1" r-click="console.log(num1.value)" keydown="enter">
   num1 = {{ num1 }}
</label>

<div>
   <button r-click="num2.value++">num2 + 1</button>
   <button r-click="num2.value--; console.log(num2.value)" dblclick>双击 num2 - 1</button>
</div>

<script>
   const color = ref("red");
   const className = ref("h1");
   const text = ref("hello world");
   const textArr = reactive({ region: "北京" });
   console.log(text.value, textArr.region);

   const num1 = ref(2);
   const num2 = ref(1);
   provide({ num1 });
</script>
```

**特性：**
- ref()：创建基础类型响应式变量（字符串、数字、布尔）
- reactive()：创建对象、数组类型响应式数据
- 插值表达式中进行运算时，必须使用 .value 获取真实值
- r-model 双向绑定的变量，必须通过 provide({ 变量 }) 暴露到模板
- r-click 内部为原生 JS 代码，访问响应式变量必须加 .value

## 核心 API

### 响应式系统

#### `ref()` - 基础类型响应式

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

#### `watch()` - 监听响应式数据变化

```javascript
const html = ref("123");
const obj = reactive({ age: "1" });
const count = ref(1);

const unwatch1 = watch(() => obj.age, (newVal, oldVal) => {
    console.log(`新值：${newVal} 旧值：${oldVal}`);
}, { once: true }); // once 只执行一次

const unwatch2 = watch(() => html.value, (newVal, oldVal) => {
    console.log(`新值：${newVal} 旧值：${oldVal}`);
}, { once: true, immediate: true }); // immediate 立即执行

watch(() => count.value, (newVal, oldVal) => {
    console.log(`新值：${newVal} 旧值：${oldVal}`);
});

// 调用返回函数销毁监听器
unwatch1();
unwatch2();
```

**特性：**
- 可以设置 `immediate` 选项，立即执行监听函数
- 可以设置 `once` 选项，只执行一次监听函数

#### `{{ }}` - 插值表达式

```html
<h1>{{ count }}</h1>
<span style="color: {{ color }}">span</span>
<div class="{{ className }}"></div>

<script>
    const count = ref(0);
    const color = ref("red");
    const className = ref("div1");
</script>
```

**特性：**
- 支持逻辑运算、三元表达式、原生 JS 代码
- 插值表达式中进行运算时，必须使用 .value 获取真实值。
- 支持动态 style 属性和 class 类名和一些其他的属性

### 指令系统

#### 指令概览

| 指令        | 作用       | 示例                                          |
|-----------|----------|---------------------------------------------|
| `r-if`    | 条件渲染     | `<div r-if="isVisible">显示</div>`            |
| `r-click` | 事件绑定     | `<button r-click="handleClick">点击</button>` |
| `r-model` | 双向数据绑定   | `<input r-model="username">`                |
| `r-for`   | 数字循环渲染   | `<div r-for="5">第{{ index }}项</div>`        |
| `r-arr`   | 数组循环渲染   | `<div r-arr="list">值：{{ value }}</div>`     |
| `r-api`   | 异步数据加载   | `<div r-api="/api/data">...</div>`          |
| `r-cp`    | 组件引用     | `<div r-cp="user-card"></div>`              |
| `r`       | DOM 元素引用 | `<div r="container">容器</div>`               |

#### 指令详细说明

##### `r-if` - 条件渲染

```html
<!-- 基础用法 -->
<h1>r-if 条件显示/隐藏</h1>
<span r-if="1 < 2">1</span>
<span r-if="isShow">显示</span>
<span r-if="!isShow.value">隐藏</span>

<div>
   <button r-click="isShow.value = false">隐藏</button>
   <button r-click="isShow.value = true">显示</button>
</div>

<script>
   const isShow = ref(true);
</script>
```

**特性：**
- r-if="表达式"：根据表达式结果控制元素显示/隐藏
- 判定规则：0、false、空字符串 为隐藏，其他为显示
- 支持：逻辑运算、响应式变量、三元表达式、原生 JS
- 响应式变量判断时必须使用 .value 获取真实状态

##### `r-for` - 数字循环渲染

```html
<h1>r-for 数字循环</h1>
<div r-for="1 > 0 ? 2 : 1">{{ index }}</div>

<div r-for="forIndex" index="i">
   <div r-for="i" index="j">
      {{ j }} × {{ i }} = {{ i * j }}
      &nbsp;&nbsp;
   </div>
</div>

<div>
   <button r-click="forIndex.value++">增加层数</button>
   <button r-click="forIndex.value--">减少层数</button>
</div>

<script>
   const forIndex = ref(3);
</script>
```

**特性：**
- r-for="数字"：根据数字循环对应次数
- 支持：固定数字、响应式变量、三元表达式、JS 变量
- 默认索引变量名为 index
- 可使用 index="i" 自定义索引名称，支持多层嵌套循环

##### `r-arr` - 数组循环渲染

```html
<h1>r-arr 数组循环</h1>
<div r-arr="['苹果','香蕉']">索引：{{ index }}，值：{{ value }}</div>
<div r-arr="arr1">索引：{{ index }}，值：{{ value }}</div>
<div r-arr="arr2.food" index="i" value="item">
   索引：{{ i }}｜值：{{ item }}｜价格：{{ arr2.price[i] }}
</div>

<div>
   <button r-click="arr2.food.push('鱼'); arr2.price.push(40);">添加鱼</button>
</div>

<script>
   const arr1 = ref(["苹果", "香蕉", "梨子", "葡萄"]);
   const arr2 = reactive({
      food: ["牛肉", "鱼肉", "鸡肉"],
      price: [10, 20, 30]
   });
</script>
```

**特性：**
- r-arr="数组"：遍历数组并渲染每一项
- 支持：直接写数组、响应式变量、对象内数组
- 默认项变量：value，默认索引：index
- 可使用 value="item" index="i" 自定义名称
- 数组变化（push、splice）时视图自动更新

##### `r-api` - 异步数据加载

```html
<h1>r-api 网络请求</h1>

<ul r-api="{{ 'https://xx.cxfjh.cn/api/' + ms.value }}">
   <li>{{ value.content }} · {{ value.date }}</li>
</ul>

<div r-api="https://xx.cxfjh.cn/api/messages" hdr="hdr" meth="{{md}}" data-body="dataBody"></div>

<ul r-api="https://xx.cxfjh.cn/api/messages" aw arr="list" refr="#refreshBtn">
   <li r-if="_aw" r-arr="list">
      {{ value.content }} · {{ value.date }}
   </li>
</ul>

<button id="refreshBtn">刷新</button>

<script>
   const ms = ref("messages");
   const md = ref("post");
   const dataBody = ref({ content: "hello RealDom" });
   const hdr = {
      "Authorization": "Bearer token123",
      "Content-Type": "application/json"
   };
</script>
```

**特性：**
- r-api="地址"：发送网络请求并自动渲染列表
- meth="GET/POST"：设置请求方式，默认为 GET
- hdr="变量"：绑定请求头对象
- data-body="变量"：POST 请求时传递请求体数据
- aw：开启手动加载模式，不会自动请求
- _aw：请求完成标志，可用于 r-if 判断加载状态
- arr="list"：将接口数组存入 list 变量，手动循环渲染
- refr="#id"：绑定刷新按钮，点击重新请求
- list="data"：指定接口返回数据中的数组字段

##### `r-click` - 事件绑定

```html
<h1>r-click 事件指令</h1>
<button r-click="alert('单击')">单击</button>
<button r-click="alert('双击')" dblclick>双击</button>
<button r-click="alert('鼠标按下')" mousedown>鼠标按下</button>
<label>
   <input type="text" r-click="alert('键盘抬起')" keyup/>
   <input type="text" r-click="alert('键盘按下 enter')" keydown="enter"/>
</label>
```

**特性：**
- r-click="JS代码"：绑定点击/交互事件，内部写原生 JS
- 支持所有原生事件：click、dblclick、mousedown、mouseup、mouseover、contextmenu、keyup、keydown
- keydown="enter"：监听回车按键
- 事件内部访问响应式变量必须使用 .value

##### `r-cp` - 组件引用

```html
<!-- template 定义组件 -->
<template r-cp="user">
   <h1>CP</h1>
   <h3>{{ name }}</h3>
   <h4>{{ userAge }}</h4>
</template>

<!-- 实例化组件 -->
<div r-cp="user" $name="fjh" $user-age="age1"></div>
<div r-cp="user" $name="xxx" $user-age="1"></div>

<script>
   const age1 = ref(20);
   setTimeout(() => age1.value = 30, 2000);
</script>
```

**特性：**
- template定义模板组件
- r-cp="组件名"：使用并渲染组件
- $属性="值"：向组件传递参数，支持响应式变量
- 传递参数时驼峰式写法：$user-age → 组件内 userAge
- 组件可复用，多实例互不干扰
- 传递的变量自动响应式，数据变化视图同步更新

### 组件系统

```html
<body>
    <div id="user"></div>
</body>

<script src="">
    // 定义组件
    const UserComponent = dom("user", {
       template: `
            <div class="card">
                <h1>{{ $pro.domText }}</h1>
                
                <h3>名字：{{ username.name }}</h3>
                <p ref="age">年龄: {{ age }}</p>
                
                <p>性别: {{ $pro.gender }}</p>
                <p>邮箱: {{ $pro.email }}</p>
                
                <button r-click="setInfo()">自增</button>
                
                <span>{{ input }}</span>
                <input type="text" r-model="input"/>
                
                <p>当前计数: {{ count }}</p>
            </div>
        `,

       style: `
            .card {
                border: 1px solid #ccc;
                padding: 20px;
                border-radius: 8px;
                max-width: 300px;
                background: white;
            }
			
            h3 {
                color: #333;
            }
			
            button {
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 5px;
                cursor: pointer;
            }
        `,

       script: ({ $refs, $pro }, { ref, reactive, provide }) => {
           const setup = (ctx) => {
           // 组件外部响应式变量
           const age = ref(20);
           const username = reactive({ name: "fjh" });
      
           // 组件内部响应式变量
           const input = ref("x");
           provide({ input });
      
           // 组件内部响应式变量, 不需要返回, 可以在模板中使用
           ctx.count = ref(0);
      
           // 组件方法
           const setInfo = () => {
               age.value++;
               ctx.count.value++;
               $pro.gender.value = "x" + age.value;
               console.log($refs.age, ctx.count);
           };
      
           return { age, username, input, setInfo };
       };

        // 组件 DOM 渲染完成后调用
        function mounted() {
           console.log("组件 DOM 渲染完成后调用");
           $refs.age.style.color = "red";
           console.log(this.age.value);
        }
      
        // 组件 DOM 销毁时调用
        function unmounted() {
           console.log("组件 DOM 销毁时调用");
        }

       return { setup, mounted, unmounted };
    },

       // 默认值
       pro: {
           gender: "性别",
           domText: "Hello World",
           email: "qq"
       }
    });

    // 挂载组件
    const uc = UserComponent({ pro: { gender: "女", email }, name: "#user", sty: true });
    
    // 组件实例方法
    setTimeout(() => {
       console.log(uc.root()); // 获取组件的根元素
       uc.age.value = 20; // 修改内部数据
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

```html
<!-- 定义路由页面 -->
<div r-page="home">
   <h3>【首页】 我是 view 容器的内容</h3>
</div>
<div r-page="settings" &route="view">
   <h3>【设置】 我是 view 容器的内容</h3>
</div>

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
   router.add("mine", () => {
      console.log("路由激活");
   }, "info");
</script>
```

**特性：**
- r-page="路由名"：定义路由页面内容
- &route="容器名"：指定当前路由渲染到哪个容器
- route="容器名"：路由渲染出口，页面显示位置
- r-route="路由名"：点击跳转对应路由
- route-active：路由激活时自动添加样式，默认类名 r-active
- route-active="类名"：可自定义激活样式类名
- router.nav('路由名')：JS 中跳转路由
- router.add('路由名', 回调, '容器')：注册路由并绑定激活回调

### DOM 引用

```html
<h1>r DOM 元素引用</h1>
<span r="span">span</span>
<span r="rSpan">span</span>
<span r="{{1 < 2 ? 'span1' : 'rSpan'}}">动态</span>

<script>
   const rSpan = ref("span");

   onMounted(() => {
      console.log($r.span, $r.rSpan);
      rSpan.value = "span1";
      $r.rSpan.style.color = "red";
      $r.span.style.color = "green";
   });
</script>
```

**特性：**
- r="名称"：给 DOM 元素设置引用名称
- 通过 $r.名称 可直接获取并操作 DOM 元素
- 支持动态名称：可使用表达式、响应式变量
- 建议在 onMounted 生命周期中使用，确保 DOM 已渲染
- 引用名称全局唯一，不可重复


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

### 生命周期

```html
<script src>
    // DOM 初始化后执行
	onMounted(() => {})
</script>

<script src>
   // 空 src 脚本在 DOM 初始化后执行
</script>
```

**特性：**
- onMounted()：组件 DOM 挂载完成后调用
- 空 src 脚本在 DOM 初始化后执行

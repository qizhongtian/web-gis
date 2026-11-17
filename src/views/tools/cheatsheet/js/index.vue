<script setup lang="ts">
import ToolPage from '@/components/tools/ToolPage.vue'
import CheatSheet from '@/components/tools/CheatSheet.vue'

const sections = [
  {
    title: '数组',
    desc: 'Array 高频方法',
    items: [
      { name: 'map / filter', desc: '返回新数组，不改变原数组', code: '[1, 2, 3].map((n) => n * 2);        // [2, 4, 6]\n[1, 2, 3].filter((n) => n > 1);    // [2, 3]' },
      { name: 'reduce', desc: '聚合为单值，注意给初始值避免空数组报错', code: 'list.reduce((sum, item) => sum + item.price, 0);' },
      { name: 'find / findIndex / some / every', desc: '条件查找与判定', code: 'list.find((u) => u.id === 1);\nlist.some((u) => u.active);\nlist.every((u) => u.age > 18);' },
      { name: 'sort', desc: '原地排序且默认按字符串，数字务必给比较器', code: '[10, 2, 1].sort((a, b) => a - b); // [1, 2, 10]' },
      { name: 'flat / flatMap', desc: '拍平层级，flatMap 等价 map + flat(1)', code: '[[1], [2, [3]]].flat(Infinity);  // [1, 2, 3]' },
      { name: 'at / toSorted / toReversed', desc: 'ES2023 不可变版本，避免污染原数组', code: 'arr.at(-1);\narr.toSorted((a, b) => a - b);\narr.toReversed();' },
      { name: 'Array.from / fill', desc: '类数组与可迭代对象转数组，常用于构造序列', code: 'Array.from({ length: 5 }, (_, i) => i); // [0,1,2,3,4]' },
      { name: 'includes / indexOf', desc: '判断是否存在，NaN 用 includes 更可靠', code: '[NaN].includes(NaN); // true' },
    ],
  },
  {
    title: '字符串',
    desc: 'String 常用操作',
    items: [
      { name: '模板字符串', desc: '支持多行与插值', code: 'const text = `共 ${list.length} 条`;' },
      { name: 'slice / substring', desc: 'slice 支持负索引，substring 会自动交换参数', code: '"web-gis".slice(-3); // "gis"' },
      { name: 'split / join', desc: '字符串与数组互转', code: '"a,b,c".split(",");\n["a", "b"].join("-"); // "a-b"' },
      { name: 'replaceAll / replace', desc: 'replace 只替换首个，正则需带 g 标志', code: '"a-a-a".replaceAll("a", "b");' },
      { name: 'padStart / padEnd', desc: '补齐位数，数字格式化常用', code: 'String(7).padStart(2, "0"); // "07"' },
      { name: 'trim / trimStart', desc: '去空白，表单清洗必备', code: 'input.trim();' },
      { name: 'includes / startsWith', desc: '前缀判断，比正则更快', code: '"https://x".startsWith("https");' },
    ],
  },
  {
    title: '对象与解构',
    desc: 'Object / 解构 / 展开',
    items: [
      { name: '解构与默认值', desc: '可嵌套解构并重命名', code: 'const { name = "匿名", info: { age } = {} } = user;' },
      { name: '剩余与展开', desc: '展开是浅拷贝，嵌套对象仍共享引用', code: 'const next = { ...state, count: 1 };\nconst { id, ...rest } = row;' },
      { name: 'Object.entries / fromEntries', desc: '对象与键值对数组互转', code: 'Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v * 2]));' },
      { name: 'Object.keys / values', desc: '遍历自身可枚举属性', code: 'Object.keys(obj).length;' },
      { name: '可选链 / 空值合并', desc: '避免深层访问报错；?? 只对 null/undefined 生效', code: 'user?.profile?.avatar ?? "/default.png";' },
      { name: 'structuredClone', desc: '原生深拷贝，支持 Date / Map / Set，不能拷函数', code: 'const copy = structuredClone(source);' },
      { name: 'Object.freeze', desc: '浅冻结，防止误改常量配置', code: 'const CONFIG = Object.freeze({ env: "prod" });' },
    ],
  },
  {
    title: '数字与 Math',
    desc: '数值处理',
    items: [
      { name: '精度陷阱', desc: '0.1 + 0.2 !== 0.3，金额用整数分或 decimal 库', code: '0.1 + 0.2;               // 0.30000000000000004\nMath.round(0.1 * 100 + 0.2 * 100) / 100;' },
      { name: 'Number 判断', desc: 'NaN 只能用 Number.isNaN 判断', code: 'Number.isInteger(1.0);  // true\nNumber.isFinite(Infinity); // false' },
      { name: '取整', desc: 'floor 向下、ceil 向上、round 四舍五入、trunc 去小数', code: 'Math.floor(-1.5); // -2\nMath.trunc(-1.5); // -1' },
      { name: '格式化', desc: '千分位用 Intl.NumberFormat', code: 'new Intl.NumberFormat("zh-CN").format(1234567.891);' },
      { name: '随机与范围', desc: '含最小值、不含最大值的整数随机', code: 'const rand = (min, max) => Math.floor(Math.random() * (max - min)) + min;' },
      { name: 'BigInt', desc: '超过 2^53 的整数用 BigInt，注意不能与 Number 混算', code: 'typeof 1n; // "bigint"\n1n + 1n;   // 2n' },
    ],
  },
  {
    title: 'Promise 与异步',
    desc: '异步编排',
    items: [
      { name: 'async / await', desc: 'await 只能拿到成功值，失败需 try/catch', code: 'try {\n  const data = await request();\n} catch (e) {\n  console.error(e);\n}' },
      { name: 'Promise.all', desc: '全部成功才成功，任一失败即 reject（快速失败）', code: 'const [a, b] = await Promise.all([getA(), getB()]);' },
      { name: 'Promise.allSettled', desc: '拿到每个结果的状态，适合批量任务', code: 'const results = await Promise.allSettled(tasks);\nresults.filter((r) => r.status === "fulfilled");' },
      { name: 'Promise.race / any', desc: 'race 取最快；any 取第一个成功的', code: 'await Promise.race([fetchData(), timeout(3000)]);' },
      { name: '串行与并发', desc: 'for await 串行；for + await 容易误写成串行', code: 'for (const id of ids) await load(id);        // 串行\nawait Promise.all(ids.map((id) => load(id))); // 并发' },
      { name: '超时控制', desc: 'AbortSignal.timeout 原生支持', code: 'fetch(url, { signal: AbortSignal.timeout(5000) });' },
    ],
  },
  {
    title: '类型判断与拷贝',
    desc: '运行时类型',
    items: [
      { name: 'typeof 的坑', desc: 'typeof null 为 "object"，数组需用 Array.isArray', code: 'typeof null;          // "object"\nArray.isArray([]);     // true' },
      { name: 'Object.prototype.toString', desc: '精确判断内置类型', code: 'Object.prototype.toString.call(new Date()); // "[object Date]"' },
      { name: 'instanceof', desc: '基于原型链，跨 iframe 会失效', code: 'new Map() instanceof Map; // true' },
      { name: '浅拷贝', desc: '展开 / Object.assign 只复制第一层', code: '{ ...obj }; Object.assign({}, obj);' },
      { name: '深拷贝', desc: 'structuredClone 优先，避免 JSON 丢 Date 与 undefined', code: 'JSON.parse(JSON.stringify(obj)); // 会丢 Date / undefined / 函数' },
      { name: '相等判断', desc: '始终使用 ===，Object.is 可区分 -0 与 NaN', code: 'Object.is(NaN, NaN); // true' },
    ],
  },
  {
    title: 'DOM 与事件',
    desc: '浏览器交互',
    items: [
      { name: '查询', desc: 'querySelector 返回首个匹配，querySelectorAll 返回静态 NodeList', code: 'document.querySelector(".app-panel");' },
      { name: '事件委托', desc: '监听父级，用 closest 定位目标，减少监听器数量', code: 'list.addEventListener("click", (e) => {\n  const item = e.target.closest(".item");\n});' },
      { name: '事件选项', desc: 'passive 提升滚动性能，once 自动解绑', code: 'el.addEventListener("scroll", fn, { passive: true });' },
      { name: '节流与防抖', desc: 'resize / input 必须节流，否则主线程卡顿', code: 'const debounce = (fn, delay = 300) => {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n};' },
      { name: 'IntersectionObserver', desc: '懒加载与曝光统计的核心 API', code: 'new IntersectionObserver((entries) => {\n  entries.forEach((e) => e.isIntersecting && load(e.target));\n});' },
      { name: 'ResizeObserver', desc: '监听元素尺寸变化，替代 window.resize', code: 'new ResizeObserver(([entry]) => {\n  console.log(entry.contentRect.width);\n}).observe(el);' },
    ],
  },
  {
    title: '日期与存储',
    desc: '时间 / 本地存储',
    items: [
      { name: '时间戳', desc: 'Date.now() 毫秒；秒级需除以 1000', code: 'Date.now();\nMath.floor(Date.now() / 1000);' },
      { name: '格式化', desc: 'Intl.DateTimeFormat 免依赖本地化', code: 'new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date());' },
      { name: '相对时间', desc: 'Intl.RelativeTimeFormat 生成「3 分钟前」', code: 'new Intl.RelativeTimeFormat("zh-CN").format(-3, "minute");' },
      { name: 'localStorage', desc: '同步、字符串存储、同源共享，需手动 JSON 序列化', code: 'localStorage.setItem("token", JSON.stringify(obj));\nJSON.parse(localStorage.getItem("token") || "{}");' },
      { name: 'Cookie', desc: '可设置过期与 HttpOnly（后端），容量约 4KB', code: 'document.cookie = "theme=dark; path=/; max-age=86400";' },
      { name: 'IndexedDB', desc: '大容量异步存储，适合离线瓦片与缓存数据', code: 'const db = await indexedDB.open("gis", 1);' },
    ],
  },
]
</script>

<template>
  <ToolPage title="JavaScript 速查" desc="数组、字符串、对象、异步、类型判断、DOM 与存储的高频写法" wide>
    <CheatSheet :sections="sections" />
  </ToolPage>
</template>

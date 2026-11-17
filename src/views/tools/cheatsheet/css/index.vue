<script setup lang="ts">
import ToolPage from '@/components/tools/ToolPage.vue'
import CheatSheet from '@/components/tools/CheatSheet.vue'

const sections = [
  {
    title: '布局与显示',
    desc: 'display / position / 盒模型',
    items: [
      { name: 'display', desc: '元素生成盒的类型，flex/grid 会触发新的格式化上下文', code: 'display: block | inline | inline-block | flex | grid | none;' },
      { name: 'box-sizing', desc: '全局推荐 border-box，让 width 包含 padding 与 border', code: '*, *::before, *::after { box-sizing: border-box; }' },
      { name: 'overflow', desc: '裁剪与滚动容器，overflow: hidden 也会创建 BFC', code: 'overflow: visible | hidden | scroll | auto;\noverflow-x / overflow-y 可单独控制' },
      { name: 'aspect-ratio', desc: '无需 padding hack 固定宽高比，常用于视频、封面图', code: '.cover { aspect-ratio: 16 / 9; object-fit: cover; }' },
      { name: 'contain / content-visibility', desc: '隔离渲染范围，长列表首屏优化利器', code: 'contain: layout paint;\ncontent-visibility: auto;' },
      { name: 'isolation', desc: '创建新的层叠上下文，避免 z-index 互相污染', code: 'isolation: isolate;' },
    ],
  },
  {
    title: 'Flexbox',
    desc: '一维布局',
    items: [
      { name: '容器三件套', desc: '主轴方向、主轴对齐、交叉轴对齐', code: '.box {\n  display: flex;\n  flex-direction: row | column;\n  justify-content: flex-start | center | space-between;\n  align-items: stretch | center | flex-start;\n}' },
      { name: 'flex 简写', desc: 'grow / shrink / basis，推荐 0 0 auto 与 1 1 0 两种心智', code: 'flex: 1;         /* 1 1 0% 等分 */\nflex: none;      /* 0 0 auto 不伸不缩 */\nflex: 0 0 200px; /* 固定宽度 */' },
      { name: 'gap', desc: '弹性子项间距，比 margin 更干净', code: 'display: flex; gap: 12px 8px; /* 行 列 */' },
      { name: 'flex-wrap', desc: '换行后需用 align-content 控制多行对齐', code: 'flex-wrap: wrap;\nalign-content: space-between;' },
      { name: '居中布局', desc: '水平垂直居中一行搞定', code: 'display: flex; align-items: center; justify-content: center;' },
      { name: '子项属性', desc: '单独控制某个子项的对齐与顺序', code: 'align-self: center;\norder: -1;\nflex-grow: 2;' },
    ],
  },
  {
    title: 'Grid',
    desc: '二维布局',
    items: [
      { name: '定义网格', desc: 'fr 单位按剩余空间分配，minmax 定义弹性区间', code: '.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));\n  gap: 12px;\n}' },
      { name: '区域命名', desc: '用 grid-template-areas 拼版，可读性最高', code: 'grid-template-areas:\n  "head head"\n  "side main";\n.header { grid-area: head; }' },
      { name: '跨行跨列', desc: 'span 语法比写死行号更灵活', code: 'grid-column: 1 / -1;   /* 横跨整行 */\ngrid-row: span 2;' },
      { name: '自动放置', desc: 'grid-auto-flow: dense 可以填补空洞', code: 'grid-auto-flow: row dense;' },
      { name: '对齐', desc: 'justify-content 主轴、align-items 交叉轴、place-items 简写', code: 'place-items: center;\nplace-content: space-between center;' },
    ],
  },
  {
    title: '尺寸与间距',
    desc: '单位 / 计算 / 间距',
    items: [
      { name: 'clamp', desc: '流式字号：最小 / 首选 / 最大，替代大量媒体查询', code: 'font-size: clamp(14px, 1.2vw + 10px, 20px);' },
      { name: 'calc', desc: '运算符两侧必须有空格', code: 'width: calc(100% - 2 * 16px);' },
      { name: '逻辑属性', desc: '与书写方向无关，多语言场景更稳', code: 'margin-inline: auto;\npadding-block: 12px;' },
      { name: 'margin 简写', desc: '上 右 下 左 顺时针；auto 可用于水平居中', code: 'margin: 0 auto;      /* 上下 0，左右自适应 */\nmargin: 8px 12px 8px 12px;' },
      { name: '视口单位', desc: 'dvh 动态视口高度，解决移动端地址栏抖动', code: 'height: 100dvh; width: 100vw;' },
      { name: 'object-fit', desc: '替换元素内容填充方式，避免图片拉伸', code: 'img { width: 100%; height: 180px; object-fit: cover; }' },
    ],
  },
  {
    title: '定位与层级',
    desc: 'position / z-index',
    items: [
      { name: 'position', desc: 'relative 作锚点，absolute 相对最近的非 static 祖先', code: '.parent { position: relative; }\n.child { position: absolute; inset: 0; }' },
      { name: 'inset', desc: 'top/right/bottom/left 的简写', code: 'inset: 0;        /* 铺满父级 */\ninset: 8px 12px;' },
      { name: 'sticky', desc: '吸顶需要滚动容器，且父级不能 overflow: hidden', code: '.thead { position: sticky; top: 0; z-index: 2; }' },
      { name: 'z-index', desc: '只在同一层叠上下文中比较，opacity/transform 会创建新上下文', code: 'z-index: 10;\n/* 排查：父级是否设置了 transform / filter / opacity < 1 */' },
      { name: 'fixed 与 containing block', desc: '祖先有 transform 时 fixed 会相对该祖先定位', code: '.modal { position: fixed; inset: 0; }' },
    ],
  },
  {
    title: '选择器与伪类',
    desc: '选择器 / 伪元素',
    items: [
      { name: ':is() / :where()', desc: 'where 优先级为 0，适合做基础样式重置', code: ':where(h1, h2, h3) { margin: 0; }' },
      { name: ':has()', desc: '父级选择器，可反向影响父元素', code: '.card:has(img) { padding-top: 0; }\ninput:has(:invalid) { border-color: red; }' },
      { name: ':nth-child()', desc: '按位置匹配，of 语法可先过滤', code: 'li:nth-child(2n + 1) { background: #fafbfc; }\nli:nth-child(2 of .active) { color: red; }' },
      { name: '::before / ::after', desc: '必须设置 content 才会渲染', code: '.dot::before { content: ""; display: block; width: 6px; height: 6px; }' },
      { name: ':focus-visible', desc: '只在键盘聚焦时显示轮廓，兼顾可访问性', code: 'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }' },
      { name: '属性选择器', desc: '常用于状态与类型匹配', code: 'a[href^="https"] { }\ninput[type="checkbox"] { }' },
    ],
  },
  {
    title: '响应式',
    desc: '媒体查询 / 容器查询',
    items: [
      { name: '媒体查询', desc: '移动优先：从小到大写 min-width', code: '@media (min-width: 768px) { ... }\n@media (prefers-reduced-motion: reduce) { ... }' },
      { name: '容器查询', desc: '按父容器宽度响应，组件真正可复用', code: '.card-wrap { container-type: inline-size; }\n@container (min-width: 480px) { .card { display: flex; } }' },
      { name: '暗色模式', desc: '配合 CSS 变量切换主题', code: '@media (prefers-color-scheme: dark) {\n  :root { --bg: #0f1115; --text: #e5e7eb; }\n}' },
      { name: '自适应网格', desc: 'auto-fit + minmax 一行实现卡片流式布局', code: 'grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));' },
    ],
  },
  {
    title: '动效',
    desc: 'transition / animation / transform',
    items: [
      { name: 'transition', desc: '列出参与过渡的属性，避免 all 引发意外动画', code: 'transition: transform 0.2s ease, opacity 0.2s ease;' },
      { name: 'transform', desc: '合成层属性，用 translate 代替 top/left 提升性能', code: 'transform: translate3d(0, -4px, 0) scale(1.02);' },
      { name: '@keyframes', desc: '自定义动画，配合 animation 简写', code: '@keyframes spin { to { transform: rotate(360deg); } }\n.spinner { animation: spin 1s linear infinite; }' },
      { name: 'will-change', desc: '提前提示浏览器，用完及时移除', code: '.hover-lift { will-change: transform; }' },
      { name: '可访问性', desc: '尊重系统「减少动态效果」设置', code: '@media (prefers-reduced-motion: reduce) {\n  * { animation: none !important; transition: none !important; }\n}' },
    ],
  },
  {
    title: '现代特性',
    desc: '变量 / 新函数',
    items: [
      { name: '自定义属性', desc: '可用 JS 动态修改，是主题化的基础', code: ':root { --brand: #2563eb; }\n.btn { background: var(--brand); }' },
      { name: 'color-mix()', desc: '在 CSS 中混色，无需预处理器', code: 'background: color-mix(in srgb, var(--brand) 12%, white);' },
      { name: 'backdrop-filter', desc: '毛玻璃效果，注意性能与降级', code: 'backdrop-filter: blur(12px);\nbackground: rgba(255, 255, 255, 0.6);' },
      { name: '@supports', desc: '特性检测后渐进增强', code: '@supports (display: grid) { .layout { display: grid; } }' },
      { name: 'text-wrap', desc: 'balance 让标题换行更均衡，pretty 避免孤字', code: 'h1 { text-wrap: balance; }\np { text-wrap: pretty; }' },
      { name: 'scroll-snap', desc: '轮播与横滑列表原生化', code: '.track { scroll-snap-type: x mandatory; }\n.slide { scroll-snap-align: center; }' },
    ],
  },
]
</script>

<template>
  <ToolPage title="CSS 速查" desc="布局、Flex / Grid、选择器、响应式、动效与现代特性常用写法" wide>
    <CheatSheet :sections="sections" />
  </ToolPage>
</template>

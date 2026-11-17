<script setup lang="ts">
import ToolPage from '@/components/tools/ToolPage.vue'
import CheatSheet from '@/components/tools/CheatSheet.vue'

const sections = [
  {
    title: '生命周期',
    desc: '组合式 API 钩子',
    items: [
      { name: 'onMounted', desc: 'DOM 已挂载，可访问 ref 与初始化第三方实例', code: 'onMounted(() => {\n  chart = new Chart(el.value);\n});' },
      { name: 'onBeforeUnmount', desc: '清理定时器、事件监听、地图实例，防止内存泄漏', code: 'onBeforeUnmount(() => {\n  clearInterval(timer);\n  map?.destroy();\n});' },
      { name: 'onUpdated / onUnmounted', desc: '更新后与卸载后', code: 'onUpdated(() => {});\nonUnmounted(() => {});' },
      { name: 'onActivated / onDeactivated', desc: '配合 KeepAlive 使用，缓存页面必踩', code: 'onActivated(() => refresh());\nonDeactivated(() => pause());' },
      { name: 'nextTick', desc: '等待 DOM 更新完成后再操作', code: 'await nextTick();\nlist.value.scrollTop = 0;' },
    ],
  },
  {
    title: '响应式',
    desc: 'ref / reactive / computed',
    items: [
      { name: 'ref vs reactive', desc: 'ref 适合任意类型（.value 访问），reactive 只对对象且会丢失解构响应性', code: 'const count = ref(0);\nconst state = reactive({ list: [] });' },
      { name: 'computed', desc: '带缓存，只读；需要写入时用 getter/setter', code: 'const total = computed(() => list.value.reduce((s, i) => s + i.price, 0));' },
      { name: 'watch', desc: '默认浅监听，监听对象内部需 deep 或监听具体字段', code: 'watch(() => state.list, fn, { deep: true });\nwatch(source, fn, { immediate: true, flush: "post" });' },
      { name: 'watchEffect', desc: '自动收集依赖，适合副作用联动', code: 'watchEffect(() => {\n  document.title = `${title.value} - Web GIS`;\n});' },
      { name: 'toRefs / storeToRefs', desc: '解构 reactive 时保持响应性', code: 'const { list, loading } = toRefs(state);\nconst { user } = storeToRefs(userStore);' },
      { name: 'shallowRef', desc: '大对象或地图实例用它避免深度代理开销', code: 'const map = shallowRef<Map>();' },
    ],
  },
  {
    title: '组件通信',
    desc: 'props / emit / 插槽',
    items: [
      { name: 'props', desc: '单向数据流，对象/数组默认值要用工厂函数', code: "defineProps<{ title: string; list?: Item[] }>()\nwithDefaults(defineProps<Props>(), { list: () => [] });" },
      { name: 'emit', desc: '子传父，事件名用 kebab-case', code: "const emit = defineEmits<{ change: [id: number] }>();\nemit('change', 1);" },
      { name: 'v-model', desc: '默认 modelValue + update:modelValue，可命名多个', code: "defineProps<{ modelValue: string }>();\nemit('update:modelValue', value);" },
      { name: 'defineExpose', desc: '父组件通过 ref 调用子组件方法', code: 'defineExpose({ reset, validate });' },
      { name: 'provide / inject', desc: '跨层级注入，适合主题与全局配置', code: 'provide("mapCtx", map);\nconst map = inject("mapCtx");' },
      { name: '插槽', desc: '具名插槽与作用域插槽', code: '<template #footer="{ total }">{{ total }}</template>' },
    ],
  },
  {
    title: '模板语法',
    desc: '指令速查',
    items: [
      { name: 'v-if / v-show', desc: 'if 销毁重建；show 只切 display，频繁切换用 show', code: '<div v-if="visible" />\n<div v-show="visible" />' },
      { name: 'v-for', desc: '必须给稳定 key，避免用 index', code: '<li v-for="item in list" :key="item.id">{{ item.name }}</li>' },
      { name: 'v-bind / v-on', desc: '可简写，动态属性用 [ ]', code: '<img :src="url" @click="onClick" />\n<div :[attrName]="value" />' },
      { name: 'v-model 修饰符', desc: '.lazy 失焦同步、.number 转数字、.trim 去空格', code: '<input v-model.trim.lazy="keyword" />' },
      { name: '事件修饰符', desc: '.stop .prevent .once .self .passive', code: '<form @submit.prevent="submit" />' },
      { name: 'class / style', desc: '支持对象、数组与三元', code: ':class="[{ active: isActive }, size]"' },
    ],
  },
  {
    title: '性能与工程',
    desc: '优化与约定',
    items: [
      { name: 'v-memo / v-once', desc: '长列表局部跳过更新', code: '<div v-memo="[item.id, item.status]" />' },
      { name: 'KeepAlive', desc: '缓存页面状态，配合 include 精确控制', code: '<KeepAlive :include="cachedViews">\n  <component :is="Component" />\n</KeepAlive>' },
      { name: 'defineAsyncComponent', desc: '路由级之外再拆包，减小首屏体积', code: "const Editor = defineAsyncComponent(() => import('./Editor.vue'));" },
      { name: '自动导入', desc: 'unplugin-auto-import / components 减少样板代码', code: '// 使用后 ref、computed、ElMessage 无需手动 import' },
      { name: '样式作用域', desc: 'scoped 加 :deep() 穿透子组件', code: '<style scoped>\n:deep(.el-input__inner) { border: 0; }\n</style>' },
      { name: '常见坑', desc: 'reactive 解构丢响应、watch 未 deep、ref 忘记 .value', code: 'const { a } = reactive({ a: 1 }); // a 不再响应\n// 改为 toRefs 或直接 state.a' },
    ],
  },
]
</script>

<template>
  <ToolPage title="Vue3 速查" desc="生命周期、响应式、组件通信、模板指令与性能实践" wide>
    <CheatSheet :sections="sections" />
  </ToolPage>
</template>

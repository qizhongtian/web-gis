<script setup lang="ts">
/**
 * 在线工具统一页面骨架：标题 + 说明 + 右上角操作区 + 内容
 * 内容区铺满可用高度与宽度，不再限制最大宽度，避免大屏两侧留白
 */
withDefaults(defineProps<{ title: string; desc?: string; wide?: boolean }>(), { desc: '', wide: false })
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden bg-[#f7f8fa]">
    <header class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 pt-2.5 pb-2 md:px-4">
      <h1 class="text-[17px] font-semibold text-[#111827] leading-none">{{ title }}</h1>
      <p v-if="desc" class="demo-hint text-[12.5px]">{{ desc }}</p>
      <div v-if="$slots.actions" class="ml-auto flex flex-wrap items-center gap-2">
        <slot name="actions" />
      </div>
    </header>

    <div class="flex-1 min-h-0 overflow-auto px-3 pb-3 md:px-4 md:pb-4">
      <div class="flex min-h-full flex-col gap-3">
        <slot />
      </div>
    </div>
  </div>
</template>

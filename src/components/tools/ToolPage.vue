<script setup lang="ts">
/** 在线工具统一页面骨架：标题 + 说明 + 右上角操作区 + 内容 */
withDefaults(defineProps<{ title: string; desc?: string; wide?: boolean }>(), { desc: '', wide: false })
</script>

<template>
  <div class="h-full overflow-auto bg-[#f7f8fa]">
    <div class="mx-auto p-3 md:p-5 space-y-3" :class="wide ? 'max-w-[1500px]' : 'max-w-[1280px]'">
      <header class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 class="text-[17px] font-semibold text-[#111827] leading-none">{{ title }}</h1>
        <p v-if="desc" class="demo-hint text-[12.5px]">{{ desc }}</p>
        <div v-if="$slots.actions" class="ml-auto flex flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </header>
      <slot />
    </div>
  </div>
</template>

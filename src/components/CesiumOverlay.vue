<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    /** 面板宽度，px */
    width?: number
    collapsible?: boolean
    defaultCollapsed?: boolean
  }>(),
  { width: 264, collapsible: true, defaultCollapsed: false },
)

const collapsed = ref(props.defaultCollapsed)
</script>

<template>
  <section class="overlay-panel" :style="{ width: `${props.width}px` }">
    <header class="panel-head" @click="props.collapsible && (collapsed = !collapsed)">
      <i class="dot" />
      <span class="title">{{ props.title }}</span>
      <svg
        v-if="props.collapsible"
        class="chevron"
        :class="{ collapsed }"
        viewBox="0 0 12 12"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" />
      </svg>
    </header>
    <div v-show="!collapsed" class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.overlay-panel {
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(10px);
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(226, 232, 240, 0.85);
  user-select: none;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1f2328;
}
.chevron {
  color: #94a3b8;
  transition: transform 0.18s ease;
}
.chevron.collapsed {
  transform: rotate(-90deg);
}
.panel-body {
  max-height: min(62vh, 560px);
  overflow: auto;
  padding: 12px;
}
</style>
